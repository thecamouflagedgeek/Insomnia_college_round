"""Encryption service for sensitive field handling at persistence boundaries."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Any
from app.utils.encryption import encrypt, decrypt, get_encryption_key, EncryptionError
from app.core.config import get_settings


@dataclass(frozen=True)
class EncryptedField:
    """Represents an encrypted field with its associated data context."""
    ciphertext: str
    associated_data: str


class EncryptionService:
    """Service for encrypting/decrypting sensitive fields before persistence.

    Encryption uses AES-256-GCM with URL-safe Base64 encoding.
    Each field is encrypted with the global ENCRYPTION_KEY and associated data
    that binds the ciphertext to a specific record and field context.

    Associated data format: "<record_type>:<record_id>:<field_name>"
    Example: "complaint:INC-abc123:title"
    """

    def __init__(self, key: bytes | None = None):
        self._key = key or get_encryption_key()

    @staticmethod
    def _make_aad(record_type: str, record_id: str, field_name: str) -> bytes:
        return f"{record_type}:{record_id}:{field_name}".encode()

    def encrypt_field(self, plaintext: str, record_type: str, record_id: str, field_name: str) -> EncryptedField:
        """Encrypt a plaintext field for storage.

        Args:
            plaintext: The sensitive data to encrypt
            record_type: Type of record (e.g., "complaint", "witness", "message")
            record_id: Unique identifier for the record
            field_name: Name of the field being encrypted (e.g., "title", "narrative", "body")

        Returns:
            EncryptedField containing ciphertext and associated data for later decryption
        """
        if not plaintext:
            raise ValueError("Cannot encrypt empty plaintext")
        aad = self._make_aad(record_type, record_id, field_name)
        ciphertext = encrypt(plaintext.encode("utf-8"), self._key, aad)
        return EncryptedField(ciphertext=ciphertext, associated_data=aad.decode())

    def decrypt_field(self, encrypted: EncryptedField, record_type: str, record_id: str, field_name: str) -> str:
        """Decrypt a field after authorization.

        Args:
            encrypted: The EncryptedField to decrypt
            record_type: Type of record (must match encryption)
            record_id: Unique identifier for the record (must match encryption)
            field_name: Name of the field (must match encryption)

        Returns:
            Decrypted plaintext string

        Raises:
            EncryptionError: If decryption fails (tampering, wrong key, wrong context)
        """
        expected_aad = self._make_aad(record_type, record_id, field_name)
        if encrypted.associated_data != expected_aad.decode():
            raise EncryptionError("Associated data mismatch: record context does not match")
        plaintext_bytes = decrypt(encrypted.ciphertext, self._key, expected_aad)
        return plaintext_bytes.decode("utf-8")

    def encrypt_complaint_fields(self, reference: str, title: str, narrative: str) -> dict[str, EncryptedField]:
        """Encrypt complaint title and narrative for storage."""
        return {
            "title": self.encrypt_field(title, "complaint", reference, "title"),
            "narrative": self.encrypt_field(narrative, "complaint", reference, "narrative"),
        }

    def decrypt_complaint_fields(self, reference: str, encrypted_title: EncryptedField, encrypted_narrative: EncryptedField) -> dict[str, str]:
        """Decrypt complaint title and narrative after authorization."""
        return {
            "title": self.decrypt_field(encrypted_title, "complaint", reference, "title"),
            "narrative": self.decrypt_field(encrypted_narrative, "complaint", reference, "narrative"),
        }

    def encrypt_witness_contact(self, invitation_id: str, contact: str) -> EncryptedField:
        """Encrypt witness contact details for storage."""
        return self.encrypt_field(contact, "witness", invitation_id, "contact")

    def decrypt_witness_contact(self, invitation_id: str, encrypted: EncryptedField) -> str:
        """Decrypt witness contact details after authorization."""
        return self.decrypt_field(encrypted, "witness", invitation_id, "contact")

    def encrypt_message_body(self, message_id: str, body: str) -> EncryptedField:
        """Encrypt investigation message body for storage."""
        return self.encrypt_field(body, "message", message_id, "body")

    def decrypt_message_body(self, message_id: str, encrypted: EncryptedField) -> str:
        """Decrypt investigation message body after authorization."""
        return self.decrypt_field(encrypted, "message", message_id, "body")


def get_encryption_service() -> EncryptionService:
    """Get the default encryption service using the configured key."""
    return EncryptionService()