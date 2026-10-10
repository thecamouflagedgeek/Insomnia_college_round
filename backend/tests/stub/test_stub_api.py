import json
import time
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.chain.signals import bytes32_text, challenge_scope_text, complaint_scope_text, message_text
from app.stub.main import create_app

KEY = "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY="  # test-only 32-byte key
ENV = {"CHAIN_MODE": "offline", "STUB_ENROLL_CODES": "CODE-1", "STUB_ADMIN_KEY": "adm", "ANCHOR_INTERVAL_S": "0.05"}
ADMIN = {"X-Stub-Admin": "adm"}
_nullifier = iter(range(1, 10_000))


def proof(payload: str, scope_text: str, nullifier: int | None = None) -> dict:
    """Offline mode skips the Groth16 check but still enforces message/scope binding and nullifiers."""
    return {"merkle_tree_depth": 16, "merkle_tree_root": "1", "nullifier": str(nullifier or next(_nullifier)),
            "message": str(bytes32_text(message_text(payload))), "scope": str(bytes32_text(scope_text)),
            "points": ["0"] * 8}


def report_payload(**over) -> str:
    p = {"category": "Bullying", "categories": ["Bullying"], "title": "Team conduct",
         "description": "Repeated shouting in stand-ups.", "incident_date": "2026-10-09", "client_nonce": "n-123456789"}
    return json.dumps({**p, **over}, separators=(",", ":"))


@pytest.fixture
def client():
    with TestClient(create_app(dict(ENV))) as c:
        yield c


def submit(client, payload=None, nullifier=None):
    # Distinct text per report: Claim Integrity rejects duplicate content.
    payload = payload or report_payload(description=f"Repeated shouting in stand-ups, report {next(_nullifier)}.")
    scope = complaint_scope_text(datetime.now(timezone.utc).date())
    return client.post("/reports", json={"payload": payload, "proof": proof(payload, scope, nullifier)})


def auth(token):
    return {"Authorization": f"Bearer {token}"}


def wait_verified(client, case_id, token):
    for _ in range(100):
        v = client.get(f"/audit/cases/{case_id}/verify", headers=auth(token)).json()
        if v["events"] and all(e["status"] == "verified" for e in v["events"]):
            return v
        time.sleep(0.05)
    raise AssertionError(v)


def test_enroll_needs_code(client):
    assert client.post("/zk/enroll", json={"commitment": "5"}).status_code == 403
    assert client.post("/zk/enroll", json={"commitment": "5"}, headers={"X-Enroll-Code": "nope"}).status_code == 403
    r = client.post("/zk/enroll", json={"commitment": "5"}, headers={"X-Enroll-Code": "CODE-1"})
    assert r.status_code == 200 and r.json()["index"] == 0
    assert client.get("/zk/group").json()["members"] == ["5"]


def test_full_reporter_journey(client):
    r = submit(client)
    assert r.status_code == 201, r.text
    case_id, token = r.json()["case_id"], r.json()["case_token"]
    assert case_id.startswith("INC-") and r.json()["status"] == "committee_assigned"

    view = client.get(f"/reports/{case_id}", headers=auth(token)).json()
    assert view["title"] == "Team conduct" and [m["member_id"] for m in view["committee"]] == ["usr_marcus", "usr_david"]

    up = client.post(f"/reports/{case_id}/evidence", headers=auth(token),
                     files={"file": ("note.txt", b"evidence bytes", "text/plain")})
    assert up.status_code == 201 and up.json()["size"] == 14

    sent = client.post(f"/reports/{case_id}/messages", headers=auth(token), json={"text": "It happens weekly."})
    assert sent.status_code == 201
    client.post(f"/_stub/reports/{case_id}/investigator-message", headers=ADMIN, json={"text": "Thanks, noted."})
    msgs = client.get(f"/reports/{case_id}/messages", headers=auth(token)).json()
    assert [m["sender"] for m in msgs] == ["you", "investigator"]

    cp = json.dumps({"member_id": "usr_david", "reason": "Prior involvement",
                     "explanation": "They reviewed my last complaint.", "client_nonce": "c-123456789"})
    ch = client.post(f"/reports/{case_id}/challenge", headers=auth(token),
                     json={"payload": cp, "proof": proof(cp, challenge_scope_text(case_id, "usr_david"))})
    assert ch.status_code == 201 and ch.json()["status"] == "pending_review"
    decided = client.post(f"/_stub/reports/{case_id}/challenges/{ch.json()['challenge_id']}/decide", headers=ADMIN,
                          json={"decision": "upheld"}).json()
    assert "usr_david" not in [m["member_id"] for m in decided["committee"]]

    v = wait_verified(client, case_id, token)
    types = [e["event_type"] for e in v["events"]]
    assert types[:5] == ["complaint_submitted", "case_classified", "severity_assessed", "committee_assigned",
                         "status_changed"]
    assert {"evidence_sealed", "inbox_message", "challenge_filed", "challenge_decided", "member_replaced"} <= set(types)
    receipts = client.get(f"/audit/cases/{case_id}/receipts", headers=auth(token)).json()
    assert len(receipts) == len(types) and all(x["anchor_tx"] for x in receipts)


def test_tampering_with_stored_content_is_detected(client):
    r = submit(client).json()
    case_id, token = r["case_id"], r["case_token"]
    client.post(f"/reports/{case_id}/messages", headers=auth(token), json={"text": "original"})
    wait_verified(client, case_id, token)
    client.app.state.store.cases[case_id].messages[0].text = "edited by someone"
    v = client.get(f"/audit/cases/{case_id}/verify", headers=auth(token)).json()
    bad = [e for e in v["events"] if e["status"] == "tampered"]
    assert v["ok"] is False and [e["event_type"] for e in bad] == ["inbox_message"]


def test_case_token_is_required_and_scoped(client):
    a, b = submit(client).json(), submit(client).json()
    assert client.get(f"/reports/{a['case_id']}").status_code == 401
    assert client.get(f"/reports/{a['case_id']}", headers=auth(b["case_token"])).status_code == 404
    assert client.get(f"/audit/cases/{a['case_id']}/verify", headers=auth(b["case_token"])).status_code == 404


def test_proof_binding_errors(client):
    payload = report_payload()
    scope = complaint_scope_text(datetime.now(timezone.utc).date())
    wrong_msg = proof(report_payload(title="other"), scope)
    r = client.post("/reports", json={"payload": payload, "proof": wrong_msg})
    assert r.status_code == 400 and r.json()["detail"]["reason"] == "message_mismatch"
    r = client.post("/reports", json={"payload": payload, "proof": proof(payload, "cmp:1999-01-01")})
    assert r.json()["detail"]["reason"] == "scope_mismatch"
    assert submit(client, nullifier=777).status_code == 201
    r = submit(client, report_payload(description="A different second report.", client_nonce="n-other-0001"),
               nullifier=777)
    assert r.status_code == 400 and r.json()["detail"]["reason"] == "replay"


def test_challenge_scope_is_per_case_and_member(client):
    r = submit(client).json()
    cp = json.dumps({"member_id": "usr_marcus", "reason": "Other", "explanation": "Fifteen chars at least.",
                     "client_nonce": "c-123456789"})
    wrong = proof(cp, challenge_scope_text(r["case_id"], "usr_priya"))
    res = client.post(f"/reports/{r['case_id']}/challenge", headers=auth(r["case_token"]),
                      json={"payload": cp, "proof": wrong})
    assert res.json()["detail"]["reason"] == "scope_mismatch"


def test_witness_flow(client):
    r = submit(client).json()
    inv = client.post("/_stub/witness-invitations", headers=ADMIN,
                      json={"case_id": r["case_id"], "context": "Team meeting on 9 Oct"}).json()
    code = {"X-Witness-Code": inv["witness_code"]}
    listed = client.get("/witness-invitations", headers=code).json()
    assert listed == [{"invitation_id": inv["invitation_id"], "context": "Team meeting on 9 Oct", "response": None}]
    assert client.get("/witness-invitations", headers={"X-Witness-Code": "wrong"}).json() == []
    ok = client.post(f"/witness-invitations/{inv['invitation_id']}/respond", headers=code, json={"response": "accept"})
    assert ok.json()["response"] == "accept"
    again = client.post(f"/witness-invitations/{inv['invitation_id']}/respond", headers=code,
                        json={"response": "decline"})
    assert again.status_code == 409


def test_admin_routes_need_key(client):
    assert client.get("/_stub/cases").status_code == 403
    assert client.get("/_stub/cases", headers=ADMIN).status_code == 200


def test_classify_is_stateless_stub(client):
    out = client.post("/classify", json={"text": "My manager keeps shouting and humiliating me"}).json()
    assert out["retained"] is False and out["suggestions"][0]["category"] in ("Bullying", "Abuse of Authority")


def test_state_survives_restart(tmp_path):
    env = {**ENV, "STUB_STATE_PATH": str(tmp_path / "state.json"), "ENCRYPTION_KEY": KEY}
    with TestClient(create_app(dict(env))) as c:
        r = submit(c).json()
    with TestClient(create_app(dict(env))) as c:
        assert c.get(f"/reports/{r['case_id']}", headers=auth(r["case_token"])).status_code == 200


def test_contract_matches_served_routes():
    """shared/api-contract.yaml is what M1 codes against: every documented operation must be served, and every
    served non-admin operation must be documented."""
    from pathlib import Path

    import yaml

    contract = yaml.safe_load((Path(__file__).resolve().parents[3] / "shared/api-contract.yaml").read_text())
    documented = {(p, m.upper()) for p, ops in contract["paths"].items() for m in ops if m != "parameters"}
    app = create_app(dict(ENV))
    served = {(path, m.upper()) for path, ops in app.openapi()["paths"].items() for m in ops
              if not path.startswith(("/_stub", "/hr"))}
    assert documented == served
