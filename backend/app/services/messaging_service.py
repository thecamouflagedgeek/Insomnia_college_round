"""Investigation messaging with encrypted message bodies."""
from __future__ import annotations

import time
from datetime import datetime
from uuid import uuid4
from dataclasses import dataclass
from typing import Any
from app.core.database import Database, IntegrationUnavailable, TestRecord, require_report_id, run
from app.core.config import get_settings
from app.services.encryption_service import get_encryption_service, EncryptedField
from app.models.message import InvestigationMessage


@dataclass(frozen=True)
class CreatedMessage:
    message_id: str
    report_reference: str
    encrypted_body: EncryptedField
    created_at: int


def send_investigation_message(report_reference: str, body: str, thread_token: str | None = None) -> CreatedMessage:
    """Send an investigation message with encrypted body.

    Args:
        report_reference: The report this message belongs to
        body: Message content
        thread_token: Optional thread identifier for grouping messages

    Returns:
        CreatedMessage with encrypted body
    """
    settings = get_settings()
    db = Database.from_settings(settings)

    message_id = str(uuid4())
    created_at = int(time.time())

    # Encrypt message body
    encryption_service = get_encryption_service()
    encrypted_body = encryption_service.encrypt_message_body(message_id, body)

    # Create message record
    message = InvestigationMessage(
        message_id=message_id,
        report_reference=report_reference,
        encrypted_body=encrypted_body.ciphertext,
    )

    if db._test_mode:
        test_record = TestRecord(
            id=uuid4(),
            data={
                "message_id": message_id,
                "report_reference": report_reference,
                "encrypted_body": encrypted_body.ciphertext,
                "body_aad": encrypted_body.associated_data,
                "thread_token": thread_token,
                "created_at": created_at,
            },
        )
        db.test_insert("investigation_messages", test_record)
    else:
        client = db.require_schema()
        run(client.table("investigation_messages").insert({
            "id": message_id,
            "report_id": require_report_id(client, report_reference),
            "sender_role": "investigator",
            "body_ciphertext": encrypted_body.ciphertext,
        }), "save message")

    return CreatedMessage(
        message_id=message_id,
        report_reference=report_reference,
        encrypted_body=encrypted_body,
        created_at=created_at,
    )


def list_investigation_messages(report_reference: str, db: Database | None = None) -> list[CreatedMessage]:
    """List all messages for a report (after authorization check)."""
    if db is None:
        settings = get_settings()
        db = Database.from_settings(settings)

    if db._test_mode:
        messages = []
        for record in db.test_list("investigation_messages"):
            if record.data.get("report_reference") == report_reference:
                data = record.data
                encrypted_body = EncryptedField(
                    ciphertext=data["encrypted_body"],
                    associated_data=data["body_aad"],
                )
                messages.append(CreatedMessage(
                    message_id=data["message_id"],
                    report_reference=data["report_reference"],
                    encrypted_body=encrypted_body,
                    created_at=data["created_at"],
                ))
        # Sort by creation time
        messages.sort(key=lambda m: m.created_at)
        return messages
    else:
        client = db.require_schema()
        rows = run(client.table("investigation_messages").select("id,body_ciphertext,created_at")
                   .eq("report_id", require_report_id(client, report_reference)).order("created_at"), "read messages")
        return [CreatedMessage(
            message_id=row["id"],
            report_reference=report_reference,
            encrypted_body=EncryptedField(ciphertext=row["body_ciphertext"],
                                          associated_data=f"message:{row['id']}:body"),
            created_at=int(datetime.fromisoformat(str(row["created_at"]).replace("Z", "+00:00")).timestamp()),
        ) for row in rows]


def decrypt_message_body(message: CreatedMessage) -> str:
    """Decrypt message body after authorization check."""
    encryption_service = get_encryption_service()
    return encryption_service.decrypt_message_body(message.message_id, message.encrypted_body)