from fastapi import APIRouter, Depends, HTTPException
from app.core.security import verify_access_token
from app.schemas.message import MessageCreate
router = APIRouter(prefix="/messages", tags=["messages"])
@router.post("", status_code=201)
def send_message(payload: MessageCreate, claims: dict = Depends(verify_access_token)):
    raise HTTPException(503, detail={"code":"integration_unavailable","message":"Messaging persistence and thread authorization are not configured"})
@router.get("/{report_reference}")
def list_messages(report_reference: str, claims: dict = Depends(verify_access_token)):
    raise HTTPException(503, detail={"code":"integration_unavailable","message":"Messaging persistence and report authorization are not configured"})
