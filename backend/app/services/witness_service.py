"""Witness invitation and token validation with encrypted contact storage."""
from __future__ import annotations

import time
from uuid import uuid4
from dataclasses import dataclass
from typing import Any
from app.core.database import Database, IntegrationUnavailable, TestRecord
from app.core.config import get_settings
from app.core.security import issue_token, token_digest, digest_matches
from app.services.encryption_service import get_encryption_service, EncryptedField
from app.models.witness import WitnessInvitation


@dataclass(frozen=True)
class CreatedWitnessInvitation:
    invitation_id: str
    token: str
    token_digest: str
    expires_at: int
    encrypted_contact: EncryptedField


def create_witness_invitation(report_reference: str, contact: str, ttl_seconds: int | None = None) -> CreatedWitnessInvitation:
    """Create a witness invitation with encrypted contact details.

    Args:
        report_reference: The report this witness is for
        contact: Witness contact information (email, phone, etc.)
        ttl_seconds: Token time-to-live in seconds (defaults to settings)

    Returns:
        CreatedWitnessInvitation with token, digest, expiry, and encrypted contact
    """
    settings = get_settings()
    db = Database.from_settings(settings)

    ttl = ttl_seconds or settings.witness_token_ttl_seconds
    now = int(time.time())
    expires_at = now + ttl

    token = issue_token()
    digest = token_digest(token)

    # Encrypt contact details
    encryption_service = get_encryption_service()
    invitation_id = str(uuid4())
    encrypted_contact = encryption_service.encrypt_witness_contact(invitation_id, contact)

    # Create invitation record
    invitation = WitnessInvitation(
        invitation_id=invitation_id,
        token_digest=digest,
        expires_at=expires_at,
    )

    if db._test_mode:
        test_record = TestRecord(
            id=uuid4(),  # dummy UUID for test record
            data={
                "invitation_id": invitation_id,
                "report_reference": report_reference,
                "token_digest": digest,
                "expires_at": expires_at,
                "encrypted_contact": encrypted_contact.ciphertext,
                "contact_aad": encrypted_contact.associated_data,
            },
        )
        db.test_insert("witness_invitations", test_record)
    else:
        client = db.require_schema()
        raise IntegrationUnavailable("Production persistence not yet implemented")

    return CreatedWitnessInvitation(
        invitation_id=invitation_id,
        token=token,
        token_digest=digest,
        expires_at=expires_at,
        encrypted_contact=encrypted_contact,
    )


def validate_witness_token(token: str, invitation_id: str, db: Database | None = None) -> tuple[bool, str | None]:
    """Validate a witness invitation token and return contact if valid.

    Args:
        token: The raw token provided by the witness
        invitation_id: The invitation identifier
        db: Optional database instance

    Returns:
        Tuple of (is_valid, contact_or_none)
    """
    if db is None:
        settings = get_settings()
        db = Database.from_settings(settings)

    if db._test_mode:
        # Find invitation by ID
        for record in db.test_list("witness_invitations"):
            if record.data.get("invitation_id") == invitation_id:
                now = int(time.time())
                expires_at = record.data["expires_at"]
                stored_digest = record.data["token_digest"]

                if now >= expires_at:
                    return False, None
                if not digest_matches(token, stored_digest):
                    return False, None

                # Decrypt contact
                encryption_service = get_encryption_service()
                encrypted_contact = EncryptedField(
                    ciphertext=record.data["encrypted_contact"],
                    associated_data=record.data["contact_aad"],
                )
                contact = encryption_service.decrypt_witness_contact(invitation_id, encrypted_contact)
                return True, contact
        return False, None
    else:
        client = db.require_schema()
        raise IntegrationUnavailable("Production retrieval not yet implemented")


# Backward compatibility functions for existing tests
def create_invitation_token() -> tuple[str, str]:
    """Create a token and its digest (legacy function for tests)."""
    token = issue_token()
    return token, token_digest(token)


def validate_invitation_token(token: str, stored_digest: str, expires_at: int, now: int | None = None) -> bool:
    """Validate a token against stored digest and expiry (legacy function for tests)."""
    current = now if now is not None else int(time.time())
    return current < expires_at and digest_matches(token, stored_digest)