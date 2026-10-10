import base64
import hashlib
import json
import os
import secrets
import threading
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path

from app.services.encryption_service import EncryptedField, EncryptionService

# Staff directory: the same people as the HR dashboard's demo users (web/src/types/auth.ts), so a staff member's
# id means the same thing in the app, the dashboard and the audit trail. M2's real auth replaces this.
STAFF = {
    "usr_sarah": {"name": "Sarah Jenkins", "role": "hr_reviewer", "title": "Senior HR Operations & Compliance Lead",
                  "department": "People & Culture"},
    "usr_elena": {"name": "Elena Rostova", "role": "assigned_investigator",
                  "title": "Lead Workplace Misconduct Investigator", "department": "Independent Ethics Unit"},
    "usr_marcus": {"name": "Marcus Vance", "role": "committee_member", "title": "VP of Engineering Operations",
                   "department": "Engineering Operations"},
    "usr_david": {"name": "David Kim", "role": "committee_member", "title": "Associate General Counsel (Labor)",
                  "department": "Legal Counsel"},
    "usr_priya": {"name": "Priya Sundaram", "role": "committee_member",
                  "title": "Senior Director of People Relations", "department": "People Relations"},
    "usr_aris": {"name": "Dr. Aris Thorne", "role": "independent_reviewer",
                 "title": "Independent Ombudsperson & Challenge Adjudicator", "department": "External Oversight Panel"},
}
DEFAULT_COMMITTEE = ["usr_marcus", "usr_david"]
DEFAULT_INVESTIGATOR = "usr_elena"
DEFAULT_REPLACEMENT = "usr_priya"


def committee_entry(staff_id: str) -> dict:
    s = STAFF[staff_id]
    return {"member_id": staff_id, "name": s["name"], "role": s["title"]}


COMMITTEE = [committee_entry(i) for i in DEFAULT_COMMITTEE]


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def token_hash(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def new_id(prefix: str) -> str:
    return f"{prefix}-{secrets.token_hex(4).upper()}"


@dataclass
class Message:
    message_id: str
    sender: str  # "you" | "investigator"
    text: str
    at: str


@dataclass
class Evidence:
    evidence_id: str
    name: str
    mime: str
    size: int
    sha256: str
    content_b64: str


@dataclass
class ChallengeRec:
    challenge_id: str
    member_id: str
    reason: str
    explanation: str
    status: str  # pending_review | upheld | rejected
    proof_tx: str
    at: str
    reviewer_id: str | None = None
    rationale: str | None = None
    decided_at: str | None = None


@dataclass
class Invitation:
    invitation_id: str
    case_id: str
    code_hash: str
    context: str
    response: str | None = None
    alias: str = "Witness"
    invited_at: str = ""
    responded_at: str | None = None


@dataclass
class Case:
    case_id: str
    token_hash: str
    raw_payload: str
    status: str
    created_at: str
    committee: list[dict] = field(default_factory=lambda: [dict(m) for m in COMMITTEE])
    investigator_id: str = DEFAULT_INVESTIGATOR
    revoked_ids: list[str] = field(default_factory=list)
    nullifier: str = ""
    proof_tx: str = ""
    severity: dict = field(default_factory=dict)
    integrity_flags: list[str] = field(default_factory=list)
    subject_ref: str | None = None
    fingerprint: str = ""
    resolution: dict | None = None
    reflection: dict | None = None
    evidence: list[Evidence] = field(default_factory=list)
    challenges: list[ChallengeRec] = field(default_factory=list)
    messages: list[Message] = field(default_factory=list)

    @property
    def payload(self) -> dict:
        return json.loads(self.raw_payload)


class StubStore:
    """Process-local workflow state, optionally mirrored to a JSON file so a restart keeps cases whose audit
    events already live in Postgres/on-chain. Never stores reporter identity: only a hash of the case token."""

    def __init__(self, path: str | None = None, encryption_key: bytes | None = None):
        self._path = Path(path) if path else None
        if self._path and encryption_key is None:
            raise RuntimeError("STUB_STATE_PATH needs ENCRYPTION_KEY: the state file holds report content")
        # M3's AES-256-GCM service; each field is bound to its record and field name (associated data).
        self._crypto = EncryptionService(encryption_key) if encryption_key else None
        self._lock = threading.RLock()
        self.cases: dict[str, Case] = {}
        self.invitations: dict[str, Invitation] = {}
        if self._path and self._path.exists():
            self._load()

    def save(self) -> None:
        if not self._path:
            return
        with self._lock:
            data = {"cases": [self._seal(asdict(c)) for c in self.cases.values()],
                    "invitations": [asdict(i) for i in self.invitations.values()]}
            tmp = self._path.with_suffix(".tmp")
            tmp.write_text(json.dumps(data))
            os.replace(tmp, self._path)

    def _load(self) -> None:
        data = json.loads(self._path.read_text())
        for c in data.get("cases", []):
            c = self._open(c)
            c["evidence"] = [Evidence(**e) for e in c["evidence"]]
            c["challenges"] = [ChallengeRec(**x) for x in c["challenges"]]
            c["messages"] = [Message(**m) for m in c["messages"]]
            self.cases[c["case_id"]] = Case(**c)
        for i in data.get("invitations", []):
            self.invitations[i["invitation_id"]] = Invitation(**i)

    # Sensitive fields are encrypted in the state file and plaintext only in memory.
    def _enc(self, value: str, case_id: str, name: str) -> str:
        return self._crypto.encrypt_field(value, "case", case_id, name).ciphertext if value else value

    def _dec(self, value: str, case_id: str, name: str) -> str:
        if not value:
            return value
        return self._crypto.decrypt_field(EncryptedField(value, f"case:{case_id}:{name}"), "case", case_id, name)

    def _transform(self, c: dict, f) -> dict:
        cid = c["case_id"]
        c["raw_payload"] = f(c["raw_payload"], cid, "raw_payload")
        for m in c["messages"]:
            m["text"] = f(m["text"], cid, f"message:{m['message_id']}")
        for e in c["evidence"]:
            e["content_b64"] = f(e["content_b64"], cid, f"evidence:{e['evidence_id']}")
        for ch in c["challenges"]:
            ch["explanation"] = f(ch["explanation"], cid, f"challenge:{ch['challenge_id']}")
        if c.get("resolution"):
            c["resolution"]["summary"] = f(c["resolution"]["summary"], cid, "resolution")
        return c

    def _seal(self, c: dict) -> dict:
        return self._transform(c, self._enc)

    def _open(self, c: dict) -> dict:
        return self._transform(c, self._dec)

    @property
    def lock(self) -> threading.RLock:
        return self._lock

    def case_by_token(self, case_id: str, token: str) -> Case | None:
        case = self.cases.get(case_id)
        if case and secrets.compare_digest(case.token_hash, token_hash(token)):
            return case
        return None

    # Content loaders for CaseVerifier: return the stored bytes an audit event's content_sha256 committed to.
    def complaint_bytes(self, case_id: str, data: dict) -> bytes | None:
        case = self.cases.get(case_id)
        return case.raw_payload.encode("utf-8") if case else None

    def evidence_bytes(self, case_id: str, data: dict) -> bytes | None:
        case = self.cases.get(case_id)
        ev = next((e for e in case.evidence if e.evidence_id == data.get("evidence_id")), None) if case else None
        return base64.b64decode(ev.content_b64) if ev else None

    def message_bytes(self, case_id: str, data: dict) -> bytes | None:
        case = self.cases.get(case_id)
        msg = next((m for m in case.messages if m.message_id == data.get("message_id")), None) if case else None
        return msg.text.encode("utf-8") if msg else None
