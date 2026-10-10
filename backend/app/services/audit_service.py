from typing import Any
from app.utils.hashing import canonical_json, sha256_hex

def event_hash(event: dict[str, Any], previous_hash: str | None) -> str:
    return sha256_hex(canonical_json({"event": event, "previous_hash": previous_hash}))

def verify_chain(events: list[dict[str, Any]]) -> bool:
    previous = None
    for row in events:
        if row.get("previous_hash") != previous or row.get("event_hash") != event_hash(row["event"], previous): return False
        previous = row["event_hash"]
    return True

class AuditChain:
    """Process-local development helper only; not durable or concurrency safe."""
    def __init__(self): self.events = []
    def append(self, event: dict[str, Any]) -> dict[str, Any]:
        previous = self.events[-1]["event_hash"] if self.events else None
        row = {"event": event, "previous_hash": previous, "event_hash": event_hash(event, previous)}
        self.events.append(row)
        return row
