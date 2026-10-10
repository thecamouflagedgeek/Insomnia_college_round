from fastapi import APIRouter, Depends, HTTPException
from app.core.security import verify_access_token
from app.core.permissions import require_role, Role
from app.core.config import get_settings
from app.core.database import Database, IntegrationUnavailable
from app.schemas.challenge import ChallengeCreate, ChallengeDecision
from app.services.committee_service import create_challenge, decide_challenge, get_challenge

router = APIRouter(prefix="/challenges", tags=["challenges"])


@router.post("", status_code=201)
def create_challenge_endpoint(payload: ChallengeCreate, claims: dict = Depends(verify_access_token)):
    require_role(claims, Role.COMMITTEE, Role.INVESTIGATOR, Role.ADMIN)

    try:
        settings = get_settings()
        db = Database.from_settings(settings)
        if not db.client and not db._test_mode:
            if settings.app_env in {"development", "test"}:
                db = Database.test_adapter()
            else:
                raise IntegrationUnavailable("Supabase service credentials are not configured")

        challenge = create_challenge(payload, claims.get("sub", "unknown"))
        return {"challenge_id": challenge.challenge_id, "status": challenge.status}
    except IntegrationUnavailable as exc:
        raise HTTPException(503, detail={"code": "integration_unavailable", "message": str(exc)}) from None


@router.post("/{challenge_id}/decision")
def decide_challenge_endpoint(challenge_id: str, payload: ChallengeDecision, claims: dict = Depends(verify_access_token)):
    require_role(claims, Role.ADMIN)

    try:
        settings = get_settings()
        db = Database.from_settings(settings)
        if not db.client and not db._test_mode:
            if settings.app_env in {"development", "test"}:
                db = Database.test_adapter()
            else:
                raise IntegrationUnavailable("Supabase service credentials are not configured")

        decided = decide_challenge(challenge_id, payload, claims.get("sub", "unknown"))
        return {"challenge_id": decided.challenge_id, "decision": decided.decision}
    except IntegrationUnavailable as exc:
        raise HTTPException(503, detail={"code": "integration_unavailable", "message": str(exc)}) from None
    except ValueError as exc:
        raise HTTPException(404, detail={"code": "not_found", "message": str(exc)}) from None