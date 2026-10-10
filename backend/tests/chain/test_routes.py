from datetime import date

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.chain.anchorer import Anchorer
from app.chain.audit_log import AuditLog
from app.chain.audit_repo import InMemoryAuditRepository
from app.chain.config import ChainSettings
from app.chain.routes import build_router, complaint_scope_texts
from app.chain.services import ChainServices
from app.chain.verifier import CaseVerifier
from app.chain.zk_repo import InMemoryZkRepository
from app.chain.zk_service import ZkService
from tests.chain.fakes import FakeRegistry, FakeSemaphore

SETTINGS = ChainSettings.from_env({"AMOY_RPC_URL": "x", "RELAYER_PRIVATE_KEY": "0x" + "1" * 64,
                                   "SEMAPHORE_GROUP_ID": "1"})


def _client():
    repo, reg = InMemoryAuditRepository(), FakeRegistry()
    services = ChainServices(
        zk=ZkService(FakeSemaphore(), InMemoryZkRepository(), 1),
        audit=AuditLog(repo),
        verifier=CaseVerifier(repo, reg, {}, SETTINGS.explorer_tx_url),
        anchorer=Anchorer(repo, reg),
        settings=SETTINGS,
    )
    app = FastAPI()
    app.state.chain = services
    app.include_router(build_router(enroll_guard=lambda: None, case_guard=lambda: None))
    return TestClient(app), services


def test_enroll_then_group():
    client, _ = _client()
    r = client.post("/zk/enroll", json={"commitment": "12345678901234567890"})
    assert r.status_code == 200 and r.json()["index"] == 0
    g = client.get("/zk/group").json()
    assert g["members"] == ["12345678901234567890"] and g["depth"] == 16
    dup = client.post("/zk/enroll", json={"commitment": "12345678901234567890"})
    assert dup.status_code == 409 and dup.json()["detail"]["reason"] == "already_enrolled"


def test_scopes():
    client, _ = _client()
    c = client.get("/zk/scopes/complaint").json()
    assert c["scope_text"].startswith("cmp:") and len(c["valid_scope_texts"]) == 2
    assert c["sdk_argument"] == c["scope_text"]  # text mode
    ch = client.get("/zk/scopes/challenge", params={"case_id": "INC-1", "member_id": "m1"}).json()
    assert ch["scope_text"].startswith("chl:")


def test_complaint_scope_texts_allow_midnight_slack():
    assert complaint_scope_texts(date(2026, 10, 10)) == ["cmp:2026-10-10", "cmp:2026-10-09"]


def test_verify_and_receipts():
    client, services = _client()
    services.audit.record("INC-9", "complaint_submitted", {})
    services.anchorer.run_once()
    v = client.get("/audit/cases/INC-9/verify").json()
    assert v["ok"] is True and v["events"][0]["status"] == "verified"
    rs = client.get("/audit/cases/INC-9/receipts").json()
    assert rs[0]["anchor_tx"].startswith("0x")


def test_guards_are_applied():
    from fastapi import HTTPException

    def deny():
        raise HTTPException(status_code=403)

    _, services = _client()
    app = FastAPI()
    app.state.chain = services
    app.include_router(build_router(enroll_guard=deny, case_guard=deny))
    client = TestClient(app)
    assert client.post("/zk/enroll", json={"commitment": "1"}).status_code == 403
    assert client.get("/audit/cases/INC-1/verify").status_code == 403
    assert client.get("/audit/cases/INC-1/receipts").status_code == 403
    assert client.get("/zk/group").status_code == 200
