"""Tests for witness service with encryption."""
import pytest
import time
from unittest.mock import patch
from app.services.witness_service import (
    create_witness_invitation,
    validate_witness_token,
    create_invitation_token,
    validate_invitation_token,
)
from app.core.config import Settings, get_settings
from app.core.database import Database


def test_create_witness_invitation_returns_token_and_encrypted_contact():
    """Test creating a witness invitation returns token and encrypted contact."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.witness_service.get_settings", return_value=settings):
            invitation = create_witness_invitation("INC-test123", "witness@example.com")

            assert invitation.invitation_id
            assert invitation.token
            assert invitation.token_digest
            assert invitation.expires_at > int(time.time())
            assert invitation.encrypted_contact.ciphertext
            assert invitation.encrypted_contact.associated_data == f"witness:{invitation.invitation_id}:contact"


def test_validate_witness_token_valid():
    """Test validating a valid witness token returns contact."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.witness_service.get_settings", return_value=settings):
            invitation = create_witness_invitation("INC-test123", "witness@example.com")

            is_valid, contact = validate_witness_token(invitation.token, invitation.invitation_id)

            assert is_valid is True
            assert contact == "witness@example.com"


def test_validate_witness_token_invalid_token():
    """Test validating with wrong token fails."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.witness_service.get_settings", return_value=settings):
            invitation = create_witness_invitation("INC-test123", "witness@example.com")

            is_valid, contact = validate_witness_token("wrong-token", invitation.invitation_id)

            assert is_valid is False
            assert contact is None


def test_validate_witness_token_expired():
    """Test validating expired token fails."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.witness_service.get_settings", return_value=settings):
            # Create with very short TTL
            invitation = create_witness_invitation("INC-test123", "witness@example.com", ttl_seconds=1)

            # Wait for expiry
            time.sleep(1.1)

            is_valid, contact = validate_witness_token(invitation.token, invitation.invitation_id)

            assert is_valid is False
            assert contact is None


def test_validate_witness_token_nonexistent():
    """Test validating non-existent invitation fails."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.witness_service.get_settings", return_value=settings):

            is_valid, contact = validate_witness_token("some-token", "nonexistent-id")

            assert is_valid is False
            assert contact is None


def test_create_invitation_token_legacy():
    """Test legacy create_invitation_token function."""
    token, digest = create_invitation_token()

    assert token
    assert digest
    assert token != digest
    assert len(token) > 0
    assert len(digest) == 64  # SHA256 hex


def test_validate_invitation_token_legacy():
    """Test legacy validate_invitation_token function."""
    token = "test-token"
    digest = "a" * 64  # dummy digest
    expires_at = int(time.time()) + 100

    # Should fail with wrong digest
    assert validate_invitation_token(token, digest, expires_at) is False

    # Should fail when expired
    assert validate_invitation_token(token, digest, int(time.time()) - 100) is False

    # Should fail with wrong token
    correct_digest = __import__("hashlib").sha256(token.encode()).hexdigest()
    assert validate_invitation_token("wrong", correct_digest, expires_at) is False

    # Should succeed with correct token and digest
    assert validate_invitation_token(token, correct_digest, expires_at) is True