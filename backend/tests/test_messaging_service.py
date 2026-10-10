"""Tests for messaging service with encryption."""
import pytest
from unittest.mock import patch
from app.services.messaging_service import (
    send_investigation_message,
    list_investigation_messages,
    decrypt_message_body,
)
from app.core.config import Settings, get_settings
from app.core.database import Database


def test_send_investigation_message_encrypts_body():
    """Test sending a message encrypts the body."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.messaging_service.get_settings", return_value=settings):
            message = send_investigation_message("INC-test123", "Confidential message body", "thread-1")

            assert message.message_id
            assert message.report_reference == "INC-test123"
            assert message.encrypted_body.ciphertext
            assert message.encrypted_body.associated_data == f"message:{message.message_id}:body"
            assert message.created_at > 0


def test_list_investigation_messages_returns_decrypted():
    """Test listing messages returns decrypted bodies."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.messaging_service.get_settings", return_value=settings):
            # Send multiple messages
            msg1 = send_investigation_message("INC-test123", "First message", "thread-1")
            msg2 = send_investigation_message("INC-test123", "Second message", "thread-1")

            messages = list_investigation_messages("INC-test123")

            assert len(messages) == 2
            # Should be sorted by created_at
            assert messages[0].message_id == msg1.message_id
            assert messages[1].message_id == msg2.message_id


def test_decrypt_message_body():
    """Test decrypting message body after authorization."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.messaging_service.get_settings", return_value=settings):
            message = send_investigation_message("INC-test123", "Secret message")

            body = decrypt_message_body(message)

            assert body == "Secret message"


def test_decrypt_message_body_wrong_context_fails():
    """Test decrypting with wrong message_id fails."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.messaging_service.get_settings", return_value=settings):
            message = send_investigation_message("INC-test123", "Secret message")

            # Create a fake message with same encrypted body but different ID
            from app.services.encryption_service import EncryptedField
            fake_message = type('Message', (), {
                'message_id': 'different-id',
                'encrypted_body': message.encrypted_body,
                'created_at': 0,
            })()

            with pytest.raises(Exception) as exc:
                decrypt_message_body(fake_message)
            assert "Associated data mismatch" in str(exc.value)


def test_list_messages_different_report_isolated():
    """Test messages for different reports are isolated."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.messaging_service.get_settings", return_value=settings):
            send_investigation_message("INC-report1", "Message for report 1")
            send_investigation_message("INC-report2", "Message for report 2")

            messages1 = list_investigation_messages("INC-report1")
            messages2 = list_investigation_messages("INC-report2")

            assert len(messages1) == 1
            assert len(messages2) == 1
            assert decrypt_message_body(messages1[0]) == "Message for report 1"
            assert decrypt_message_body(messages2[0]) == "Message for report 2"