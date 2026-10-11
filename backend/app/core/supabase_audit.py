"""Silent Audit storage in the canonical audit_events table (an AuditRepository for app.chain).

The hash chain itself is unchanged (app.chain.audit_log builds every entry); this only stores it:
  event_type, actor_role, metadata{seq, salt, commitment, envelope}, previous_hash, event_hash, report_id.
The service role has no UPDATE on audit_events, so nothing is ever rewritten: an anchor is recorded as its own
append-only row (event_type 'chain_anchor', blockchain_tx_hash set) instead of updating the events it covers.
Missing database privileges make edits harder; they do not make the log tamper-proof. Detection comes from the hash
chain and the on-chain anchors.

Reads are served from an in-memory mirror loaded at startup; every append is written to the database first, so the
mirror never holds an event the database refused.
"""
from __future__ import annotations

import threading

from app.chain.audit_repo import AnchorRecord, AuditEvent, Builder
from app.core.supabase_repo import PersistenceError, report_row_id

ANCHOR_EVENT = "chain_anchor"


class SupabaseAuditRepository:
    def __init__(self, repo, case_ids: dict[str, str], real_chain: bool = False):
        """`repo`: SupabaseRepository; `case_ids`: report row id -> public reference for the reports loaded.
        `real_chain`: anchors come from the deployed registry. Otherwise (offline test chain) the anchor's transaction
        hash is invented by the stand-in, so it is never written to blockchain_tx_hash."""
        self._repo = repo
        self._real_chain = real_chain
        self._lock = threading.Lock()
        self._events: dict[str, list[AuditEvent]] = {}
        self._anchors: dict[str, list[AnchorRecord]] = {}
        rows = repo._run(repo.client.table("audit_events").select(
            "report_id,event_type,metadata,previous_hash,event_hash,blockchain_tx_hash"), "load audit events")
        self.skipped = 0  # malformed rows: skipped so one bad entry cannot stop the rest from loading
        for r in rows:
            case_id = case_ids.get(r["report_id"])
            if case_id is None:
                continue
            try:
                self._load_row(case_id, r)
            except Exception:
                self.skipped += 1
        for chain in self._events.values():
            chain.sort(key=lambda e: e.seq)
        for anchors in self._anchors.values():
            anchors.sort(key=lambda a: a.seq)

    def _load_row(self, case_id: str, r: dict) -> None:
        m = r["metadata"] or {}
        if r["event_type"] == ANCHOR_EVENT:
            self._anchors.setdefault(case_id, []).append(AnchorRecord(
                case_id, int(m["seq"]), r["event_hash"], r.get("blockchain_tx_hash") or "",
                int(m.get("block_number") or 0)))
        else:
            self._events.setdefault(case_id, []).append(AuditEvent(
                case_id, int(m["seq"]), r["event_type"], m["envelope"], m["salt"], m["commitment"],
                r["previous_hash"], r["event_hash"]))

    def _insert(self, row: dict, what: str) -> None:
        self._repo._run(self._repo.client.table("audit_events").insert(row), what)

    def append(self, case_id: str, build: Builder) -> AuditEvent:
        with self._lock:
            chain = self._events.setdefault(case_id, [])
            seq, prev = (chain[-1].seq + 1, chain[-1].entry_hash) if chain else (1, "0x" + "00" * 32)
            event = build(seq, prev)
            self._insert({
                "report_id": report_row_id(case_id), "event_type": event.event_type, "actor_role": "system",
                "metadata": {"seq": event.seq, "salt": event.salt, "commitment": event.commitment,
                             "envelope": event.payload},
                "previous_hash": event.prev_hash, "event_hash": event.entry_hash,
            }, f"append audit event {event.event_type}")
            chain.append(event)
            return event

    def events(self, case_id: str) -> list[AuditEvent]:
        return list(self._events.get(case_id, []))

    def unanchored_heads(self) -> list[tuple[str, int, str]]:
        out = []
        for case_id, chain in self._events.items():
            anchored = max((a.seq for a in self._anchors.get(case_id, [])), default=0)
            if chain and chain[-1].seq > anchored:
                out.append((case_id, chain[-1].seq, chain[-1].entry_hash))
        return out

    def save_anchor(self, rec: AnchorRecord) -> None:
        with self._lock:
            self._insert({
                "report_id": report_row_id(rec.case_id), "event_type": ANCHOR_EVENT, "actor_role": "system",
                "metadata": {"seq": rec.seq, "block_number": rec.block_number,
                             **({} if self._real_chain else {"offline_test_chain": True})},
                "previous_hash": rec.head, "event_hash": rec.head,
                "blockchain_tx_hash": (rec.tx_hash or None) if self._real_chain else None,
            }, "record audit anchor")
            self._anchors.setdefault(rec.case_id, []).append(rec)

    def anchors(self, case_id: str) -> list[AnchorRecord]:
        return list(self._anchors.get(case_id, []))


class UnavailableAuditRepository:
    """Used when audit_events cannot be loaded. Reads are empty (verification then shows nothing, never a pass) and
    every append is refused, so no audit entry is ever kept only in memory while the database is unavailable."""

    def append(self, case_id, build):
        raise PersistenceError("audit log unavailable")

    def save_anchor(self, rec):
        raise PersistenceError("audit log unavailable")

    def events(self, case_id):
        return []

    def anchors(self, case_id):
        return []

    def unanchored_heads(self):
        return []


__all__ = ["SupabaseAuditRepository", "UnavailableAuditRepository", "PersistenceError", "ANCHOR_EVENT"]
