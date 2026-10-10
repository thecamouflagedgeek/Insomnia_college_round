import pytest
from pydantic import ValidationError
from app.schemas.challenge import ChallengeCreate, ChallengeDecision
from app.core.permissions import require_role, Role
from fastapi import HTTPException

def test_challenge_requires_specific_request():
    with pytest.raises(ValidationError):
        ChallengeCreate(report_reference="INC-123456", reason="Conflict", requested_action="unknown")

def test_decision_is_state_value_constrained():
    with pytest.raises(ValidationError):
        ChallengeDecision(decision="pending", rationale="This should not be accepted")

def test_reporter_cannot_make_administrative_decision():
    with pytest.raises(HTTPException) as exc:
        require_role({"sub":"reporter", "user_role":"reporter"}, Role.ADMIN)
    assert exc.value.status_code == 403
