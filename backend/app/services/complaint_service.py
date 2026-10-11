"""Complaint creation and retrieval with encryption at persistence boundary."""
from __future__ import annotations

from uuid import UUID, uuid4
from dataclasses import dataclass
from typing import Any
from app.core.database import Database, IntegrationUnavailable, TestRecord, report_row, run
from app.core.supabase_repo import report_row_id
from app.core.config import get_settings
from app.schemas.complaint import ReportCreate
from app.services.encryption_service import get_encryption_service, EncryptedField
from app.models.complaint import Complaint


@dataclass(frozen=True)
class CreatedComplaint:
    id: str
    public_reference: str
    encrypted_title: EncryptedField
    encrypted_narrative: EncryptedField
    status: str


def create_report(payload: ReportCreate, public_reference: str) -> dict:
    """Create a new complaint report with encrypted sensitive fields.

    Args:
        payload: Validated report data from the API
        public_reference: Public reference string (e.g., "INC-abc123")

    Returns:
        Dict with reference, status, and blockchain_status for the receipt

    Raises:
        IntegrationUnavailable: If neither test adapter nor production schema is available
    """
    settings = get_settings()
    db = Database.from_settings(settings)

    # Encrypt sensitive fields
    encryption_service = get_encryption_service()
    encrypted_fields = encryption_service.encrypt_complaint_fields(
        reference=public_reference,
        title=payload.title,
        narrative=payload.narrative,
    )

    # Create complaint record. The row id is derived from the public reference exactly as the integrated workflow
    # derives it (app.core.supabase_repo.report_row_id), so both services address the same report the same way.
    complaint_id = UUID(report_row_id(public_reference))
    record = Complaint(
        id=complaint_id,
        public_reference=public_reference,
        encrypted_title=encrypted_fields["title"].ciphertext,
        encrypted_narrative=encrypted_fields["narrative"].ciphertext,
        status="submitted",
    )

    # Persist using test adapter or real client
    if db._test_mode:
        test_record = TestRecord(
            id=complaint_id,
            data={
                "id": str(complaint_id),
                "public_reference": public_reference,
                "encrypted_title": encrypted_fields["title"].ciphertext,
                "encrypted_narrative": encrypted_fields["narrative"].ciphertext,
                "status": "submitted",
                "title_aad": encrypted_fields["title"].associated_data,
                "narrative_aad": encrypted_fields["narrative"].associated_data,
            },
        )
        db.test_insert("complaints", test_record)
    else:
        client = db.require_schema()
        # Canonical columns only; the AAD is rebuilt from the reference on read, so it is not stored. Severity has
        # not been assessed by this route, so it starts at the neutral 'medium' (allowed: low|medium|high|critical).
        run(client.table("reports").insert({
            "id": str(complaint_id),
            "public_reference": public_reference,
            "category": payload.category,
            "summary_ciphertext": encrypted_fields["title"].ciphertext,
            "description_ciphertext": encrypted_fields["narrative"].ciphertext,
            "severity": "medium",
            "status": "submitted",
        }), "save report")

    return {
        "reference": public_reference,
        "status": "submitted",
        "blockchain_status": "pending",
    }


def get_complaint_by_reference(reference: str, db: Database | None = None) -> CreatedComplaint | None:
    """Retrieve a complaint by its public reference (for authorized access only)."""
    if db is None:
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
            return None
        data = record.data
        return CreatedComplaint(
            id=data["id"],
            public_reference=data["public_reference"],
            encrypted_title=EncryptedField(ciphertext=data["encrypted_title"], associated_data=data["title_aad"]),
            encrypted_narrative=EncryptedField(ciphertext=data["encrypted_narrative"], associated_data=data["narrative_aad"]),
            status=data["status"],
        )
    else:
        client = db.require_schema()
        data = report_row(client, reference)
        if not data:
            return None
        ref = data["public_reference"]
        return CreatedComplaint(
            id=str(data["id"]),
            public_reference=ref,
            encrypted_title=EncryptedField(ciphertext=data.get("summary_ciphertext") or "",
                                           associated_data=f"complaint:{ref}:title"),
            encrypted_narrative=EncryptedField(ciphertext=data["description_ciphertext"],
                                               associated_data=f"complaint:{ref}:narrative"),
            status=data["status"],
        )


def decrypt_complaint_fields(complaint: CreatedComplaint) -> dict[str, str]:
    """Decrypt complaint fields after authorization check.

    This should only be called after verifying the requester has permission
    to access this specific complaint.
    """
    encryption_service = get_encryption_service()
    return encryption_service.decrypt_complaint_fields(
        reference=complaint.public_reference,
        encrypted_title=complaint.encrypted_title,
        encrypted_narrative=complaint.encrypted_narrative,
    )