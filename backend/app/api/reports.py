from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from app.schemas.complaint import ReportCreate, ReportReceipt
from app.core.database import IntegrationUnavailable
from app.core.security import new_public_reference, verify_access_token
from app.core.config import get_settings
from app.services.complaint_service import create_report
from app.services.evidence_service import validate_evidence

router = APIRouter(prefix="/reports", tags=["reports"])

@router.post("", response_model=ReportReceipt, status_code=201, responses={503: {"description": "Supabase schema or credentials unavailable"}}, summary="Submit a report")
def submit_report(payload: ReportCreate):
    try:
        return create_report(payload, new_public_reference())
    except IntegrationUnavailable as exc:
        raise HTTPException(503, detail={"code":"integration_unavailable","message":str(exc)}) from None

@router.get("/{reference}/status", summary="Get report status using its private reference")
def report_status(reference: str):
    raise HTTPException(503, detail={"code":"integration_unavailable","message":"Status lookup requires verified reports schema"})

@router.get("/{reference}", summary="Retrieve report details (investigator only)")
def report_detail(reference: str, claims: dict = Depends(verify_access_token)):
    from app.core.permissions import require_role, Role
    require_role(claims, Role.INVESTIGATOR, Role.ADMIN)
    raise HTTPException(501, detail={"code":"not_implemented","message":"Requires verified schema and role assignment model"})

@router.post("/{reference}/evidence", status_code=202, responses={422: {"description":"Evidence validation failed"}, 503: {"description":"Private storage integration is unavailable"}}, summary="Validate evidence upload (storage awaits schema/auth integration)")
async def upload_evidence(reference: str, file: UploadFile = File(...), claims: dict = Depends(verify_access_token)):
    from app.core.permissions import require_role, Role
    require_role(claims, Role.INVESTIGATOR, Role.ADMIN)
    data = await file.read(get_settings().max_upload_bytes + 1)
    try:
        validate_evidence(file.filename or "", file.content_type or "", data, get_settings().max_upload_bytes)
    except ValueError as exc:
        raise HTTPException(422, detail={"code":"invalid_evidence","message":str(exc)}) from None
    raise HTTPException(503, detail={"code":"integration_unavailable","message":"Upload validated but private Storage access requires report authorization and verified evidence schema"})
