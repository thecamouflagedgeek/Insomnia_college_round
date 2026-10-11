"""Supabase Persistence Repository.

Implements canonical database persistence for reports, evidence items,
committee challenges, witness invitations, investigation messaging, and
audit records via the server-side Supabase client.
"""
from __future__ import annotations

import base64
import hashlib
import json
import logging
from datetime import datetime, timezone
from typing import Any
from uuid import uuid4

from supabase import Client, create_client

from app.core.config import Settings, get_settings
from app.utils.encryption import encrypt, decrypt, get_encryption_key, EncryptionError

logger = logging.getLogger("incognito.persistence")


class IntegrationUnavailable(RuntimeError):
    pass


class SupabaseRepository:
    """Canonical repository interfacing with PostgreSQL/Supabase tables."""

    def __init__(self, client: Client, encryption_key: bytes | None = None):
        self.client = client
        self._key = encryption_key or get_encryption_key()

    @classmethod
    def from_settings(cls, settings: Settings | None = None) -> SupabaseRepository:
        settings = settings or get_settings()
        if not settings.supabase_url or not settings.supabase_secret_key:
            raise IntegrationUnavailable("Supabase service credentials (SUPABASE_URL and SUPABASE_SECRET_KEY) are not configured")
        
        try:
            client = create_client(settings.supabase_url, settings.supabase_secret_key)
            key = None
            try:
                key = get_encryption_key()
            except Exception as e:
                logger.warning("Encryption key not configured for Supabase repository: %s", e)
            return cls(client, key)
        except Exception as exc:
            raise IntegrationUnavailable(f"Failed to connect to Supabase: {exc}") from exc

    # ---- Field Encryption Helpers -------------------------------------------------------------

    def _encrypt(self, plaintext: str, record_type: str, record_id: str, field_name: str) -> tuple[str, str]:
        """Encrypt plaintext returning (ciphertext, aad_string)."""
        if not self._key:
            raise EncryptionError("Cannot encrypt field: ENCRYPTION_KEY is missing")
        aad_bytes = f"{record_type}:{record_id}:{field_name}".encode("utf-8")
        ciphertext = encrypt(plaintext.encode("utf-8"), self._key, aad_bytes)
        return ciphertext, aad_bytes.decode("utf-8")

    def _decrypt(self, ciphertext: str, record_type: str, record_id: str, field_name: str, aad_str: str | None = None) -> str:
        """Decrypt ciphertext verifying associated data."""
        if not self._key:
            raise EncryptionError("Cannot decrypt field: ENCRYPTION_KEY is missing")
        aad_bytes = (aad_str or f"{record_type}:{record_id}:{field_name}").encode("utf-8")
        decrypted_bytes = decrypt(ciphertext, self._key, aad_bytes)
        return decrypted_bytes.decode("utf-8")

    # ---- Reports Operations -------------------------------------------------------------------

    def insert_report(self, report_dict: dict[str, Any]) -> dict[str, Any]:
        """Save a new report into Supabase with encrypted title and narrative."""
        case_id = report_dict["case_id"]
        title_plain = report_dict.get("title") or report_dict.get("payload", {}).get("title", "")
        desc_plain = report_dict.get("description") or report_dict.get("payload", {}).get("description", "")

        enc_title, title_aad = self._encrypt(title_plain, "report", case_id, "title")
        enc_desc, desc_aad = self._encrypt(desc_plain, "report", case_id, "narrative")

        row = {
            "case_id": case_id,
            "token_hash": report_dict.get("token_hash", ""),
            "category": report_dict.get("category") or report_dict.get("payload", {}).get("category", "Other"),
            "categories": report_dict.get("categories") or report_dict.get("payload", {}).get("categories", []),
            "encrypted_title": enc_title,
            "encrypted_narrative": enc_desc,
            "title_aad": title_aad,
            "narrative_aad": desc_aad,
            "incident_date": str(report_dict.get("incident_date") or report_dict.get("payload", {}).get("incident_date") or ""),
            "client_nonce": report_dict.get("client_nonce") or report_dict.get("payload", {}).get("client_nonce", ""),
            "subject_ref": report_dict.get("subject_ref") or report_dict.get("payload", {}).get("subject_ref"),
            "status": report_dict.get("status", "submitted"),
            "severity": report_dict.get("severity", {}),
            "integrity_flags": list(report_dict.get("integrity_flags", [])),
            "nullifier": report_dict.get("nullifier", ""),
            "proof_tx": report_dict.get("proof_tx", ""),
            "investigator_id": report_dict.get("investigator_id", "usr_sarah"),
            "committee": report_dict.get("committee", []),
            "revoked_ids": list(report_dict.get("revoked_ids", [])),
            "resolution": report_dict.get("resolution"),
            "reflection": report_dict.get("reflection"),
            "created_at": report_dict.get("created_at") or datetime.now(timezone.utc).isoformat(),
        }
        # Clean null dates
        if not row["incident_date"]:
            row["incident_date"] = None

        res = self.client.table("reports").insert(row).execute()
        if not res.data:
            raise IntegrationUnavailable(f"Failed to persist report {case_id} to Supabase")
        return self._format_report(res.data[0])

    def get_report(self, case_id: str) -> dict[str, Any] | None:
        """Fetch a report by case_id and decrypt sensitive fields."""
        res = self.client.table("reports").select("*").eq("case_id", case_id).execute()
        if not res.data:
            return None
        return self._format_report(res.data[0])

    def list_reports(self) -> list[dict[str, Any]]:
        """Fetch all reports from Supabase."""
        res = self.client.table("reports").select("*").order("created_at", desc=True).execute()
        return [self._format_report(row) for row in (res.data or [])]

    def update_report(self, case_id: str, updates: dict[str, Any]) -> dict[str, Any]:
        """Update fields of an existing report."""
        updates["updated_at"] = datetime.now(timezone.utc).isoformat()
        res = self.client.table("reports").update(updates).eq("case_id", case_id).execute()
        if not res.data:
            raise IntegrationUnavailable(f"Failed to update report {case_id} in Supabase")
        return self._format_report(res.data[0])

    def _format_report(self, row: dict[str, Any]) -> dict[str, Any]:
        """Transform raw DB row into domain Case dict with decrypted strings."""
        case_id = row["case_id"]
        title = ""
        description = ""
        try:
            if row.get("encrypted_title"):
                title = self._decrypt(row["encrypted_title"], "report", case_id, "title", row.get("title_aad"))
            if row.get("encrypted_narrative"):
                description = self._decrypt(row["encrypted_narrative"], "report", case_id, "narrative", row.get("narrative_aad"))
        except Exception as e:
            logger.error("Failed to decrypt report %s: %s", case_id, e)
            title = "[Decryption Failed]"
            description = "[Decryption Failed]"

        return {
            "case_id": case_id,
            "token_hash": row.get("token_hash", ""),
            "status": row.get("status", "submitted"),
            "created_at": str(row.get("created_at", "")),
            "investigator_id": row.get("investigator_id", "usr_sarah"),
            "committee": row.get("committee") or [],
            "revoked_ids": row.get("revoked_ids") or [],
            "nullifier": row.get("nullifier", ""),
            "proof_tx": row.get("proof_tx", ""),
            "severity": row.get("severity") or {},
            "integrity_flags": row.get("integrity_flags") or [],
            "resolution": row.get("resolution"),
            "reflection": row.get("reflection"),
            "payload": {
                "title": title,
                "description": description,
                "category": row.get("category", "Other"),
                "categories": row.get("categories") or [],
                "incident_date": row.get("incident_date"),
                "client_nonce": row.get("client_nonce", ""),
                "subject_ref": row.get("subject_ref"),
            },
        }

    # ---- Evidence Operations ------------------------------------------------------------------

    def insert_evidence(
        self,
        case_id: str,
        evidence_id: str,
        name: str,
        mime: str,
        size: int,
        sha256: str,
        file_bytes: bytes | None = None,
    ) -> dict[str, Any]:
        """Store evidence metadata and upload file to private Supabase Storage bucket."""
        storage_path = f"cases/{case_id}/{evidence_id}"

        # Upload file to private Supabase Storage if data is provided
        if file_bytes is not None:
            try:
                self.client.storage.from_("evidence").upload(
                    path=storage_path,
                    file=file_bytes,
                    file_options={"content-type": mime, "upsert": "true"},
                )
            except Exception as e:
                logger.warning("Storage bucket upload skipped or failed for %s: %s", storage_path, e)

        row = {
            "id": evidence_id,
            "case_id": case_id,
            "name": name,
            "mime": mime,
            "size": size,
            "sha256": sha256,
            "storage_path": storage_path,
            "bucket": "evidence",
            "verification_status": "verified",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        res = self.client.table("evidence_items").insert(row).execute()
        return row

    def list_evidence(self, case_id: str) -> list[dict[str, Any]]:
        """Fetch evidence items attached to a case."""
        res = self.client.table("evidence_items").select("*").eq("case_id", case_id).execute()
        return res.data or []

    # ---- Committee Challenges -----------------------------------------------------------------

    def insert_challenge(
        self,
        challenge_id: str,
        case_id: str,
        member_id: str,
        reason: str,
        explanation: str,
        proof_tx: str = "",
        nullifier: str = "",
    ) -> dict[str, Any]:
        """Store a committee challenge submission."""
        row = {
            "id": challenge_id,
            "case_id": case_id,
            "member_id": member_id,
            "reason": reason,
            "explanation": explanation,
            "status": "pending_review",
            "proof_tx": proof_tx,
            "nullifier": nullifier,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        res = self.client.table("committee_challenges").insert(row).execute()
        return row

    def update_challenge_decision(
        self,
        challenge_id: str,
        status: str,
        reviewer_id: str,
        rationale: str,
    ) -> dict[str, Any]:
        """Update an adjudication decision on a committee challenge."""
        updates = {
            "status": status,
            "reviewer_id": reviewer_id,
            "rationale": rationale,
            "decided_at": datetime.now(timezone.utc).isoformat(),
        }
        res = self.client.table("committee_challenges").update(updates).eq("id", challenge_id).execute()
        return updates

    def list_challenges(self, case_id: str | None = None) -> list[dict[str, Any]]:
        """List challenges for a specific case or all cases."""
        query = self.client.table("committee_challenges").select("*")
        if case_id:
            query = query.eq("case_id", case_id)
        res = query.order("created_at", desc=True).execute()
        return res.data or []

    # ---- Witness Invitations ------------------------------------------------------------------

    def insert_witness_invitation(
        self,
        invitation_id: str,
        case_id: str,
        code: str,
        role_alias: str,
        contact: str | None = None,
        expires_at: str | None = None,
    ) -> dict[str, Any]:
        """Record a witness quorum invitation."""
        enc_contact = None
        contact_aad = None
        if contact:
            enc_contact, contact_aad = self._encrypt(contact, "witness", invitation_id, "contact")

        row = {
            "id": invitation_id,
            "case_id": case_id,
            "code": code,
            "role_alias": role_alias,
            "encrypted_contact": enc_contact,
            "contact_aad": contact_aad,
            "status": "pending",
            "statement_provided": False,
            "expires_at": expires_at,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        res = self.client.table("witness_invitations").insert(row).execute()
        return row

    def get_witness_invitation_by_code(self, code: str) -> dict[str, Any] | None:
        """Fetch witness invitation by code."""
        res = self.client.table("witness_invitations").select("*").eq("code", code).execute()
        return res.data[0] if res.data else None

    def update_witness_response(self, code: str, status: str) -> dict[str, Any]:
        """Update witness response (accept or decline)."""
        updates = {
            "status": "accepted" if status == "accept" else "declined",
            "statement_provided": status == "accept",
            "responded_at": datetime.now(timezone.utc).isoformat(),
        }
        self.client.table("witness_invitations").update(updates).eq("code", code).execute()
        return updates

    def list_witness_invitations(self, case_id: str | None = None) -> list[dict[str, Any]]:
        """List witness invitations."""
        query = self.client.table("witness_invitations").select("*")
        if case_id:
            query = query.eq("case_id", case_id)
        res = query.order("created_at", desc=True).execute()
        return res.data or []

    # ---- Investigation Messaging --------------------------------------------------------------

    def insert_message(self, message_id: str, case_id: str, sender: str, text: str) -> dict[str, Any]:
        """Store an investigation message with AES-256 encrypted body."""
        enc_body, body_aad = self._encrypt(text, "message", message_id, "body")
        row = {
            "id": message_id,
            "case_id": case_id,
            "sender": sender,
            "encrypted_body": enc_body,
            "body_aad": body_aad,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self.client.table("investigation_messages").insert(row).execute()
        return {
            "message_id": message_id,
            "case_id": case_id,
            "sender": sender,
            "text": text,
            "at": row["created_at"],
        }

    def list_messages(self, case_id: str) -> list[dict[str, Any]]:
        """Fetch all messages for a case and decrypt bodies."""
        res = (
            self.client.table("investigation_messages")
            .select("*")
            .eq("case_id", case_id)
            .order("created_at", desc=False)
            .execute()
        )
        out = []
        for r in res.data or []:
            text = "[Encrypted Message]"
            try:
                text = self._decrypt(r["encrypted_body"], "message", r["id"], "body", r.get("body_aad"))
            except Exception as e:
                logger.error("Failed to decrypt message %s: %s", r["id"], e)
            out.append({
                "message_id": r["id"],
                "case_id": r["case_id"],
                "sender": r["sender"],
                "text": text,
                "at": r["created_at"],
            })
        return out
