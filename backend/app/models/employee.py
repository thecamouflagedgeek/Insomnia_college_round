"""Identity metadata; deliberately contains no direct report foreign key."""
from dataclasses import dataclass
@dataclass(frozen=True)
class EmployeeIdentity:
    auth_subject: str
    role: str
