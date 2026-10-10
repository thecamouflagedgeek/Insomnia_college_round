from fastapi import APIRouter, Depends, HTTPException
from app.core.security import verify_access_token
from app.core.permissions import require_role, Role
from app.schemas.witness import WitnessInvitationCreate, WitnessTokenValidation
router = APIRouter(prefix="/witnesses", tags=["witnesses"])
@router.post("/invitations", status_code=201)
def invite_witness(payload: WitnessInvitationCreate, claims: dict = Depends(verify_access_token)):
    require_role(claims, Role.INVESTIGATOR, Role.ADMIN)
    raise HTTPException(503, detail={"code":"integration_unavailable","message":"Invitation schema and delivery provider are not configured"})
@router.post("/invitations/validate")
def validate_invitation(payload: WitnessTokenValidation):
    raise HTTPException(503, detail={"code":"integration_unavailable","message":"Invitation persistence is not configured"})
