from dataclasses import dataclass
from uuid import UUID
@dataclass(frozen=True)
class Complaint:
    id: UUID
    public_reference: str
    encrypted_title: str
    encrypted_narrative: str
    status: str
