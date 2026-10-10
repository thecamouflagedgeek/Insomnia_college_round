import json
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app.chain.signals import complaint_scope_text
from app.stub.main import create_app
from tests.stub.test_hr_api import as_
from tests.stub.test_stub_api import ENV, KEY, auth, proof, report_payload, wait_verified


@pytest.fixture
def client():
    with TestClient(create_app(dict(ENV))) as c:
        yield c


def submit(client, **over):
    payload = report_payload(**over)
    scope = complaint_scope_text(datetime.now(timezone.utc).date())
    return client.post("/reports", json={"payload": payload, "proof": proof(payload, scope)})


def test_classifier_uses_m3_engine_and_is_labelled(client):
    out = client.post("/classify", json={"text": "I faced retaliation after reporting; my manager keeps shouting"}).json()
    cats = [s["category"] for s in out["suggestions"]]
    assert "Retaliation" in cats and "Bullying" in cats
    assert out["human_review_required"] is True and "Keyword overlap" in out["limitation"] and not out["retained"]


def test_claim_integrity_runs_before_the_proof(client):
    nullifier_before = len(client.app.state.chain.zk._repo._nullifiers) if hasattr(
        client.app.state.chain.zk._repo, "_nullifiers") else None
    short = submit(client, description="too short")
    assert short.status_code == 422 and short.json()["detail"] == {"reason": "claim_integrity",
                                                                   "flags": ["too_little_detail"]}
    assert submit(client, description="Shouting at the team in every stand-up meeting.").status_code == 201
    dup = submit(client, description="  shouting at the team in EVERY stand-up meeting. ", client_nonce="n-dup-00001")
    assert dup.status_code == 422 and dup.json()["detail"]["flags"] == ["duplicate_content"]
    if nullifier_before is not None:  # rejected reports did not spend a nullifier
        assert len(client.app.state.chain.zk._repo._nullifiers) == nullifier_before + 1


def test_severity_is_assessed_audited_and_shown(client):
    r = submit(client, category="Safety", description="He threatened me with a weapon in the car park.").json()
    dto = client.get(f"/hr/cases/{r['case_id']}", headers=as_("usr_sarah")).json()
    assert dto["severity"] == "critical" and "weapon" in dto["severitySignals"]
    calm = submit(client, category="Bullying", description="Repeated belittling comments in team meetings.").json()
    assert client.get(f"/hr/cases/{calm['case_id']}", headers=as_("usr_sarah")).json()["severity"] == "medium"
    events = [e["event_type"] for e in wait_verified(client, r["case_id"], r["case_token"])["events"]]
    assert "severity_assessed" in events


def test_repeat_allegations_and_correlation(client):
    a = submit(client, subject_ref="EMP-1042", description="Manager shouted and humiliated me in the sprint review.")
    b = submit(client, subject_ref="EMP-1042", description="Manager humiliated junior staff during sprint review.")
    c = submit(client, subject_ref="EMP-7", description="Expense fraud with fake invoices from a vendor.")
    ids = [x.json()["case_id"] for x in (a, b, c)]
    rel = client.get(f"/hr/cases/{ids[0]}/related", headers=as_("usr_sarah")).json()
    assert rel["repeat"]["possible_repeat"] is True and rel["repeat"]["case_ids"] == [ids[1]]
    assert [s["case_id"] for s in rel["similar"]] == [ids[1]]
    pat = client.get("/hr/patterns", headers=as_("usr_sarah")).json()
    assert pat["repeatSubjects"][0]["caseIds"] == ids[:2] and pat["repeatSubjects"][0]["subjectRef"].startswith("SUBJ-")
    assert "EMP-1042" not in json.dumps(pat)  # raw directory reference never leaves the server
    assert pat["correlatedPairs"][0]["caseIds"] == ids[:2]
    assert client.get(f"/reports/{ids[0]}", headers=auth(a.json()["case_token"])).json().get("subject_ref") is None


def test_resolution_and_reflect_and_reform(client):
    cases = [submit(client, description=f"Repeated shouting in meetings, incident number {i}.").json()
             for i in range(3)]
    first = cases[0]
    early = client.post(f"/reports/{first['case_id']}/reflection", headers=auth(first["case_token"]),
                        json={"fairness": 4, "felt_safe": True, "would_report_again": True})
    assert early.status_code == 409 and early.json()["detail"]["reason"] == "not_resolved"
    body = {"outcome": "substantiated", "summary": "Witness statements corroborate the pattern.",
            "actions": ["Manager coaching", "Team norms workshop"]}
    assert client.post(f"/hr/cases/{first['case_id']}/resolve", headers=as_("usr_marcus"), json=body).status_code == 403
    for c in cases:
        r = client.post(f"/hr/cases/{c['case_id']}/resolve", headers=as_("usr_elena"), json=body)
        assert r.status_code == 200 and r.json()["status"] == "resolved"
    view = client.get(f"/reports/{first['case_id']}", headers=auth(first["case_token"])).json()
    assert view["resolution"]["outcome"] == "substantiated" and "summary" not in view["resolution"]

    for i, c in enumerate(cases[:2]):
        client.post(f"/reports/{c['case_id']}/reflection", headers=auth(c["case_token"]),
                    json={"fairness": 3 + i, "felt_safe": True, "would_report_again": i == 0})
    hidden = client.get("/hr/insights", headers=as_("usr_sarah")).json()
    assert hidden["suppressed"] is True and hidden["responses"] is None and hidden["resolvedCases"] == 3
    last = cases[2]
    client.post(f"/reports/{last['case_id']}/reflection", headers=auth(last["case_token"]),
                json={"fairness": 5, "felt_safe": False, "would_report_again": True})
    again = client.post(f"/reports/{last['case_id']}/reflection", headers=auth(last["case_token"]),
                        json={"fairness": 1, "felt_safe": False, "would_report_again": False})
    assert again.status_code == 409
    shown = client.get("/hr/insights", headers=as_("usr_sarah")).json()
    assert shown["suppressed"] is False and shown["averageFairness"] == 4.0 and shown["feltSafePct"] == 67
    assert shown["reformActions"][0] == {"action": "Manager coaching", "count": 3}
    assert client.get("/hr/insights", headers=as_("usr_elena")).status_code == 403
    types = [e["event_type"] for e in wait_verified(client, last["case_id"], last["case_token"])["events"]]
    assert {"resolution_recorded", "reflection_recorded"} <= set(types)


def test_legal_evidence_package(client):
    r = submit(client, description="Shouting in stand-ups, documented in chat logs.").json()
    client.post(f"/reports/{r['case_id']}/evidence", headers=auth(r["case_token"]),
                files={"file": ("chat.txt", b"log lines", "text/plain")})
    wait_verified(client, r["case_id"], r["case_token"])
    assert client.get(f"/hr/cases/{r['case_id']}/export.pdf", headers=as_("usr_marcus")).status_code == 403
    pdf = client.get(f"/hr/cases/{r['case_id']}/export.pdf", headers=as_("usr_elena"))
    assert pdf.status_code == 200 and pdf.content.startswith(b"%PDF")
    assert pdf.headers["content-type"] == "application/pdf" and pdf.headers["x-export-id"].startswith("EXP-")
    events = wait_verified(client, r["case_id"], r["case_token"])["events"]
    assert events[-1]["event_type"] == "export_generated"


def test_state_file_is_encrypted_at_rest(tmp_path):
    path = tmp_path / "state.json"
    env = {**ENV, "STUB_STATE_PATH": str(path), "ENCRYPTION_KEY": KEY}
    secret_text = "Very specific secret narrative about the server room."
    with TestClient(create_app(dict(env))) as c:
        r = submit(c, description=secret_text).json()
        c.post(f"/reports/{r['case_id']}/messages", headers=auth(r["case_token"]), json={"text": "private reply text"})
    raw = path.read_text()
    assert "server room" not in raw and "private reply text" not in raw
    with TestClient(create_app(dict(env))) as c:
        assert c.get(f"/reports/{r['case_id']}", headers=auth(r["case_token"])).json()["description"] == secret_text
    with pytest.raises(RuntimeError):
        create_app({**ENV, "STUB_STATE_PATH": str(path)})
