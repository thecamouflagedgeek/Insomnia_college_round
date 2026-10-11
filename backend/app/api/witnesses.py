from fastapi import APIRouter, Depends, HTTPException
from app.core.security import verify_access_token
from app.core.permissions import require_role, Role
from app.core.config import get_settings
from app.core.database import Database, IntegrationUnavailable
from app.schemas.witness import WitnessInvitationCreate, WitnessTokenValidation, WitnessResponse
from app.services.witness_service import create_witness_invitation, validate_witness_token

router = APIRouter(prefix="/witnesses", tags=["witnesses"])


@router.post("/invitations", response_model=WitnessResponse, status_code=201)
def invite_witness(payload: WitnessInvitationCreate, claims: dict = Depends(verify_access_token)):
    require_role(claims, Role.INVESTIGATOR, Role.ADMIN)

    try:
        settings = get_settings()
        db = Database.from_settings(settings)
        if not db.client and not db._test_mode:
            if settings.app_env in {"development", "test"}:
                db = Database.test_adapter()
            else:
                raise IntegrationUnavailable("Supabase service credentials are not configured")

        invitation = create_witness_invitation(payload.report_reference, payload.contact)

        # In production, this would send the token via email
        # For now, return the token (dev only) and invitation ID
        return WitnessResponse(
            status="invitation_created",
            invitation_id=invitation.invitation_id,
        )
    except IntegrationUnavailable as exc:
        raise HTTPException(503, detail={"code": "integration_unavailable", "message": str(exc)}) from None
    except LookupError:
        raise HTTPException(404, detail={"code": "not_found", "message": "Report not found"}) from None


@router.post("/invitations/validate")
def validate_invitation(payload: WitnessTokenValidation, claims: dict = Depends(verify_access_token)):
    """Validate a witness token and return contact info if valid (investigator/admin only)."""
    require_role(claims, Role.INVESTIGATOR, Role.ADMIN)

    try:
        settings = get_settings()
        db = Database.from_settings(settings)
        if not db.client and not db._test_mode:
            if settings.app_env in {"development", "test"}:
                db = Database.test_adapter()
            else:
                raise IntegrationUnavailable("Supabase service credentials are not configured")

        # The witness provides token, investigator provides invitation_id
        # In real usage, the witness would use the token to access a portal
        # Here we validate and return contact for verification
        is_valid, contact = validate_witness_token(payload.token, payload.token, db)
        # Note: In real implementation, the invitation_id would be passed separately
        # This is a simplified validation endpoint

        return {"valid": is_valid, "contact": contact}
    except IntegrationUnavailable as exc:
        raise HTTPException(503, detail={"code": "integration_unavailable", "message": str(exc)}) from None
    except LookupError:
        raise HTTPException(404, detail={"code": "not_found", "message": "Report not found"}) from None