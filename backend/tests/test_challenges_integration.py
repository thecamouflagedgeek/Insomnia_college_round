"""Integration tests for challenges API."""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import Settings, get_settings
from app.core.database import Database
from unittest.mock import patch

client = TestClient(app)


def test_create_challenge_requires_auth():
    """Test creating a challenge requires authentication."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.committee_service.get_settings", return_value=settings):
            response = client.post("/api/v1/challenges", json={
                "report_reference": "INC-test123",
                "reason": "Conflict of interest",
                "requested_action": "recusal"
            })
            assert response.status_code == 401


def test_decide_challenge_requires_admin():
    """Test deciding a challenge requires admin role."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.committee_service.get_settings", return_value=settings):
            response = client.post("/api/v1/challenges/test-id/decision", json={
                "decision": "accepted",
                "rationale": "Valid reason"
            })
            assert response.status_code == 401