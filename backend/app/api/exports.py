from fastapi import APIRouter, Depends, HTTPException, Response
from app.core.security import verify_access_token
from app.core.permissions import require_role, Role, can_access_report
from app.core.config import get_settings
from app.core.database import Database, IntegrationUnavailable
from app.services.complaint_service import get_complaint_by_reference, decrypt_complaint_fields
from app.services.messaging_service import list_investigation_messages, decrypt_message_body
from app.utils.pdf_generator import investigation_pdf

router = APIRouter(prefix="/exports", tags=["exports"])


@router.get("/{report_reference}.pdf")
def export_report(report_reference: str, claims: dict = Depends(verify_access_token)):
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

        # Get and decrypt complaint
        complaint = get_complaint_by_reference(report_reference, db)
        if not complaint:
            raise HTTPException(404, detail={"code": "not_found", "message": "Report not found"})

        decrypted = decrypt_complaint_fields(complaint)

        # Get and decrypt messages
        messages = list_investigation_messages(report_reference, db)
        decrypted_messages = []
        for msg in messages:
            body = decrypt_message_body(msg)
            decrypted_messages.append({
                "message_id": msg.message_id,
                "created_at": msg.created_at,
                "body": body,
            })

        # Build PDF sections
        sections = [
            ("Complaint Title", decrypted["title"]),
            ("Complaint Narrative", decrypted["narrative"]),
            ("Status", complaint.status),
            ("Reference", complaint.public_reference),
        ]

        # Add messages
        if decrypted_messages:
            sections.append(("Investigation Messages", ""))
            for msg in decrypted_messages:
                sections.append((f"Message {msg['message_id']} ({msg['created_at']})", msg["body"]))

        # Build evidence manifest (placeholder - would be populated from evidence table)
        manifest = [
            {"note": "Evidence manifest requires verified evidence schema"},
        ]

        pdf_bytes = investigation_pdf(
            title=f"Investigation Export - {report_reference}",
            sections=sections,
            manifest=manifest,
        )

        return Response(
            content=pdf_bytes,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="export-{report_reference}.pdf"'},
        )
    except IntegrationUnavailable as exc:
        raise HTTPException(503, detail={"code": "integration_unavailable", "message": str(exc)}) from None