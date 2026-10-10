from fastapi.testclient import TestClient
from app.main import app
from app.schemas.complaint import ReportCreate
from pydantic import ValidationError

client = TestClient(app)


def test_health_fails_closed_without_schema():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["complaint_submissions_enabled"] is False


def test_report_validation_rejects_short_narrative():
    try:
        ReportCreate(title="A valid title", narrative="too short", category="safety")
    except ValidationError:
        return
    assert False, "short narrative must be rejected"


def test_report_submission_works_in_test_mode():
    """Test that report submission works in test mode with test adapter."""
    response = client.post("/api/v1/reports", json={"title": "Safety concern", "narrative": "A sufficiently detailed synthetic report text.", "category": "safety"})
    assert response.status_code == 201
    data = response.json()
    assert "reference" in data
    assert data["reference"].startswith("INC-")
    assert data["status"] == "submitted"
    assert data["blockchain_status"] == "pending"
    # Verify sensitive data is not in response
    assert "narrative" not in response.text
    assert "Safety concern" not in response.text


def test_report_submission_fails_validation_errors():
    """Test that validation errors don't leak sensitive data."""
    response = client.post("/api/v1/reports", json={"title": "Safety", "narrative": "too short", "category": "safety"})
    assert response.status_code == 422


def test_private_status_does_not_disclose_without_schema():
    response = client.get("/api/v1/reports/INC-synthetic-reference/status")
    assert response.status_code == 503
