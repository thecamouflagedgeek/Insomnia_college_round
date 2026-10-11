from pydantic import BaseModel, Field
from typing import Literal

class ChallengeCreate(BaseModel):
    report_reference: str = Field(min_length=8, max_length=80)
    reason: str = Field(min_length=10, max_length=2000)
    requested_action: Literal["reassign", "recusal"]
    # The challenged committee member (an opaque staff reference). Required to persist a challenge: the canonical
    # committee_challenges.committee_member_ref column has no default, and none is ever invented.
    committee_member_ref: str | None = Field(default=None, min_length=1, max_length=120)

class ChallengeDecision(BaseModel):
    decision: Literal["accepted", "rejected"]
    rationale: str = Field(min_length=10, max_length=2000)
