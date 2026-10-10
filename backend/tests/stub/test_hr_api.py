import json

import pytest
from fastapi.testclient import TestClient

from app.chain.signals import challenge_scope_text
from app.stub.main import create_app
from tests.stub.test_stub_api import ENV, auth, proof, submit, wait_verified


def as_(staff_id):
    return {"X-Stub-Admin": "adm", "X-Staff-Id": staff_id}


@pytest.fixture
def client():
    with TestClient(create_app(dict(ENV))) as c:
        yield c


@pytest.fixture
def case(client):
    r = submit(client).json()
    return r["case_id"], r["case_token"]


def file_challenge(client, case_id, token, member="usr_marcus"):
    cp = json.dumps({"member_id": member, "reason": "Professional relationship",
                     "explanation": "He is my direct skip-level manager.", "client_nonce": "c-123456789"})
    r = client.post(f"/reports/{case_id}/challenge", headers=auth(token),
                    json={"payload": cp, "proof": proof(cp, challenge_scope_text(case_id, member))})
    assert r.status_code == 201, r.text
    return r.json()["challenge_id"]


def test_staff_auth_required(client, case):
    assert client.get("/hr/cases").status_code == 401
    assert client.get("/hr/cases", headers={"X-Stub-Admin": "adm", "X-Staff-Id": "nobody"}).status_code == 401
    assert client.get("/hr/me", headers=as_("usr_sarah")).json()["role"] == "hr_reviewer"


def test_case_visibility_by_role(client, case):
    case_id, _ = case
    for sid in ("usr_sarah", "usr_aris", "usr_elena", "usr_marcus", "usr_david"):
        assert [c["id"] for c in client.get("/hr/cases", headers=as_(sid)).json()] == [case_id], sid
    assert client.get("/hr/cases", headers=as_("usr_priya")).json() == []  # not on this committee
    assert client.get(f"/hr/cases/{case_id}", headers=as_("usr_priya")).status_code == 403
    dto = client.get(f"/hr/cases/{case_id}", headers=as_("usr_sarah")).json()
    assert dto["category"] == "bullying_authority_abuse" and dto["committeeMemberIds"] == ["usr_marcus", "usr_david"]
    assert dto["blockchainSealTx"].startswith("0x") and dto["zkpNullifierHash"]


def test_inbox_round_trip_between_hr_and_reporter(client, case):
    case_id, token = case
    client.post(f"/reports/{case_id}/messages", headers=auth(token), json={"text": "It happens weekly."})
    r = client.post(f"/hr/cases/{case_id}/messages", headers=as_("usr_elena"), json={"text": "Which day?"})
    assert r.status_code == 201
    hr_view = client.get(f"/hr/cases/{case_id}/messages", headers=as_("usr_elena")).json()
    assert [m["sender"].split(" ")[0] for m in hr_view] == ["Anonymous", "Investigation"]
    phone_view = client.get(f"/reports/{case_id}/messages", headers=auth(token)).json()
    assert [(m["sender"], m["text"]) for m in phone_view] == [("you", "It happens weekly."), ("investigator", "Which day?")]
    assert client.post(f"/hr/cases/{case_id}/messages", headers=as_("usr_marcus"),
                       json={"text": "hi"}).status_code == 403  # committee members cannot message the reporter


def test_challenge_rules_and_revocation(client, case):
    case_id, token = case
    cid = file_challenge(client, case_id, token)
    assert client.get("/hr/challenges", headers=as_("usr_marcus")).json() == []  # hidden from the challenged
    assert client.get(f"/hr/challenges/{cid}", headers=as_("usr_marcus")).status_code == 403
    listed = client.get("/hr/challenges", headers=as_("usr_aris")).json()
    assert listed[0]["challengedMemberName"] == "Marcus Vance" and listed[0]["status"] == "pending_independent_review"
    assert client.get(f"/hr/cases/{case_id}", headers=as_("usr_sarah")).json()["status"] == "under_challenge"

    body = {"decision": "approve", "rationale": "Direct reporting line is a clear conflict."}
    assert client.post(f"/hr/challenges/{cid}/decide", headers=as_("usr_sarah"), json=body).status_code == 403
    out = client.post(f"/hr/challenges/{cid}/decide", headers=as_("usr_aris"), json=body).json()
    assert out["challenge"]["status"] == "approved_access_revoked"
    assert out["updatedComplaint"]["committeeMemberIds"] == ["usr_david", "usr_priya"]
    assert out["updatedComplaint"]["revokedMemberIds"] == ["usr_marcus"]
    again = client.post(f"/hr/challenges/{cid}/decide", headers=as_("usr_aris"), json=body)
    assert again.status_code == 409

    denied = client.get(f"/hr/cases/{case_id}", headers=as_("usr_marcus"))
    assert denied.status_code == 403 and "Revoked" in denied.json()["detail"]["message"]
    assert client.get(f"/hr/cases/{case_id}", headers=as_("usr_priya")).status_code == 200
    phone = client.get(f"/reports/{case_id}", headers=auth(token)).json()
    assert [m["member_id"] for m in phone["committee"]] == ["usr_david", "usr_priya"]

    types = [e["event_type"] for e in wait_verified(client, case_id, token)["events"]]
    # decision, replacement, revocation, status change, then Marcus's denied access attempt is audited too
    assert types[-5:] == ["challenge_decided", "member_replaced", "access_revoked", "status_changed",
                          "access_revoked"]


def test_witness_invite_masking_and_phone_response(client, case):
    case_id, _ = case
    assert client.post(f"/hr/cases/{case_id}/witnesses", headers=as_("usr_sarah"), json={}).status_code == 403
    inv = client.post(f"/hr/cases/{case_id}/witnesses", headers=as_("usr_elena"), json={"alias": ""}).json()
    assert inv["anonymousAlias"] == "Witness A" and inv["witnessCode"]
    code = {"X-Witness-Code": inv["witnessCode"]}
    client.post(f"/witness-invitations/{inv['id']}/respond", headers=code, json={"response": "accept"})
    full = client.get(f"/hr/cases/{case_id}/witnesses", headers=as_("usr_elena")).json()
    masked = client.get(f"/hr/cases/{case_id}/witnesses", headers=as_("usr_sarah")).json()
    assert full[0]["status"] == "accepted" and masked[0]["status"] == "pending"
    assert "Masked" in masked[0]["anonymousAlias"]
    summary = client.get(f"/hr/cases/{case_id}/witness-summary", headers=as_("usr_elena")).json()
    assert summary["accepted"] == 1 and summary["quorumMet"] is False


def test_audit_and_evidence_integrity(client, case):
    case_id, token = case
    up = client.post(f"/reports/{case_id}/evidence", headers=auth(token),
                     files={"file": ("a.txt", b"evidence", "text/plain")}).json()
    wait_verified(client, case_id, token)
    events = client.get("/hr/audit", headers=as_("usr_sarah"), params={"case_id": case_id}).json()
    assert events[0]["eventType"] == "complaint_sealed_zkp"
    assert all(e["verificationStatus"] == "verified_commitment" and e["txHash"].startswith("0x") for e in events)
    ok = client.get(f"/hr/cases/{case_id}/evidence/{up['evidence_id']}/verify", headers=as_("usr_sarah")).json()
    assert ok["verified"] and ok["sha256Matches"]

    import base64
    client.app.state.store.cases[case_id].evidence[0].content_b64 = base64.b64encode(b"swapped").decode()
    bad = client.get(f"/hr/cases/{case_id}/evidence/{up['evidence_id']}/verify", headers=as_("usr_sarah")).json()
    assert bad["verified"] is False and bad["sha256Matches"] is False
    dto = client.get(f"/hr/cases/{case_id}", headers=as_("usr_sarah")).json()
    assert dto["evidence"][0]["verificationStatus"] == "tampered"


def test_committee_pool(client, case):
    pool = client.get("/hr/committee-pool", headers=as_("usr_sarah")).json()
    marcus = next(m for m in pool if m["id"] == "usr_marcus")
    assert marcus["assignmentStatus"] == "active_assigned" and marcus["currentWorkload"] == 1
