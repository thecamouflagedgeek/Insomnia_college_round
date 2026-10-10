"""Integration tests for exports API."""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import Settings, get_settings
from app.core.database import Database
from unittest.mock import patch

client = TestClient(app)


def test_export_report_requires_auth():
    """Test exporting a report requires authentication."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.complaint_service.get_settings", return_value=settings):
            with patch("app.services.messaging_service.get_settings", return_value=settings):
                response = client.get("/api/v1/exports/INC-test123.pdf")
                assert response.status_code == 401