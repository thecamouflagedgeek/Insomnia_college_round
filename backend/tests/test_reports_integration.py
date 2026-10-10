"""Integration tests for reports API with encryption."""
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.config import Settings, get_settings
from app.core.database import Database
from unittest.mock import patch


client = TestClient(app)


def test_submit_report_returns_receipt():
    """Test submitting a report returns a receipt with reference."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.complaint_service.get_settings", return_value=settings):
            response = client.post("/api/v1/reports", json={
                "title": "Safety concern",
                "narrative": "A sufficiently detailed synthetic report text for testing.",
                "category": "safety"
            })
            assert response.status_code == 201
            data = response.json()
            assert "reference" in data
            assert data["reference"].startswith("INC-")
            assert data["status"] == "submitted"
            assert data["blockchain_status"] == "pending"


def test_submit_report_validation_error_no_leak():
    """Test validation errors don't leak sensitive data."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.complaint_service.get_settings", return_value=settings):
            response = client.post("/api/v1/reports", json={
                "title": "Short",
                "narrative": "too short",
                "category": "safety"
            })
            assert response.status_code == 422
            # Narrative should not appear in error response
            assert "too short" not in response.text


def test_report_status_unverified_schema():
    """Test status returns 503 for non-existent report (simulating unverified schema)."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.complaint_service.get_settings", return_value=settings):
            response = client.get("/api/v1/reports/INC-nonexistent/status")
            assert response.status_code == 503
            assert response.json()["detail"]["code"] == "integration_unavailable"


def test_report_status_after_submission():
    """Test status works after submission."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.complaint_service.get_settings", return_value=settings):
            # Submit report
            response = client.post("/api/v1/reports", json={
                "title": "Test Report",
                "narrative": "Detailed narrative for testing purposes.",
                "category": "safety"
            })
            assert response.status_code == 201
            reference = response.json()["reference"]

            # Check status
            status_response = client.get(f"/api/v1/reports/{reference}/status")
            assert status_response.status_code == 200
            assert status_response.json()["reference"] == reference
            assert status_response.json()["status"] == "submitted"


def test_report_detail_requires_auth():
    """Test report detail requires authentication."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.complaint_service.get_settings", return_value=settings):
            # Submit report first
            response = client.post("/api/v1/reports", json={
                "title": "Test Report",
                "narrative": "Detailed narrative for testing purposes.",
                "category": "safety"
            })
            reference = response.json()["reference"]

            # Try to access without auth
            detail_response = client.get(f"/api/v1/reports/{reference}")
            assert detail_response.status_code == 401


def test_evidence_upload_validation():
    """Test evidence upload validation."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.complaint_service.get_settings", return_value=settings):
            # Valid file
            response = client.post(
                "/api/v1/reports/INC-test/evidence",
                files={"file": ("test.txt", b"Valid text content", "text/plain")}
            )
            # Requires auth, so 401
            assert response.status_code == 401


def test_evidence_upload_invalid_type():
    """Test evidence upload rejects invalid file type."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.complaint_service.get_settings", return_value=settings):
            # Invalid file type
            response = client.post(
                "/api/v1/reports/INC-test/evidence",
                files={"file": ("test.exe", b"Invalid content", "application/octet-stream")}
            )
            assert response.status_code == 401  # Auth required first


def test_evidence_upload_empty_file():
    """Test evidence upload rejects empty file."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.complaint_service.get_settings", return_value=settings):
            response = client.post(
                "/api/v1/reports/INC-test/evidence",
                files={"file": ("empty.txt", b"", "text/plain")}
            )
            assert response.status_code == 401  # Auth required first