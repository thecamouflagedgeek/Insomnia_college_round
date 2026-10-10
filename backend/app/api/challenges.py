from fastapi import APIRouter, Depends, HTTPException
from app.core.security import verify_access_token
from app.core.permissions import require_role, Role
from app.schemas.challenge import ChallengeCreate, ChallengeDecision
router = APIRouter(prefix="/challenges", tags=["challenges"])
@router.post("", status_code=201)
def create_challenge(payload: ChallengeCreate, claims: dict = Depends(verify_access_token)):
    require_role(claims, Role.COMMITTEE, Role.INVESTIGATOR, Role.ADMIN)
    raise HTTPException(503, detail={"code":"integration_unavailable","message":"Challenge state and schema are not verified"})
@router.post("/{challenge_id}/decision")
def decide_challenge(challenge_id: str, payload: ChallengeDecision, claims: dict = Depends(verify_access_token)):
    require_role(claims, Role.ADMIN)
    raise HTTPException(503, detail={"code":"integration_unavailable","message":"Challenge state and schema are not verified"})
