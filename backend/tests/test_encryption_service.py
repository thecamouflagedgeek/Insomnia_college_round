"""Tests for encryption service integration."""
import pytest
import base64
import os
from uuid import uuid4
from app.services.encryption_service import EncryptionService, EncryptedField, get_encryption_service
from app.core.config import Settings


def test_encryption_service_encrypt_decrypt_round_trip():
    """Test encryption service round trip for complaint fields."""
    key = os.urandom(32)
    service = EncryptionService(key)
    reference = "INC-test123"

    encrypted = service.encrypt_complaint_fields(reference, "Test Title", "Test narrative with sensitive details")

    assert "title" in encrypted
    assert "narrative" in encrypted
    assert isinstance(encrypted["title"], EncryptedField)
    assert isinstance(encrypted["narrative"], EncryptedField)

    decrypted = service.decrypt_complaint_fields(reference, encrypted["title"], encrypted["narrative"])
    assert decrypted["title"] == "Test Title"
    assert decrypted["narrative"] == "Test narrative with sensitive details"


def test_encryption_service_witness_contact():
    """Test witness contact encryption."""
    key = os.urandom(32)
    service = EncryptionService(key)
    invitation_id = str(uuid4())

    encrypted = service.encrypt_witness_contact(invitation_id, "witness@example.com")
    decrypted = service.decrypt_witness_contact(invitation_id, encrypted)

    assert decrypted == "witness@example.com"


def test_encryption_service_message_body():
    """Test message body encryption."""
    key = os.urandom(32)
    service = EncryptionService(key)
    message_id = str(uuid4())

    encrypted = service.encrypt_message_body(message_id, "Private investigation message")
    decrypted = service.decrypt_message_body(message_id, encrypted)

    assert decrypted == "Private investigation message"


def test_encryption_service_aad_mismatch_fails():
    """Test that wrong associated data causes decryption to fail."""
    key = os.urandom(32)
    service = EncryptionService(key)
    reference = "INC-test123"

    encrypted = service.encrypt_complaint_fields(reference, "Title", "Narrative")

    # Try to decrypt with wrong reference
    with pytest.raises(Exception) as exc:
        service.decrypt_complaint_fields("INC-wrong", encrypted["title"], encrypted["narrative"])
    assert "Associated data mismatch" in str(exc.value)


def test_encryption_service_empty_plaintext_raises():
    """Test that empty plaintext raises error."""
    key = os.urandom(32)
    service = EncryptionService(key)

    with pytest.raises(ValueError) as exc:
        service.encrypt_field("", "complaint", "INC-123", "title")
    assert "Cannot encrypt empty plaintext" in str(exc.value)


def test_encryption_service_deterministic_aad():
    """Test that AAD format is consistent."""
    key = os.urandom(32)
    service = EncryptionService(key)

    encrypted1 = service.encrypt_field("data", "complaint", "INC-123", "title")
    encrypted2 = service.encrypt_field("data", "complaint", "INC-123", "title")

    # AAD should be the same for same context
    assert encrypted1.associated_data == encrypted2.associated_data
    assert encrypted1.associated_data == "complaint:INC-123:title"

    # Ciphertext should be different (different nonce)
    assert encrypted1.ciphertext != encrypted2.ciphertext


def test_get_encryption_service_uses_settings():
    """Test that get_encryption_service uses the configured key."""
    # This is tested via the integration tests in test_encryption.py
    pass