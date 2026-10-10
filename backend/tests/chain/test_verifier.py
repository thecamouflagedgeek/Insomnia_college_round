from dataclasses import replace

from app.chain.anchorer import Anchorer
from app.chain.audit_log import AuditLog
from app.chain.audit_repo import InMemoryAuditRepository
from app.chain.hashing import commitment, content_sha256
from app.chain.verifier import CaseVerifier
from tests.chain.fakes import FakeRegistry

COMPLAINT = b'{"description":"original"}'


def _setup(store=None):
    repo, reg = InMemoryAuditRepository(), FakeRegistry()
    store = store if store is not None else {"INC-1": COMPLAINT}
    log = AuditLog(repo)
    log.record("INC-1", "complaint_submitted", {"content_sha256": content_sha256(COMPLAINT)})
    log.record("INC-1", "committee_assigned", {"committee_id": "c1"})
    Anchorer(repo, reg).run_once()
    verifier = CaseVerifier(repo, reg, {"complaint_submitted": lambda case_id, data: store.get(case_id)},
                            "https://amoy.polygonscan.com/tx/{hash}")
    return repo, reg, log, verifier, store


def test_untouched_case_verifies():
    _, _, _, v, _ = _setup()
    r = v.verify("INC-1")
    assert r.ok
    assert [e.status for e in r.events] == ["verified", "verified"]
    assert r.events[0].content_ok is True and r.events[1].content_ok is None
    assert [a.ok for a in r.anchors] == [True]


def test_new_event_is_pending_until_anchored():
    repo, reg, log, v, _ = _setup()
    log.record("INC-1", "status_changed", {"from": "review", "to": "investigating"})
    r = v.verify("INC-1")
    assert r.ok and r.events[-1].status == "pending_anchor"
    Anchorer(repo, reg).run_once()
    assert v.verify("INC-1").events[-1].status == "verified"


def test_tampered_audit_payload_detected_even_if_commitment_left_alone():
    repo, _, _, v, _ = _setup()
    chain = repo._events["INC-1"]
    ev = chain[1]
    chain[1] = replace(ev, payload={**ev.payload, "data": {"committee_id": "c2"}})
    r = v.verify("INC-1")
    assert not r.ok
    assert r.events[1].commitment_ok is False and r.events[1].status == "tampered"
    assert r.anchors[0].ok is False


def test_rewritten_commitment_still_breaks_anchor():
    repo, _, _, v, _ = _setup()
    chain = repo._events["INC-1"]
    ev = chain[1]
    forged = {**ev.payload, "data": {"committee_id": "c2"}}
    chain[1] = replace(ev, payload=forged, commitment=commitment(ev.salt, forged))
    r = v.verify("INC-1")
    assert not r.ok and r.events[1].chain_ok is False and r.anchors[0].ok is False


def test_edited_complaint_text_detected():
    _, _, _, v, store = _setup()
    store["INC-1"] = b'{"description":"softened"}'
    r = v.verify("INC-1")
    assert not r.ok and r.events[0].content_ok is False and r.events[0].status == "tampered"


def test_deleted_event_detected():
    repo, _, _, v, _ = _setup()
    repo._events["INC-1"].pop()
    r = v.verify("INC-1")
    assert not r.ok and r.anchors[0].recomputed_head is None


def test_receipts_link_anchor_tx():
    _, _, _, v, _ = _setup()
    rs = v.receipts("INC-1")
    assert [r.seq for r in rs] == [1, 2]
    assert rs[0].anchor_seq == 2 and rs[0].explorer_url.startswith("https://amoy.polygonscan.com/tx/0x")


def test_status_pinpoints_the_edited_event():
    repo, _, log, v, _ = _setup()
    log.record("INC-1", "status_changed", {"from": "review", "to": "investigating"})
    Anchorer(repo, v._registry).run_once()
    chain = repo._events["INC-1"]
    ev = chain[1]
    chain[1] = replace(ev, payload={**ev.payload, "data": {"committee_id": "c2"}})
    r = v.verify("INC-1")
    assert [e.status for e in r.events] == ["anchor_mismatch", "tampered", "chain_broken"]
    assert r.first_bad_seq == 2


def test_first_bad_seq_none_when_ok():
    _, _, _, v, _ = _setup()
    assert v.verify("INC-1").first_bad_seq is None
