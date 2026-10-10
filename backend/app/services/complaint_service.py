"""Complaint creation and retrieval with encryption at persistence boundary."""
from __future__ import annotations

from uuid import uuid4
from dataclasses import dataclass
from typing import Any
from app.core.database import Database, IntegrationUnavailable, TestRecord
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

    # Create complaint record
    complaint_id = uuid4()
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
        # Production persistence would go here when schema is verified
        client = db.require_schema()
        # client.table("complaints").insert(record.__dict__).execute()
        raise IntegrationUnavailable("Production persistence not yet implemented")

    return {
        "reference": public_reference,
        "status": "submitted",
        "blockchain_status": "pending",
    }


def get_complaint_by_reference(reference: str, db: Database | None = None) -> CreatedComplaint | None:
    """Retrieve a complaint by its public reference (for authorized access only).

    Args:
        reference: Public reference string
        db: Optional database instance (creates test adapter if not provided)

    Returns:
        CreatedComplaint with encrypted fields, or None if not found
    """
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
        # Production retrieval would go here
        client = db.require_schema()
        # result = client.table("complaints").select("*").eq("public_reference", reference).single().execute()
        raise IntegrationUnavailable("Production retrieval not yet implemented")


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