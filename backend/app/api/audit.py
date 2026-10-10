from fastapi import APIRouter, Depends, HTTPException
from app.core.security import verify_access_token
from app.core.permissions import require_role, Role
router = APIRouter(prefix="/audit", tags=["audit"])
@router.get("")
def timeline(claims: dict = Depends(verify_access_token)):
    require_role(claims, Role.INVESTIGATOR, Role.ADMIN, Role.COMMITTEE)
    raise HTTPException(503, detail={"code":"integration_unavailable","message":"Audit schema is unverified"})
