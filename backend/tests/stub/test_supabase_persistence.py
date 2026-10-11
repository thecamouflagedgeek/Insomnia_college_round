"""Supabase persistence against a schema-enforcing in-memory client (tests/stub/fake_supabase.py).

No test contacts the live project. What these prove: canonical column names and allowed values only, encryption
before persistence, honest failures (503 and no in-memory or audit change), and that a restart rebuilds the same
cases, messages and verifiable audit history from the stored rows.
"""
import base64
import json

import pytest
from fastapi.testclient import TestClient

from app.chain.signals import challenge_scope_text
from app.core.supabase_repo import ordered_pair, report_row_id
from app.stub.main import create_app
from tests.stub.fake_supabase import FakeSupabase
from tests.stub.test_stub_api import ENV, KEY, auth, proof, submit, wait_verified

STAFF = lambda sid: {"X-Stub-Admin": "adm", "X-Staff-Id": sid}  # noqa: E731


@pytest.fixture
def env(tmp_path):
    return {**ENV, "ENCRYPTION_KEY": KEY, "STUB_STATE_PATH": str(tmp_path / "state.json")}


@pytest.fixture
def db():
    return FakeSupabase()


def app_client(env, db):
    return TestClient(create_app(dict(env), supabase_client=db))


def challenge(client, case_id, token, member="usr_marcus"):
    cp = json.dumps({"member_id": member, "reason": "Professional relationship",
                     "explanation": "He is my direct skip-level manager.", "client_nonce": "c-123456789"})
    return client.post(f"/reports/{case_id}/challenge", headers=auth(token),
                       json={"payload": cp, "proof": proof(cp, challenge_scope_text(case_id, member))})


def test_demo_data_is_never_seeded_into_supabase(env, db):
    with app_client(env, db) as c:
        assert c.get("/hr/cases", headers=STAFF("usr_sarah")).json() == []
    assert db.rows["reports"] == [] and db.rows["audit_events"] == []


def test_full_workflow_uses_canonical_columns_encrypts_and_survives_restart(env, db):
    with app_client(env, db) as c:
        r = submit(c).json()
        case_id, token = r["case_id"], r["case_token"]
        rid = report_row_id(case_id)

        report = db.rows["reports"][0]
        assert report["public_reference"] == case_id and report["status"] == "triage"  # committee_assigned
        assert report["severity"] in {"low", "medium", "high", "critical"}
        assert "shouting" not in report["description_ciphertext"]  # encrypted before persistence
        assert db.rows["report_workflow"][0]["lifecycle_stage"] == "committee_assigned"

        assert c.post(f"/reports/{case_id}/evidence", headers=auth(token),
                      files={"file": ("note.txt", b"meeting notes", "text/plain")}).status_code == 201
        ev = db.rows["evidence_items"][0]
        assert ev["report_id"] == rid and ev["mime_type"] == "text/plain" and ev["size_bytes"] == 13
        stored = db.objects[("incognito-evidence", ev["storage_object_path"])]
        assert b"meeting notes" not in stored  # the object is encrypted

        assert c.post(f"/reports/{case_id}/messages", headers=auth(token), json={"text": "It happens weekly."}
                      ).status_code == 201
        assert c.post(f"/hr/cases/{case_id}/messages", headers=STAFF("usr_elena"), json={"text": "Which day?"}
                      ).status_code == 201
        assert [m["sender_role"] for m in db.rows["investigation_messages"]] == ["reporter", "investigator"]
        assert all("weekly" not in m["body_ciphertext"] for m in db.rows["investigation_messages"])

        assert challenge(c, case_id, token).status_code == 201
        assert db.rows["committee_challenges"][0]["status"] == "pending"
        assert db.rows["reports"][0]["status"] == "under_review"
        cid = c.get("/hr/challenges", headers=STAFF("usr_aris")).json()[0]["id"]
        out = c.post(f"/hr/challenges/{cid}/decide", headers=STAFF("usr_aris"),
                     json={"decision": "approve", "rationale": "Direct reporting line is a clear conflict.",
                           "replacement_member_id": "usr_priya"})
        assert out.status_code == 200, out.text
        assert db.rows["committee_challenges"][0]["status"] == "reassigned"
        assert db.rows["committee_challenges"][0]["decision_note_ciphertext"]

        inv = c.post(f"/hr/cases/{case_id}/witnesses", headers=STAFF("usr_elena"),
                     json={"context": "You were in the sprint review on Oct 8.", "alias": "Witness A"})
        assert inv.status_code in (200, 201), inv.text
        assert db.rows["witness_invitations"][0]["status"] == "invited"
        assert inv.json()["witnessCode"] not in json.dumps(db.rows["witness_invitations"])  # only the hash

        res = c.post(f"/hr/cases/{case_id}/resolve", headers=STAFF("usr_sarah"),
                     json={"outcome": "substantiated", "summary": "Findings recorded after interviews.",
                           "actions": ["Coaching"]})
        assert res.status_code == 200, res.text
        assert db.rows["reports"][0]["status"] == "resolved"
        before = wait_verified(c, case_id, token)["events"]
        assert all(r["event_type"] != "chain_anchor" or r["blockchain_tx_hash"] is None
                   for r in db.rows["audit_events"])  # offline anchors never pose as Polygon transactions

    with app_client(env, db) as c2:  # restart: everything comes back from the stored rows
        view = c2.get(f"/reports/{case_id}", headers=auth(token))
        assert view.status_code == 200 and view.json()["title"] == "Team conduct"
        msgs = c2.get(f"/hr/cases/{case_id}/messages", headers=STAFF("usr_elena")).json()
        assert [m["text"] for m in msgs] == ["It happens weekly.", "Which day?"]
        after = wait_verified(c2, case_id, token)["events"]
        assert [e["event_type"] for e in after] == [e["event_type"] for e in before]
        assert c2.get(f"/hr/cases/{case_id}", headers=STAFF("usr_marcus")).status_code == 403  # still removed
        ev_id = c2.get(f"/hr/cases/{case_id}", headers=STAFF("usr_sarah")).json()["evidence"][0]["id"]
        check = c2.get(f"/hr/cases/{case_id}/evidence/{ev_id}/verify", headers=STAFF("usr_sarah")).json()
        assert check["sha256Matches"] is True  # fetched from storage and decrypted


def test_failed_write_returns_503_and_changes_nothing(env, db):
    with app_client(env, db) as c:
        r = submit(c).json()
        case_id, token = r["case_id"], r["case_token"]
        events_before = len(db.rows["audit_events"])
        db.fail_on.add("investigation_messages")
        res = c.post(f"/reports/{case_id}/messages", headers=auth(token), json={"text": "Lost?"})
        assert res.status_code == 503 and res.json()["detail"]["reason"] == "persistence_failed"
        assert all(m["text"] != "Lost?" for m in c.get(f"/reports/{case_id}/messages", headers=auth(token)).json())
        assert len(db.rows["audit_events"]) == events_before  # no audit entry for something that did not happen

        db.fail_on.clear()
        db.fail_on.add("incognito-evidence")
        up = c.post(f"/reports/{case_id}/evidence", headers=auth(token),
                    files={"file": ("n.txt", b"x", "text/plain")})
        assert up.status_code == 503
        assert c.get(f"/reports/{case_id}", headers=auth(token)).json()["evidence"] == []


def test_failed_report_write_creates_no_case(env, db):
    with app_client(env, db) as c:
        db.fail_on.add("report_workflow")  # e.g. migration 0051 not applied yet
        assert submit(c).status_code == 503
        assert c.get("/hr/cases", headers=STAFF("usr_sarah")).json() == []
        assert db.rows["audit_events"] == []


def test_evidence_types_outside_the_bucket_policy_are_refused(env, db):
    with app_client(env, db) as c:
        r = submit(c).json()
        res = c.post(f"/reports/{r['case_id']}/evidence", headers=auth(r["case_token"]),
                     files={"file": ("a.zip", b"PK\x03\x04", "application/zip")})
        assert res.status_code == 415 and db.rows["evidence_items"] == []


def test_correlations_are_advisory_normalized_and_unique(env, db):
    from tests.stub.test_stub_api import report_payload
    with app_client(env, db) as c:
        text = "My manager shouted at the team and humiliated junior engineers in sprint reviews this month."
        a = submit(c, report_payload(description=text)).json()["case_id"]
        b = submit(c, report_payload(title="Sprint reviews", description=text + " Again on Friday.")).json()["case_id"]
        rows = db.rows["incident_correlations"]
        assert len(rows) == 1
        lo, hi = ordered_pair(report_row_id(a), report_row_id(b))
        assert (rows[0]["report_id_a"], rows[0]["report_id_b"]) == (lo, hi) and lo < hi
        assert rows[0]["review_status"] == "pending"
        assert len(c.get("/hr/cases", headers=STAFF("usr_sarah")).json()) == 2  # never merged or rejected


# ---- fault isolation: a fault disables only the function it affects -----------------------------------------------

def test_missing_encryption_key_stops_writes_only(db):
    with TestClient(create_app({**ENV, "ENCRYPTION_KEY": ""}, supabase_client=db)) as c:
        health = c.get("/health").json()
        assert health["ok"] is True and health["database"]["status"] == "down"
        assert health["database"]["writes"] is False and "ENCRYPTION_KEY" in health["database"]["reason"]
        res = submit(c)
        assert res.status_code == 503 and res.json()["detail"]["reason"] == "persistence_unavailable"
        assert c.get("/hr/cases", headers=STAFF("usr_sarah")).status_code == 200  # reads still answer
        assert c.get("/zk/group").status_code == 200  # proofs/membership still work
    assert db.rows["reports"] == []


def test_unreachable_database_at_startup_stops_writes_only(env, db):
    db.fail_on.add("reports")
    with app_client(env, db) as c:
        assert c.get("/health").json()["database"]["status"] == "down"
        assert submit(c).status_code == 503
        assert c.get("/zk/group").status_code == 200


def test_one_unreadable_record_disables_only_itself(env, db):
    with app_client(env, db) as c:
        a = submit(c).json()
        c.post(f"/reports/{a['case_id']}/messages", headers=auth(a["case_token"]), json={"text": "first"})
        c.post(f"/reports/{a['case_id']}/messages", headers=auth(a["case_token"]), json={"text": "second"})
        b = submit(c).json()
    db.rows["investigation_messages"][0]["body_ciphertext"] = "corrupted"  # one bad row
    with app_client(env, db) as c2:
        health = c2.get("/health").json()["database"]
        assert health["status"] == "degraded" and health["writes"] is True
        assert any("investigation_messages: 1" in p for p in health["problems"])
        msgs = c2.get(f"/reports/{a['case_id']}/messages", headers=auth(a["case_token"])).json()
        assert [m["text"] for m in msgs] == ["second"]  # the rest of the thread loads
        assert c2.get(f"/reports/{b['case_id']}", headers=auth(b["case_token"])).status_code == 200
        assert c2.post(f"/reports/{b['case_id']}/messages", headers=auth(b["case_token"]),
                       json={"text": "still works"}).status_code == 201  # writes unaffected


def test_unreadable_audit_log_keeps_cases_readable_but_stops_writes(env, db):
    with app_client(env, db) as c:
        a = submit(c).json()
    db.fail_on.add("audit_events")
    with app_client(env, db) as c2:
        assert c2.get(f"/reports/{a['case_id']}", headers=auth(a["case_token"])).status_code == 200
        h = c2.get("/health").json()["database"]
        assert h["status"] == "down" and "audit" in h["reason"]
        assert c2.post(f"/reports/{a['case_id']}/messages", headers=auth(a["case_token"]),
                       json={"text": "x"}).status_code == 503


def test_missing_workflow_table_only_blocks_report_saving(env, db):
    db.fail_on.add("report_workflow")  # migration 0051 not applied
    with app_client(env, db) as c:
        h = c.get("/health").json()["database"]
        assert h["status"] == "degraded" and any("report_workflow" in p for p in h["problems"])
        assert submit(c).status_code == 503  # this function fails...
        assert c.get("/zk/group").status_code == 200  # ...others do not
