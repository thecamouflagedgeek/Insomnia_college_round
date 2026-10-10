from dataclasses import dataclass
@dataclass(frozen=True)
class AuditEvent:
    event_id: str
    event_hash: str
    previous_hash: str | None
