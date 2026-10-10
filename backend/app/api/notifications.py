from fastapi import APIRouter, Depends
from app.core.security import verify_access_token
router = APIRouter(prefix="/notifications", tags=["notifications"])
@router.get("/status")
def notification_status(claims: dict = Depends(verify_access_token)):
    return {"delivery_configured": False, "mode": "development_stub"}
