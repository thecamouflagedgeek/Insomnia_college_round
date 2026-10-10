from fastapi import APIRouter, Depends, HTTPException
from app.core.security import verify_access_token
from app.core.permissions import require_role, Role
router = APIRouter(prefix="/exports", tags=["exports"])
@router.get("/{report_reference}.pdf")
def export_report(report_reference: str, claims: dict = Depends(verify_access_token)):
    require_role(claims, Role.INVESTIGATOR, Role.ADMIN)
    raise HTTPException(503, detail={"code":"integration_unavailable","message":"Export requires verified report, evidence, audit, and authorization schemas"})
