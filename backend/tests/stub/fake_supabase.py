"""In-memory stand-in for the Supabase client that enforces the verified schema.

Writing a column that does not exist, a value outside a CHECK list, a duplicate unique key, a dangling foreign key,
or an UPDATE on audit_events raises, exactly where the real database would refuse. Tests therefore prove that the
repository only uses canonical names and allowed values; they do not prove anything about the live project
(RLS, grants, network), which these tests never contact.
"""
from __future__ import annotations

import copy
from dataclasses import dataclass

COLUMNS = {
    "reports": {"id", "public_reference", "category", "summary_ciphertext", "description_ciphertext", "severity",
                "status", "created_at", "updated_at"},
    "evidence_items": {"id", "report_id", "storage_object_path", "sha256_hex", "mime_type", "size_bytes",
                       "created_at"},
    "committee_challenges": {"id", "report_id", "committee_member_ref", "reason_ciphertext", "status",
                             "decision_note_ciphertext", "created_at", "decided_at"},
    "witness_invitations": {"id", "report_id", "invitation_token_hash", "witness_contact_ciphertext", "status",
                            "invited_at", "responded_at"},
    "investigation_messages": {"id", "report_id", "sender_role", "body_ciphertext", "created_at"},
    "audit_events": {"id", "report_id", "event_type", "actor_role", "metadata", "previous_hash", "event_hash",
                     "blockchain_tx_hash", "created_at"},
    "incident_correlations": {"id", "report_id_a", "report_id_b", "similarity_score", "rationale_ciphertext",
                              "review_status", "created_at"},
    # proposed in migrations/0051_report_workflow.sql
    "report_workflow": {"report_id", "lifecycle_stage", "token_hash", "state_ciphertext", "updated_at"},
}
CHECKS = {
    ("reports", "severity"): {"low", "medium", "high", "critical"},
    ("reports", "status"): {"submitted", "triage", "under_review", "awaiting_info", "resolved", "closed"},
    ("committee_challenges", "status"): {"pending", "accepted", "rejected", "reassigned"},
    ("witness_invitations", "status"): {"invited", "accepted", "declined", "expired"},
    ("investigation_messages", "sender_role"): {"reporter", "investigator", "system"},
    ("incident_correlations", "review_status"): {"pending", "reviewed", "dismissed"},
    ("report_workflow", "lifecycle_stage"): {"submitted", "committee_assigned", "under_challenge", "investigating",
                                             "witness_quorum_active", "resolved", "closed"},
}
NOT_NULL = {"reports": {"public_reference", "category", "description_ciphertext", "severity", "status"},
            "committee_challenges": {"committee_member_ref", "reason_ciphertext", "status"}}
UNIQUE = {"reports": [("id",), ("public_reference",)], "evidence_items": [("id",)],
          "committee_challenges": [("id",)], "witness_invitations": [("id",), ("invitation_token_hash",)],
          "investigation_messages": [("id",)], "incident_correlations": [("report_id_a", "report_id_b")],
          "report_workflow": [("report_id",)]}
FK_REPORT = {"evidence_items": ["report_id"], "committee_challenges": ["report_id"],
             "witness_invitations": ["report_id"], "investigation_messages": ["report_id"],
             "audit_events": ["report_id"], "report_workflow": ["report_id"],
             "incident_correlations": ["report_id_a", "report_id_b"]}
STORAGE_LIMIT = 10 * 1024 * 1024
STORAGE_TYPES = {"image/jpeg", "image/png", "application/pdf", "text/plain"}


class DbError(Exception):
    pass


@dataclass
class Result:
    data: list


class Query:
    def __init__(self, db: "FakeSupabase", table: str):
        self.db, self.table, self.op, self.payload, self.filters, self.on_conflict = db, table, "select", None, [], None
        self._order = None
        self._limit = None
        self._cols = "*"

    def select(self, cols="*"):
        self.op, self._cols = "select", cols
        return self

    def insert(self, row):
        self.op, self.payload = "insert", row
        return self

    def upsert(self, row, on_conflict=None):
        self.op, self.payload, self.on_conflict = "upsert", row, on_conflict
        return self

    def update(self, values):
        self.op, self.payload = "update", values
        return self

    def eq(self, col, val):
        self.filters.append((col, val))
        return self

    def order(self, col, desc=False):
        self._order = (col, desc)
        return self

    def limit(self, n):
        self._limit = n
        return self

    def execute(self):
        return Result(self.db._execute(self))


class Bucket:
    def __init__(self, db, name):
        self.db, self.name = db, name

    def upload(self, path, file, file_options=None):
        if self.name in self.db.fail_on:
            raise DbError("storage unavailable")
        ctype = (file_options or {}).get("content-type")
        if ctype not in STORAGE_TYPES:
            raise DbError(f"mime type {ctype} not allowed")
        if len(file) > STORAGE_LIMIT:
            raise DbError("object exceeds bucket limit")
        key = (self.name, path)
        if key in self.db.objects:
            raise DbError("object exists")
        self.db.objects[key] = bytes(file)

    def download(self, path):
        return self.db.objects[(self.name, path)]


class Storage:
    def __init__(self, db):
        self.db = db

    def from_(self, name):
        return Bucket(self.db, name)


class FakeSupabase:
    def __init__(self):
        self.rows: dict[str, list[dict]] = {t: [] for t in COLUMNS}
        self.objects: dict[tuple[str, str], bytes] = {}
        self.fail_on: set[str] = set()
        self.storage = Storage(self)
        self._serial = 0

    def table(self, name):
        if name not in COLUMNS:
            raise DbError(f'relation "{name}" does not exist')
        return Query(self, name)

    # ---- enforcement ----------------------------------------------------------------------------------------------

    def _check_row(self, table, row, partial=False):
        unknown = set(row) - COLUMNS[table]
        if unknown:
            raise DbError(f"column(s) {sorted(unknown)} of relation {table} do not exist")
        for (t, col), allowed in CHECKS.items():
            if t == table and col in row and row[col] is not None and row[col] not in allowed:
                raise DbError(f"{table}.{col} violates check constraint: {row[col]!r}")
        if not partial:
            for col in NOT_NULL.get(table, ()):
                if row.get(col) in (None, ""):
                    raise DbError(f"null value in {table}.{col}")
        for col in FK_REPORT.get(table, ()):
            if col in row and not any(r["id"] == row[col] for r in self.rows["reports"]):
                raise DbError(f"{table}.{col} violates foreign key to reports")
        if table == "incident_correlations" and row.get("report_id_a") == row.get("report_id_b"):
            raise DbError("a correlation needs two distinct reports")

    def _conflicts(self, table, row, ignore=None):
        for keys in UNIQUE.get(table, []):
            if all(k in row for k in keys):
                for r in self.rows[table]:
                    if r is not ignore and all(r.get(k) == row[k] for k in keys):
                        return r, keys
        return None, None

    def _execute(self, q: Query):
        if q.table in self.fail_on:
            raise DbError(f"{q.table} unavailable")
        rows = self.rows[q.table]
        match = [r for r in rows if all(r.get(c) == v for c, v in q.filters)]
        if q.op == "select":
            out = [copy.deepcopy(r) for r in match]
            if q._order:
                out.sort(key=lambda r: str(r.get(q._order[0]) or ""), reverse=q._order[1])
            return out[: q._limit] if q._limit else out
        if q.op == "insert":
            row = dict(q.payload)
            self._check_row(q.table, row)
            existing, keys = self._conflicts(q.table, row)
            if existing is not None:
                raise DbError(f"duplicate key value violates unique constraint on {q.table}{keys}")
            if q.table in ("audit_events", "incident_correlations") and "id" not in row:
                self._serial += 1
                row["id"] = self._serial
            row.setdefault("created_at", f"2026-10-11T00:00:{self._serial % 60:02d}+00:00")
            rows.append(row)
            return [copy.deepcopy(row)]
        if q.op == "upsert":
            row = dict(q.payload)
            self._check_row(q.table, row)
            keys = tuple((q.on_conflict or "id").split(","))
            existing = next((r for r in rows if all(r.get(k) == row.get(k) for k in keys)), None)
            if existing is None:
                other, _ = self._conflicts(q.table, row)
                if other is not None:
                    raise DbError("duplicate key value")
                row.setdefault("created_at", "2026-10-11T00:00:00+00:00")
                rows.append(row)
                return [copy.deepcopy(row)]
            if q.table == "audit_events":
                raise DbError("permission denied for UPDATE on audit_events")
            existing.update(row)
            return [copy.deepcopy(existing)]
        if q.op == "update":
            if q.table == "audit_events":
                raise DbError("permission denied for UPDATE on audit_events")
            self._check_row(q.table, q.payload, partial=True)
            for r in match:
                r.update(q.payload)
            return [copy.deepcopy(r) for r in match]
        raise DbError(q.op)
