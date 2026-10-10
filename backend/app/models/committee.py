from dataclasses import dataclass
@dataclass(frozen=True)
class CommitteeMembership:
    subject: str
    committee_ref: str
    active: bool
