from fastapi import APIRouter, Depends, HTTPException
from app.core.security import verify_access_token
from app.core.permissions import require_role, Role
from app.core.config import get_settings
from app.core.database import Database, IntegrationUnavailable
from app.services.audit_service import verify_chain

router = APIRouter(prefix="/audit", tags=["audit"])


@router.get("")
def timeline(claims: dict = Depends(verify_access_token)):
    require_role(claims, Role.INVESTIGATOR, Role.ADMIN, Role.COMMITTEE)

    try:
        settings = get_settings()
        db = Database.from_settings(settings)
        if not db.client and not db._test_mode:
            if settings.app_env in {"development", "test"}:
                db = Database.test_adapter()
            else:
                raise IntegrationUnavailable("Supabase service credentials are not configured")

        if db._test_mode:
            events = db.test_list("audit_events")
            event_list = [e.data["event"] for e in events]
            # Add hash chain for verification
            verified = verify_chain(event_list) if event_list else True
            return {
                "events": event_list,
                "verified": verified,
                "count": len(event_list),
            }
        else:
            client = db.require_schema()
            raise IntegrationUnavailable("Production retrieval not yet implemented")
    except IntegrationUnavailable as exc:
        raise HTTPException(503, detail={"code": "integration_unavailable", "message": str(exc)}) from None


@router.post("/verify")
def verify_audit_chain(claims: dict = Depends(verify_access_token)):
    """Verify the integrity of the audit chain."""
    require_role(claims, Role.INVESTIGATOR, Role.ADMIN, Role.COMMITTEE)

    try:
        settings = get_settings()
        db = Database.from_settings(settings)
        if not db.client and not db._test_mode:
            if settings.app_env in {"development", "test"}:
                db = Database.test_adapter()
            else:
                raise IntegrationUnavailable("Supabase service credentials are not configured")

        if db._test_mode:
            events = db.test_list("audit_events")
            event_list = [e.data["event"] for e in events]
            verified = verify_chain(event_list)
            return {"verified": verified, "event_count": len(event_list)}
        else:
            raise IntegrationUnavailable("Production verification not yet implemented")
    except IntegrationUnavailable as exc:
        raise HTTPException(503, detail={"code": "integration_unavailable", "message": str(exc)}) from None