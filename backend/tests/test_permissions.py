import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from app.core.permissions import Role, require_role, can_access_report
from app.main import app

def test_role_is_never_taken_from_request_payload():
    with pytest.raises(HTTPException) as exc:
        require_role({"sub":"u1", "role":"admin"}, Role.ADMIN)
    assert exc.value.status_code == 403

def test_cross_report_access_denied():
    assert not can_access_report({"sub":"attacker", "user_role":"investigator"}, {"authorized_investigators":["assigned"]})

def test_private_endpoint_rejects_missing_token():
    response = TestClient(app).get("/api/v1/credentials/me")
    assert response.status_code == 401
