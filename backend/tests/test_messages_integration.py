"""Integration tests for messages API."""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import Settings, get_settings
from app.core.database import Database
from unittest.mock import patch

client = TestClient(app)


def test_send_message_requires_auth():
    """Test sending a message requires authentication."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.messaging_service.get_settings", return_value=settings):
            response = client.post("/api/v1/messages", json={
                "report_reference": "INC-test123",
                "body": "Test message"
            })
            assert response.status_code == 401


def test_list_messages_requires_auth():
    """Test listing messages requires authentication."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.messaging_service.get_settings", return_value=settings):
            response = client.get("/api/v1/messages/INC-test123")
            assert response.status_code == 401