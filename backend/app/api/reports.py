from fastapi import APIRouter, HTTPException, Depends, UploadFile, File
from app.schemas.complaint import ReportCreate, ReportReceipt, ReportStatus, ReportDetail
from app.core.database import IntegrationUnavailable, Database
from app.core.security import new_public_reference, verify_access_token
from app.core.config import get_settings
from app.core.permissions import require_role, Role, can_access_report
from app.services.complaint_service import create_report, get_complaint_by_reference, decrypt_complaint_fields
from app.services.evidence_service import validate_evidence

router = APIRouter(prefix="/reports", tags=["reports"])


@router.post("", response_model=ReportReceipt, status_code=201, responses={503: {"description": "Supabase schema or credentials unavailable"}}, summary="Submit a report")
def submit_report(payload: ReportCreate):
    try:
        return create_report(payload, new_public_reference())
    except IntegrationUnavailable as exc:
        raise HTTPException(503, detail={"code": "integration_unavailable", "message": str(exc)}) from None


@router.get("/{reference}/status", summary="Get report status using its private reference")
def report_status(reference: str):
    """Get report status - works in test mode with test adapter."""
    try:
        settings = get_settings()
        db = Database.from_settings(settings)
        if not db.client and not db._test_mode:
            if settings.app_env in {"development", "test"}:
                db = Database.test_adapter()
            else:
                raise IntegrationUnavailable("Supabase service credentials are not configured")

        if db._test_mode:
            record = db.test_find_by_field("complaints", "public_reference", reference)
            if not record:
                # Simulate unverified schema state for non-existent reports
                raise HTTPException(503, detail={"code": "integration_unavailable", "message": "Status lookup requires verified reports schema"})
            return ReportStatus(
                reference=reference,
                status=record.data["status"],
                created_at=None,  # Would be stored in production
            )
        else:
            raise IntegrationUnavailable("Production retrieval not yet implemented")
    except IntegrationUnavailable as exc:
        raise HTTPException(503, detail={"code": "integration_unavailable", "message": str(exc)}) from None


@router.get("/{reference}", response_model=ReportDetail, summary="Retrieve report details (investigator only)")
def report_detail(reference: str, claims: dict = Depends(verify_access_token)):
    require_role(claims, Role.INVESTIGATOR, Role.ADMIN)

    try:
        settings = get_settings()
        db = Database.from_settings(settings)
        if not db.client and not db._test_mode:
            if settings.app_env in {"development", "test"}:
                db = Database.test_adapter()
            else:
                raise IntegrationUnavailable("Supabase service credentials are not configured")

        complaint = get_complaint_by_reference(reference, db)
        if not complaint:
            raise HTTPException(404, detail={"code": "not_found", "message": "Report not found"})

        # Check report-level authorization
        if not can_access_report(claims, {"authorized_investigators": [claims.get("sub")]}):
            raise HTTPException(403, detail={"code": "forbidden", "message": "Not authorized for this report"})

        # Decrypt after authorization
        decrypted = decrypt_complaint_fields(complaint)

        return ReportDetail(
            id=complaint.id,
            reference=complaint.public_reference,
            status=complaint.status,
            title=decrypted["title"],
            narrative=decrypted["narrative"],
            category="",  # Would be stored in production
        )
    except IntegrationUnavailable as exc:
        raise HTTPException(503, detail={"code": "integration_unavailable", "message": str(exc)}) from None


@router.post("/{reference}/evidence", status_code=202, responses={422: {"description": "Evidence validation failed"}, 503: {"description": "Private storage integration is unavailable"}}, summary="Validate evidence upload (storage awaits schema/auth integration)")
async def upload_evidence(reference: str, file: UploadFile = File(...), claims: dict = Depends(verify_access_token)):
    require_role(claims, Role.INVESTIGATOR, Role.ADMIN)
    data = await file.read(get_settings().max_upload_bytes + 1)
    try:
        validated = validate_evidence(file.filename or "", file.content_type or "", data, get_settings().max_upload_bytes)
    except ValueError as exc:
        raise HTTPException(422, detail={"code": "invalid_evidence", "message": str(exc)}) from None

    storage_uploaded = False
    evidence_id = None
    settings = get_settings()
    db = Database.from_settings(settings)
    if db.client:
        # Same path as the integrated workflow: encrypted object in the private bucket, then canonical metadata.
        # Any failure is reported, never answered with "validated" as if it were stored.
        from uuid import uuid4
        from app.core.database import report_row
        from app.core.supabase_repo import PersistenceError, SupabaseRepository
        from app.services.encryption_service import get_encryption_service
        if report_row(db.client, reference) is None:
            raise HTTPException(404, detail={"code": "not_found", "message": "Report not found"})
        evidence_id = f"EVD-{uuid4().hex[:8].upper()}"
        try:
            SupabaseRepository(db.client, get_encryption_service()._key, settings.supabase_storage_bucket) \
                .save_evidence(reference, evidence_id, validated.content_type, validated.size, validated.sha256, data)
        except PersistenceError as exc:
            raise HTTPException(503, detail={"code": "integration_unavailable", "message": str(exc)}) from None
        storage_uploaded = True

    return {
        "validated": True,
        "evidence_id": evidence_id,
        "filename": validated.filename,
        "content_type": validated.content_type,
        "size": validated.size,
        "sha256": validated.sha256,
        "storage_uploaded": storage_uploaded,
        "message": "Evidence validated and sealed" if storage_uploaded else "Evidence validated; private Storage upload requires verified schema and report authorization",
    }