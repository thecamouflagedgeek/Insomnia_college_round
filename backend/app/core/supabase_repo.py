"""Supabase persistence for the integrated workflow, mapped onto the verified canonical schema.

Canonical tables (verified in the project; see migrations/0050_supabase_persistence.sql):
  reports(id uuid, public_reference, category, summary_ciphertext, description_ciphertext, severity, status, ...)
  evidence_items(id, report_id, storage_object_path, sha256_hex, mime_type, size_bytes, created_at)
  committee_challenges(id, report_id, committee_member_ref, reason_ciphertext, status, decision_note_ciphertext, ...)
  witness_invitations(id, report_id, invitation_token_hash, witness_contact_ciphertext, status, invited_at, ...)
  investigation_messages(id, report_id, sender_role, body_ciphertext, created_at)
  audit_events(...)            -> app/core/supabase_audit.py
  incident_correlations(id, report_id_a, report_id_b, similarity_score, rationale_ciphertext, review_status, ...)
Workflow state the canonical schema has no column for (reporter token hash, committee, lifecycle stage, nullifiers,
resolution, feedback, evidence names, the exact submitted payload) lives in the proposed report_workflow table
(migrations/0051_report_workflow.sql). Until that migration is applied, saving a report fails loudly.

Rules:
- Every free-text field is encrypted (AES-256-GCM, bound to its record and field) before it leaves the process.
- Every write either succeeds or raises PersistenceError. Nothing is swallowed, nothing reports success unsaved.
- Row ids are deterministic UUIDs derived from the application ids (INC-…, EVD-…), so retries are idempotent and
  no lookup is needed to address a row.
- This class performs no authorization: the server key bypasses RLS, so callers must authorize first.
"""
from __future__ import annotations

import base64
import json
import logging
import os
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.services.encryption_service import EncryptedField, EncryptionService

logger = logging.getLogger("incognito.persistence")

EVIDENCE_BUCKET = "incognito-evidence"
# Bucket limits (verified): 10 MB per object, these MIME types only. The stored object is the encrypted file, so the
# plaintext limit leaves room for the 12-byte nonce and 16-byte tag.
STORAGE_MAX_BYTES = 10 * 1024 * 1024
EVIDENCE_MAX_PLAINTEXT = STORAGE_MAX_BYTES - 28
STORAGE_MIME_TYPES = frozenset({"image/jpeg", "image/png", "application/pdf", "text/plain"})

_NS = uuid.UUID("4c1b0e64-2f53-4b8e-9d3a-6a2f0c7e5b91")  # fixed namespace for INCOGNITO row ids

# reports.status allows: submitted, triage, under_review, awaiting_info, resolved, closed. The workflow's finer
# lifecycle stage is kept in report_workflow.lifecycle_stage.
REPORT_STATUS = {"submitted": "submitted", "committee_assigned": "triage", "under_challenge": "under_review",
                 "investigating": "under_review", "witness_quorum_active": "under_review",
                 "resolved": "resolved", "closed": "closed"}
SEVERITIES = ("low", "medium", "high", "critical")
CHALLENGE_STATUS = {"pending_review": "pending", "rejected": "rejected"}  # upheld -> accepted | reassigned
WITNESS_STATUS = {None: "invited", "accept": "accepted", "decline": "declined"}
SENDER_ROLE = {"you": "reporter", "investigator": "investigator", "system": "system"}
SENDER_FROM_ROLE = {v: k for k, v in SENDER_ROLE.items()}


class PersistenceError(RuntimeError):
    """A database or storage operation did not complete. The message is safe to log (no content, no keys)."""


def row_id(kind: str, app_id: str) -> str:
    return str(uuid.uuid5(_NS, f"{kind}:{app_id}"))


def report_row_id(case_id: str) -> str:
    return row_id("report", case_id)


def report_status(stage: str) -> str:
    try:
        return REPORT_STATUS[stage]
    except KeyError:
        raise PersistenceError(f"no reports.status mapping for lifecycle stage {stage!r}") from None


def severity_value(severity: dict | None) -> str:
    level = (severity or {}).get("level")
    return level if level in SEVERITIES else "medium"  # the engines' "review" level means unassessed: medium


def challenge_status(status: str, replaced: bool) -> str:
    if status == "upheld":
        return "reassigned" if replaced else "accepted"
    return CHALLENGE_STATUS[status]


def challenge_status_from_row(status: str) -> str:
    return {"pending": "pending_review", "rejected": "rejected", "accepted": "upheld", "reassigned": "upheld"}[status]


def ordered_pair(a: str, b: str) -> tuple[str, str]:
    """incident_correlations has UNIQUE(report_id_a, report_id_b): always store the smaller uuid first."""
    return (a, b) if a < b else (b, a)


@dataclass
class LoadedState:
    """Everything read back at startup, already decrypted, keyed by application ids."""
    reports: list[dict] = field(default_factory=list)
    evidence: dict[str, list[dict]] = field(default_factory=dict)      # case_id -> rows
    challenges: dict[str, list[dict]] = field(default_factory=dict)
    messages: dict[str, list[dict]] = field(default_factory=dict)
    invitations: list[dict] = field(default_factory=list)
    # Fault isolation: a table that cannot be read or a row that cannot be decrypted is skipped and named here, so
    # one bad record disables only itself. `down` means the reports table itself was unreachable.
    problems: list[str] = field(default_factory=list)
    down: bool = False


class SupabaseRepository:
    def __init__(self, client: Any, encryption_key: bytes, bucket: str = EVIDENCE_BUCKET):
        if not encryption_key or len(encryption_key) != 32:
            raise PersistenceError("Supabase persistence requires a 32-byte ENCRYPTION_KEY; refusing to store "
                                   "report content unencrypted")
        self.client = client
        self.bucket = bucket
        self._crypto = EncryptionService(encryption_key)
        self._aead = AESGCM(encryption_key)

    @classmethod
    def from_env(cls, url: str, secret_key: str, encryption_key: bytes) -> "SupabaseRepository":
        from supabase import create_client  # imported lazily: the server key never leaves this process
        bucket = os.getenv("SUPABASE_STORAGE_BUCKET", EVIDENCE_BUCKET)
        return cls(create_client(url, secret_key), encryption_key, bucket)

    # ---- plumbing -------------------------------------------------------------------------------------------------

    def _run(self, query, what: str) -> list[dict]:
        try:
            res = query.execute()
        except Exception as exc:
            logger.error("Supabase %s failed: %s", what, type(exc).__name__)
            raise PersistenceError(f"{what} failed") from exc
        return list(getattr(res, "data", None) or [])

    def _enc(self, value: str, record: str, record_id: str, name: str) -> str:
        return self._crypto.encrypt_field(value, record, record_id, name).ciphertext

    def _dec(self, value: str, record: str, record_id: str, name: str) -> str:
        return self._crypto.decrypt_field(EncryptedField(value, f"{record}:{record_id}:{name}"), record, record_id,
                                          name)

    def _enc_json(self, value: Any, record: str, record_id: str, name: str) -> str:
        return self._enc(json.dumps(value, separators=(",", ":")), record, record_id, name)

    def _dec_json(self, value: str, record: str, record_id: str, name: str) -> Any:
        return json.loads(self._dec(value, record, record_id, name))

    @staticmethod
    def _now() -> str:
        return datetime.now(timezone.utc).isoformat(timespec="seconds")

    # ---- reports + workflow ---------------------------------------------------------------------------------------

    def save_report(self, case) -> None:
        """Upsert the canonical report row and its workflow row. `case` is app.stub.store.Case."""
        rid = report_row_id(case.case_id)
        payload = case.payload
        self._run(self.client.table("reports").upsert({
            "id": rid,
            "public_reference": case.case_id,
            "category": payload.get("category") or "Other",
            "summary_ciphertext": self._enc(payload.get("title") or "", "report", rid, "summary"),
            "description_ciphertext": self._enc(payload.get("description") or "", "report", rid, "description"),
            "severity": severity_value(case.severity),
            "status": report_status(case.status),
            "updated_at": self._now(),
        }, on_conflict="id"), f"save report {case.case_id}")
        state = {
            # The exact submitted payload: the Silent Audit sealed its hash, so it must round-trip byte for byte.
            "raw_payload": case.raw_payload,
            "created_at": case.created_at,
            "committee": [m["member_id"] for m in case.committee],
            "investigator_id": case.investigator_id,
            "revoked_ids": list(case.revoked_ids),
            "nullifier": case.nullifier,
            "proof_tx": case.proof_tx,
            "severity": case.severity,
            "integrity_flags": list(case.integrity_flags),
            "subject_ref": case.subject_ref,
            "fingerprint": case.fingerprint,
            "resolution": case.resolution,
            "reflection": case.reflection,
            "evidence_names": {e.evidence_id: e.name for e in case.evidence},
        }
        self._run(self.client.table("report_workflow").upsert({
            "report_id": rid,
            "lifecycle_stage": case.status,
            "token_hash": case.token_hash,
            "state_ciphertext": self._enc_json(state, "workflow", rid, "state"),
            "updated_at": self._now(),
        }, on_conflict="report_id"), f"save workflow for {case.case_id}")

    # ---- evidence ------------------------------------------------------------------------------------------------

    def save_evidence(self, case_id: str, evidence_id: str, mime: str, size: int, sha256_hex: str,
                      content: bytes) -> str:
        """Encrypt and upload the stored copy, then record its metadata. Returns the storage path."""
        if mime not in STORAGE_MIME_TYPES:
            raise PersistenceError(f"evidence type {mime} is not accepted by the evidence bucket")
        if len(content) > EVIDENCE_MAX_PLAINTEXT:
            raise PersistenceError("evidence exceeds the evidence bucket's size limit")
        rid = report_row_id(case_id)
        path = f"reports/{rid}/{evidence_id}"
        nonce = os.urandom(12)
        blob = nonce + self._aead.encrypt(nonce, content, f"evidence:{rid}:{evidence_id}".encode())
        try:
            self.client.storage.from_(self.bucket).upload(
                path=path, file=blob, file_options={"content-type": mime, "upsert": "false"})
        except Exception as exc:
            logger.error("Evidence upload failed: %s", type(exc).__name__)
            raise PersistenceError(f"upload evidence {evidence_id} failed") from exc
        self._run(self.client.table("evidence_items").insert({
            "id": row_id("evidence", evidence_id), "report_id": rid, "storage_object_path": path,
            "sha256_hex": sha256_hex, "mime_type": mime, "size_bytes": size, "created_at": self._now(),
        }), f"record evidence {evidence_id}")
        return path

    def evidence_content(self, case_id: str, evidence_id: str) -> bytes:
        rid = report_row_id(case_id)
        path = f"reports/{rid}/{evidence_id}"
        try:
            blob = self.client.storage.from_(self.bucket).download(path)
        except Exception as exc:
            raise PersistenceError(f"download evidence {evidence_id} failed") from exc
        return self._aead.decrypt(blob[:12], blob[12:], f"evidence:{rid}:{evidence_id}".encode())

    # ---- committee challenges ------------------------------------------------------------------------------------

    def save_challenge(self, case_id: str, ch, replaced: bool = False) -> None:
        """Insert or update one challenge (`ch` is app.stub.store.ChallengeRec)."""
        cid = row_id("challenge", ch.challenge_id)
        row = {
            "id": cid,
            "report_id": report_row_id(case_id),
            "committee_member_ref": ch.member_id,
            "reason_ciphertext": self._enc_json({"challenge_id": ch.challenge_id, "reason": ch.reason,
                                                 "explanation": ch.explanation, "proof_tx": ch.proof_tx,
                                                 "submitted_at": ch.at}, "challenge", cid, "reason"),
            "status": challenge_status(ch.status, replaced),
            "decision_note_ciphertext": (self._enc_json({"rationale": ch.rationale, "reviewer_id": ch.reviewer_id},
                                                        "challenge", cid, "decision")
                                         if ch.status != "pending_review" else None),
            "decided_at": ch.decided_at,
        }
        self._run(self.client.table("committee_challenges").upsert(row, on_conflict="id"),
                  f"save challenge {ch.challenge_id}")

    # ---- witness invitations -------------------------------------------------------------------------------------

    def save_invitation(self, inv) -> None:
        """Insert or update one invitation (`inv` is app.stub.store.Invitation). Only the code's hash is stored."""
        wid = row_id("witness", inv.invitation_id)
        self._run(self.client.table("witness_invitations").upsert({
            "id": wid,
            "report_id": report_row_id(inv.case_id),
            "invitation_token_hash": inv.code_hash,
            "witness_contact_ciphertext": self._enc_json({"invitation_id": inv.invitation_id, "alias": inv.alias,
                                                          "context": inv.context}, "witness", wid, "contact"),
            "status": WITNESS_STATUS[inv.response],
            "invited_at": inv.invited_at or self._now(),
            "responded_at": inv.responded_at,
        }, on_conflict="id"), f"save invitation {inv.invitation_id}")

    # ---- investigation messages ----------------------------------------------------------------------------------

    def insert_message(self, case_id: str, msg) -> None:
        """`msg` is app.stub.store.Message; its application id travels inside the encrypted body."""
        mid = row_id("message", msg.message_id)
        self._run(self.client.table("investigation_messages").insert({
            "id": mid,
            "report_id": report_row_id(case_id),
            "sender_role": SENDER_ROLE[msg.sender],
            "body_ciphertext": self._enc_json({"message_id": msg.message_id, "text": msg.text}, "message", mid,
                                              "body"),
            "created_at": msg.at,
        }), f"save message {msg.message_id}")

    # ---- incident correlations (advisory only) -------------------------------------------------------------------

    def save_correlation(self, case_a: str, case_b: str, score: float, method: str) -> None:
        """Record a possible link for human review. Never merges, never rejects; review starts as pending."""
        a, b = ordered_pair(report_row_id(case_a), report_row_id(case_b))
        if a == b:
            raise PersistenceError("a report cannot be correlated with itself")
        pair_id = row_id("correlation", f"{a}:{b}")
        self._run(self.client.table("incident_correlations").upsert({
            "id": pair_id, "report_id_a": a, "report_id_b": b, "similarity_score": round(float(score), 4),
            "rationale_ciphertext": self._enc_json({"method": method}, "correlation", pair_id, "rationale"),
            "review_status": "pending",
        }, on_conflict="report_id_a,report_id_b"), "save correlation")

    # ---- load everything (startup) -------------------------------------------------------------------------------

    def load(self) -> LoadedState:
        """Read and decrypt all workflow records. Never raises for a bad table or row: it skips it and records the
        problem, so the rest still loads. Only an unreachable reports table marks the store down."""
        out = LoadedState()

        def rows(table: str, cols: str, ordered: bool = False) -> list[dict]:
            q = self.client.table(table).select(cols)
            try:
                return self._run(q.order("created_at") if ordered else q, f"load {table}")
            except PersistenceError:
                out.problems.append(f"{table}: could not be read")
                return []

        def each(table: str, items: list[dict], fn) -> None:
            bad = 0
            for item in items:
                try:
                    fn(item)
                except Exception:  # undecryptable or malformed: this record only
                    bad += 1
            if bad:
                out.problems.append(f"{table}: {bad} record(s) unreadable and skipped")

        try:
            reports = self._run(self.client.table("reports").select(
                "id,public_reference,category,severity,status,created_at"), "load reports")
        except PersistenceError:
            out.down = True
            out.problems.append("reports: database unreachable")
            return out
        workflows = {w["report_id"]: w for w in rows("report_workflow",
                                                     "report_id,lifecycle_stage,token_hash,state_ciphertext")}
        by_id: dict[str, str] = {}
        missing = 0

        def add_report(r: dict) -> None:
            nonlocal missing
            w = workflows.get(r["id"])
            if w is None:
                # Created outside this application, or report_workflow (0051) not applied: no reporter token, no
                # committee. Not shown with invented workflow data.
                missing += 1
                return
            state = self._dec_json(w["state_ciphertext"], "workflow", r["id"], "state")
            out.reports.append({"case_id": r["public_reference"], "status": w["lifecycle_stage"],
                                "token_hash": w["token_hash"], **state})
            by_id[r["id"]] = r["public_reference"]

        each("reports", reports, add_report)
        if missing:
            out.problems.append(f"reports: {missing} without workflow state (migration 0051?) not loaded")

        def add_evidence(e: dict) -> None:
            if e["report_id"] in by_id:
                out.evidence.setdefault(by_id[e["report_id"]], []).append({
                    "evidence_id": e["storage_object_path"].rsplit("/", 1)[-1], "mime": e["mime_type"],
                    "size": e["size_bytes"], "sha256": e["sha256_hex"]})

        each("evidence_items", rows("evidence_items",
                                    "id,report_id,storage_object_path,sha256_hex,mime_type,size_bytes"), add_evidence)

        def add_challenge(c: dict) -> None:
            if c["report_id"] not in by_id:
                return
            reason = self._dec_json(c["reason_ciphertext"], "challenge", c["id"], "reason")
            decision = (self._dec_json(c["decision_note_ciphertext"], "challenge", c["id"], "decision")
                        if c.get("decision_note_ciphertext") else {})
            out.challenges.setdefault(by_id[c["report_id"]], []).append({
                "challenge_id": reason["challenge_id"], "member_id": c["committee_member_ref"],
                "reason": reason["reason"], "explanation": reason["explanation"],
                "status": challenge_status_from_row(c["status"]), "proof_tx": reason.get("proof_tx", ""),
                "at": reason.get("submitted_at", ""), "reviewer_id": decision.get("reviewer_id"),
                "rationale": decision.get("rationale"), "decided_at": c.get("decided_at")})

        each("committee_challenges", rows(
            "committee_challenges",
            "id,report_id,committee_member_ref,reason_ciphertext,status,decision_note_ciphertext,decided_at"),
            add_challenge)

        def add_message(m: dict) -> None:
            if m["report_id"] not in by_id:
                return
            body = self._dec_json(m["body_ciphertext"], "message", m["id"], "body")
            out.messages.setdefault(by_id[m["report_id"]], []).append({
                "message_id": body["message_id"], "sender": SENDER_FROM_ROLE.get(m["sender_role"], "investigator"),
                "text": body["text"], "at": str(m["created_at"])})

        each("investigation_messages", rows("investigation_messages",
                                            "id,report_id,sender_role,body_ciphertext,created_at", ordered=True),
             add_message)

        def add_invitation(w: dict) -> None:
            if w["report_id"] not in by_id:
                return
            contact = self._dec_json(w["witness_contact_ciphertext"], "witness", w["id"], "contact")
            out.invitations.append({
                "invitation_id": contact["invitation_id"], "case_id": by_id[w["report_id"]],
                "code_hash": w["invitation_token_hash"], "context": contact["context"], "alias": contact["alias"],
                "response": {"accepted": "accept", "declined": "decline"}.get(w["status"]),
                "invited_at": str(w.get("invited_at") or ""), "responded_at": w.get("responded_at")})

        each("witness_invitations", rows(
            "witness_invitations",
            "id,report_id,invitation_token_hash,witness_contact_ciphertext,status,invited_at,responded_at"),
            add_invitation)
        return out


def evidence_b64(content: bytes) -> str:
    return base64.b64encode(content).decode()
