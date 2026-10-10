from pydantic import BaseModel, Field
from typing import Literal

class ChallengeCreate(BaseModel):
    report_reference: str = Field(min_length=8, max_length=80)
    reason: str = Field(min_length=10, max_length=2000)
    requested_action: Literal["reassign", "recusal"]

class ChallengeDecision(BaseModel):
    decision: Literal["accepted", "rejected"]
    rationale: str = Field(min_length=10, max_length=2000)
