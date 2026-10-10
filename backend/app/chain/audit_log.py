from datetime import datetime, timezone
from typing import Callable

from app.chain.audit_repo import AuditEvent, AuditRepository
from app.chain.hashing import canonical_bytes, case_key, commitment, entry_hash, new_salt

# Data rules: IDs, enums and hashes only. Never reporter identity, never free text
# (store content elsewhere and put its sha256 in "content_sha256").
EVENT_TYPES = frozenset({
    "complaint_submitted",        # {content_sha256, nullifier, proof_tx}
    "evidence_sealed",            # {evidence_id, content_sha256, size, mime}
    "case_classified",            # {category}
    "severity_assessed",          # {level}
    "committee_assigned",         # {committee_id, member_ids}
    "challenge_filed",            # {challenge_id, member_id, nullifier, proof_tx}
    "challenge_decided",          # {challenge_id, decision, reviewer_id}
    "member_replaced",            # {old_member_id, new_member_id}
    "access_revoked",             # {member_id}
    "witness_quorum_started",     # {quorum_id, invited_count}
    "witness_response_recorded",  # {quorum_id, accepted_count, declined_count}
    "inbox_message",              # {message_id, direction, content_sha256}
    "notice_sent",                # {notice_id, template_id}
    "status_changed",             # {from, to}
    "resolution_recorded",        # {resolution_id, content_sha256}
    "export_generated",           # {export_id, content_sha256}
    "reflection_recorded",        # {reflection_id}  (Reflect & Reform; ratings stay off-chain)
})


class AuditLog:
    def __init__(self, repo: AuditRepository, clock: Callable[[], datetime] = lambda: datetime.now(timezone.utc)):
        self._repo = repo
        self._clock = clock

    def record(self, case_id: str, event_type: str, data: dict) -> AuditEvent:
        if event_type not in EVENT_TYPES:
            raise ValueError(f"unknown audit event type {event_type!r}")
        envelope = {"type": event_type, "data": data, "at": self._clock().isoformat(timespec="seconds")}
        canonical_bytes(envelope)  # fail before touching storage
        key = case_key(case_id)

        def build(seq: int, prev: str) -> AuditEvent:
            salt = new_salt()
            c = commitment(salt, envelope)
            return AuditEvent(case_id, seq, event_type, envelope, salt, c, prev, entry_hash(key, prev, seq, c))

        return self._repo.append(case_id, build)
