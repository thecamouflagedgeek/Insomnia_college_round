"""Integration tests for witnesses API."""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import Settings, get_settings
from app.core.database import Database
from app.services.witness_service import create_witness_invitation
from unittest.mock import patch

client = TestClient(app)


def test_invite_witness_requires_auth():
    """Test inviting a witness requires authentication."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.witness_service.get_settings", return_value=settings):
            response = client.post("/api/v1/witnesses/invitations", json={
                "report_reference": "INC-test123",
                "contact": "witness@example.com"
            })
            assert response.status_code == 401


def test_validate_invitation_requires_auth():
    """Test validating invitation requires authentication."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.witness_service.get_settings", return_value=settings):
            response = client.post("/api/v1/witnesses/invitations/validate", json={
                "token": "some-token"
            })
            assert response.status_code == 401