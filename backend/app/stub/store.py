import base64
import hashlib
import json
import logging
import os
import secrets
import threading
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from app.services.encryption_service import EncryptedField, EncryptionService

logger = logging.getLogger("incognito.store")

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
    "usr_maya": {"name": "Dr. Maya Lin", "role": "committee_member",
                 "title": "Presiding Officer (Internal Committee)", "department": "People Operations"},
    "usr_tariq": {"name": "Tariq Mansoor", "role": "committee_member",
                  "title": "Chief Compliance & Integrity Officer", "department": "Ethics & Compliance"},
    "usr_kenneth": {"name": "Kenneth Cole", "role": "committee_member",
                    "title": "Director of Workplace Conflict Resolution", "department": "People & Culture"},
    "usr_sandra": {"name": "Sandra Bullock-Lee", "role": "committee_member",
                   "title": "Senior Investigator (People Relations)", "department": "Ethics Unit"},
    "usr_rachel": {"name": "Rachel Adams", "role": "committee_member",
                   "title": "Global Head of Diversity & Inclusion", "department": "D&I Directorate"},
    "usr_carlos": {"name": "Carlos Mendoza", "role": "committee_member",
                   "title": "Lead Compensation & Equity Analyst", "department": "Total Rewards"},
    "usr_fatima": {"name": "Fatima Al-Hassan", "role": "committee_member",
                   "title": "Senior Labor Relations Director", "department": "Employee Relations"},
    "usr_meera": {"name": "Advocate Meera Deshmukh", "role": "committee_member",
                  "title": "External Legal Member (POSH Specialist)", "department": "External Statutory Panel"},
    "usr_arthur": {"name": "Hon. Arthur Vance (Retd.)", "role": "independent_reviewer",
                   "title": "Senior Appellate Ombuds Counsel", "department": "External Review Board"},
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
    # Integrity cues for reviewers (app.stub.evidence_check) and the upload's own hash, used only to spot the same
    # file filed on another case. Neither reveals capture time, place or device.
    flags: list[dict] = field(default_factory=list)
    original_sha256: str = ""
    phash: str = ""  # image difference hash, for near-duplicates across cases


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
    """Canonical workflow state store. Persists to real Supabase database when configured,
    and mirrors to an encrypted AES-256 state file in development/demo mode so restarts keep cases
    whose audit events live in Postgres/on-chain."""

    def __init__(self, path: str | None = None, encryption_key: bytes | None = None, seed_demo: bool = True, supabase: Any | None = None):
        self._path = Path(path) if path else None
        if self._path and encryption_key is None:
            raise RuntimeError("STUB_STATE_PATH needs ENCRYPTION_KEY: the state file holds report content")
        # AES-256-GCM service; each field is bound to its record and field name (associated data).
        self._crypto = EncryptionService(encryption_key) if encryption_key else None
        self._lock = threading.RLock()
        self.cases: dict[str, Case] = {}
        self.invitations: dict[str, Invitation] = {}
        self._extensions: dict[str, tuple] = {}
        self._pending_ext: dict[str, str] = {}
        self.supabase = supabase
        # Fault isolation. problems: records/tables that could not be loaded (each disables only itself).
        # persistence_down: the database cannot take writes; every write is refused with 503 while reads, enrolment
        # and proofs keep working.
        self.persistence_problems: list[str] = []
        self.persistence_down: str | None = None

        # Supabase, when configured, is the source of truth for cases: the state file then keeps only extension
        # state (e.g. the offline chain's nullifiers), and demo data is never seeded into a real database.
        if self._path and self._path.exists():
            self._load(cases=self.supabase is None)

        if self.supabase:
            self._load_from_supabase()  # raises PersistenceError: never start on silently missing data
        elif not self.cases and seed_demo:
            self._seed()
            if self._path:
                self.save()

    @property
    def is_durable(self) -> bool:
        return self.supabase is not None or (self._path is not None and self._crypto is not None)

    @property
    def persistent(self) -> bool:
        return self.supabase is not None or self._path is not None

    @property
    def path(self) -> Path | None:
        return self._path

    def attach(self, name: str, dump, load) -> None:
        """Persist dump() under `name`; a value already in the state file is handed to load() right away."""
        self._extensions[name] = (dump, load)
        if name in self._pending_ext and self._crypto:
            try:
                load(json.loads(self._crypto.decrypt_field(EncryptedField(self._pending_ext.pop(name), f"ext:{name}:state"),
                                                           "ext", name, "state")))
            except Exception:
                pass

    def _seed(self) -> None:
        c892 = Case(
            case_id="INC-892",
            token_hash=token_hash("tok_inc892_demo"),
            raw_payload=json.dumps({
                "category": "Retaliation",
                "title": "Repeated Retaliation and Rating Downgrade Post-Safety Disclosure",
                "description": "Reporting manager systematically stripped project responsibilities, scheduled punitive isolation reviews, and threatened immigration sponsorship status following disclosure of safety audit manipulation in Operations.",
                "incident_date": "2026-10-09",
                "client_nonce": "nonce_inc892_seed",
            }),
            status="under_challenge",
            created_at="2026-10-09T08:30:00Z",
            committee=[committee_entry("usr_marcus"), committee_entry("usr_david"), committee_entry("usr_priya")],
            investigator_id=DEFAULT_INVESTIGATOR,
            nullifier="0x1904bbca418023190afb201199a4c8109",
            proof_tx="0x9482f012cc8a41289df71900bfa2210499e984210aef",
            severity={"level": "critical", "signals": ["Direct retaliation risk", "Immigration vulnerability"]},
            evidence=[
                Evidence("ev-892-1", "redacted_performance_overrides_q3.pdf", "application/pdf", 2516582, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", ""),
                Evidence("ev-892-2", "secure_chat_export_signed_logs.json", "application/json", 491520, "4a6b22194d3e8e1248086202c4b22c2a4980bb66971fcb4e39a55225ef6eb792", "")
            ],
            challenges=[
                ChallengeRec("CH-104", "usr_marcus", "Professional relationship", "Marcus Vance is the direct skip-level manager of the accused party and directly oversees the departmental bonus pool cited in the alleged retaliation scheme. Appointing him to the adjudicating committee creates an insurmountable conflict of interest.", "pending_review", "0x9948201bc019248102948bc0192481029481092a", "2026-10-09T10:14:00Z")
            ],
            messages=[
                Message("msg-1", "investigator", "Secure channel established. Can you confirm if you still have local copies of the quarterly evaluation drafts prior to the override?", "2026-10-09T14:10:00Z"),
                Message("msg-2", "you", "Yes, cryptographic hashes of the original drafts with supervisor sign-off have been committed to the secure evidence vault.", "2026-10-09T14:28:00Z")
            ]
        )
        c741 = Case(
            case_id="INC-741",
            token_hash=token_hash("tok_inc741_demo"),
            raw_payload=json.dumps({
                "category": "Sexual Harassment",
                "title": "Persistent Inappropriate Advances and Promotion Coercion",
                "description": "Senior director repeatedly made unsolicited advances during off-site symposium and linked executive sponsorship for upcoming promotion committee to compliance.",
                "incident_date": "2026-10-05",
                "client_nonce": "nonce_inc741_seed",
            }),
            status="investigating",
            created_at="2026-10-05T14:15:00Z",
            committee=[committee_entry("usr_david"), committee_entry("usr_maya"), committee_entry("usr_priya")],
            investigator_id=DEFAULT_INVESTIGATOR,
            nullifier="0x4990cba190014bf99214a802911bca09",
            proof_tx="0x5512bca01994afc09121a884efb204918230bc71a804",
            severity={"level": "critical", "signals": ["Quid pro quo coercion", "Leadership hierarchy"]}
        )
        c650 = Case(
            case_id="INC-650",
            token_hash=token_hash("tok_inc650_demo"),
            raw_payload=json.dumps({
                "category": "Discrimination",
                "title": "Systemic Exclusion in Compensation Bands and Promotion Velocity",
                "description": "Documentation showing minority engineers systematically clustered in lower compensation tier bands despite equivalent tenure and superior peer review distributions.",
                "incident_date": "2026-10-02",
                "client_nonce": "nonce_inc650_seed",
            }),
            status="committee_assigned",
            created_at="2026-10-02T11:00:00Z",
            committee=[committee_entry("usr_kenneth"), committee_entry("usr_sandra"), committee_entry("usr_tariq")],
            investigator_id=DEFAULT_INVESTIGATOR,
            nullifier="0x884019ba400192ca488190203a9810bb",
            proof_tx="0x33108ba1940bc201488102948bc0991aef80231bca02",
            severity={"level": "high", "signals": ["Systemic wage disparity", "Tenure divergence"]}
        )
        c512 = Case(
            case_id="INC-512",
            token_hash=token_hash("tok_inc512_demo"),
            raw_payload=json.dumps({
                "category": "Fraud",
                "title": "Vendor Procurement Kickback and Subcontracting Manipulation",
                "description": "Procurement manager established shell consulting entity to capture non-competitive hardware procurement contracts totaling $1.2M.",
                "incident_date": "2026-09-28",
                "client_nonce": "nonce_inc512_seed",
            }),
            status="investigating",
            created_at="2026-09-28T16:45:00Z",
            committee=[committee_entry("usr_tariq"), committee_entry("usr_david"), committee_entry("usr_priya")],
            investigator_id=DEFAULT_INVESTIGATOR,
            nullifier="0x330192481092bc019248102948bc0192",
            proof_tx="0x77102948102bc01948201948bc019248102948bc0192",
            severity={"level": "high", "signals": ["Non-competitive procurement", "Shell vendor entity"]}
        )
        self.cases = {c.case_id: c for c in [c892, c741, c650, c512]}
        self.invitations = {
            "WIT-01": Invitation("WIT-01", "INC-892", token_hash("wit_code_1"), "Voluntary workplace investigation interview invitation.", response="accept", alias="Witness A (Senior Engineer)", invited_at="2026-10-09T09:00:00Z", responded_at="2026-10-09T11:30:00Z"),
            "WIT-02": Invitation("WIT-02", "INC-892", token_hash("wit_code_2"), "Voluntary workplace investigation interview invitation.", response="accept", alias="Witness B (Operations Lead)", invited_at="2026-10-09T09:00:00Z", responded_at="2026-10-09T12:00:00Z"),
            "WIT-03": Invitation("WIT-03", "INC-892", token_hash("wit_code_3"), "Voluntary workplace investigation interview invitation.", response=None, alias="Witness C (HR Associate)", invited_at="2026-10-09T09:15:00Z"),
            "WIT-04": Invitation("WIT-04", "INC-892", token_hash("wit_code_4"), "Voluntary workplace investigation interview invitation.", response=None, alias="Witness D (Staff SRE)", invited_at="2026-10-09T09:15:00Z"),
        }

    def attach(self, name: str, dump, load) -> None:
        """Persist dump() under `name`; a value already in the state file is handed to load() right away."""
        self._extensions[name] = (dump, load)
        if name in self._pending_ext:
            load(json.loads(self._crypto.decrypt_field(EncryptedField(self._pending_ext.pop(name), f"ext:{name}:state"),
                                                       "ext", name, "state")))

    def save(self) -> None:
        """Mirror to the encrypted state file. Supabase writes are explicit, per operation (app.stub.persist)."""
        with self._lock:
            if not self._path:
                return
            with_cases = self.supabase is None
            data = {
                "cases": [self._seal(asdict(c)) for c in self.cases.values()] if with_cases else [],
                "invitations": [asdict(i) for i in self.invitations.values()] if with_cases else [],
            }
            if self._crypto and self._extensions:
                data["extensions"] = {
                    name: self._crypto.encrypt_field(json.dumps(dump()), "ext", name, "state").ciphertext
                    for name, (dump, _) in self._extensions.items()
                }
            tmp = self._path.with_suffix(".tmp")
            tmp.write_text(json.dumps(data))
            os.replace(tmp, self._path)

    def _load(self, cases: bool = True) -> None:
        data = json.loads(self._path.read_text())
        self._pending_ext = dict(data.get("extensions", {}))
        if not cases:
            return
        for c in data.get("cases", []):
            c = self._open(c)
            c["evidence"] = [Evidence(**e) for e in c["evidence"]]
            c["challenges"] = [ChallengeRec(**x) for x in c["challenges"]]
            c["messages"] = [Message(**m) for m in c["messages"]]
            self.cases[c["case_id"]] = Case(**c)
        for i in data.get("invitations", []):
            self.invitations[i["invitation_id"]] = Invitation(**i)
        self._pending_ext = dict(data.get("extensions", {}))

    def _load_from_supabase(self) -> None:
        try:
            state = self.supabase.load()
        except Exception:
            self.persistence_down = "database unreachable at startup"
            return
        self.persistence_problems = list(state.problems)
        if state.down:
            self.persistence_down = "database unreachable at startup"
        bad = 0
        for r in state.reports:
            try:
                self._case_from_row(r, state)
            except Exception:
                bad += 1
        if bad:
            self.persistence_problems.append(f"reports: {bad} could not be rebuilt and were skipped")
        for inv in state.invitations:
            try:
                self.invitations[inv["invitation_id"]] = Invitation(**inv)
            except Exception:
                self.persistence_problems.append("witness_invitations: a record could not be rebuilt")

    def _case_from_row(self, r: dict, state) -> None:
        cid = r["case_id"]
        names = r.get("evidence_names") or {}
        self.cases[cid] = Case(
            case_id=cid, token_hash=r["token_hash"], raw_payload=r["raw_payload"], status=r["status"],
            created_at=r["created_at"], committee=[committee_entry(m) for m in r["committee"] if m in STAFF],
            investigator_id=r["investigator_id"], revoked_ids=list(r["revoked_ids"]),
            nullifier=r["nullifier"], proof_tx=r["proof_tx"], severity=r["severity"] or {},
            integrity_flags=list(r["integrity_flags"]), subject_ref=r["subject_ref"],
            fingerprint=r["fingerprint"], resolution=r["resolution"], reflection=r["reflection"],
            # File content stays in private storage until needed (verification, viewing).
            evidence=[Evidence(e["evidence_id"], names.get(e["evidence_id"], e["evidence_id"]), e["mime"],
                               e["size"], e["sha256"], "") for e in state.evidence.get(cid, [])],
            challenges=[ChallengeRec(**ch) for ch in state.challenges.get(cid, [])],
            messages=[Message(m["message_id"], m["sender"], m["text"], m["at"])
                      for m in state.messages.get(cid, [])],
        )

    def evidence_content(self, case_id: str, ev: "Evidence") -> bytes:
        """The stored (cleaned) evidence bytes: in memory, or fetched from private storage and decrypted."""
        if ev.content_b64:
            return base64.b64decode(ev.content_b64)
        if self.supabase:
            return self.supabase.evidence_content(case_id, ev.evidence_id)
        return b""

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
    def persistent(self) -> bool:
        return self._path is not None

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
        if ev is None:
            return None
        try:
            return self.evidence_content(case_id, ev)
        except Exception:
            return None  # unreadable storage shows as a verification failure, never as a pass

    def message_bytes(self, case_id: str, data: dict) -> bytes | None:
        case = self.cases.get(case_id)
        msg = next((m for m in case.messages if m.message_id == data.get("message_id")), None) if case else None
        return msg.text.encode("utf-8") if msg else None
