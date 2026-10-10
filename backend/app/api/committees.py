from fastapi import APIRouter, Depends, HTTPException
from app.core.security import verify_access_token
router = APIRouter(prefix="/committees", tags=["committees"])
@router.get("", summary="List authorized committees")
def list_committees(claims: dict = Depends(verify_access_token)):
    raise HTTPException(503, detail={"code":"integration_unavailable","message":"Committee schema and membership model are not verified"})
