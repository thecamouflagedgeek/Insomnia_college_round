from fastapi import APIRouter, Depends, HTTPException
from app.core.security import verify_access_token
from app.core.permissions import require_role, Role, can_access_report
from app.core.config import get_settings
from app.core.database import Database, IntegrationUnavailable
from app.schemas.message import MessageCreate, MessageResponse
from app.services.messaging_service import send_investigation_message, list_investigation_messages, decrypt_message_body

router = APIRouter(prefix="/messages", tags=["messages"])


@router.post("", response_model=MessageResponse, status_code=201)
def send_message(payload: MessageCreate, claims: dict = Depends(verify_access_token)):
    require_role(claims, Role.INVESTIGATOR, Role.ADMIN)

    try:
        settings = get_settings()
        db = Database.from_settings(settings)
        if not db.client and not db._test_mode:
            if settings.app_env in {"development", "test"}:
                db = Database.test_adapter()
            else:
                raise IntegrationUnavailable("Supabase service credentials are not configured")

        # Check report authorization
        if not can_access_report(claims, {"authorized_investigators": [claims.get("sub")]}):
            raise HTTPException(403, detail={"code": "forbidden", "message": "Not authorized for this report"})

        message = send_investigation_message(payload.report_reference, payload.body, payload.thread_token)
        return MessageResponse(message_id=message.message_id, created_at=str(message.created_at))
    except IntegrationUnavailable as exc:
        raise HTTPException(503, detail={"code": "integration_unavailable", "message": str(exc)}) from None
    except LookupError:
        raise HTTPException(404, detail={"code": "not_found", "message": "Report not found"}) from None


@router.get("/{report_reference}")
def list_messages(report_reference: str, claims: dict = Depends(verify_access_token)):
    require_role(claims, Role.INVESTIGATOR, Role.ADMIN)

    try:
        settings = get_settings()
        db = Database.from_settings(settings)
        if not db.client and not db._test_mode:
            if settings.app_env in {"development", "test"}:
                db = Database.test_adapter()
            else:
                raise IntegrationUnavailable("Supabase service credentials are not configured")

        # Check report authorization
        if not can_access_report(claims, {"authorized_investigators": [claims.get("sub")]}):
            raise HTTPException(403, detail={"code": "forbidden", "message": "Not authorized for this report"})

        messages = list_investigation_messages(report_reference, db)

        # Decrypt messages after authorization
        decrypted_messages = []
        for msg in messages:
            body = decrypt_message_body(msg)
            decrypted_messages.append({
                "message_id": msg.message_id,
                "report_reference": msg.report_reference,
                "body": body,
                "created_at": msg.created_at,
            })

        return {"messages": decrypted_messages}
    except IntegrationUnavailable as exc:
        raise HTTPException(503, detail={"code": "integration_unavailable", "message": str(exc)}) from None
    except LookupError:
        raise HTTPException(404, detail={"code": "not_found", "message": "Report not found"}) from None