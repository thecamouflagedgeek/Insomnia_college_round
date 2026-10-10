from datetime import datetime, timezone

import pytest

from app.chain.audit_log import AuditLog
from app.chain.audit_repo import AnchorRecord, InMemoryAuditRepository
from app.chain.hashing import ZERO_HASH, NonCanonicalValue, case_key, commitment, entry_hash

FIXED = datetime(2026, 10, 10, 12, 0, 0, tzinfo=timezone.utc)


def _log():
    repo = InMemoryAuditRepository()
    return AuditLog(repo, clock=lambda: FIXED), repo


def test_first_event_chains_from_zero_hash():
    log, _ = _log()
    ev = log.record("INC-1", "complaint_submitted", {"content_sha256": "ab" * 32})
    assert ev.seq == 1 and ev.prev_hash == ZERO_HASH
    assert ev.payload == {"type": "complaint_submitted", "data": {"content_sha256": "ab" * 32},
                          "at": "2026-10-10T12:00:00+00:00"}
    assert ev.commitment == commitment(ev.salt, ev.payload)
    assert ev.entry_hash == entry_hash(case_key("INC-1"), ZERO_HASH, 1, ev.commitment)


def test_events_chain_per_case():
    log, repo = _log()
    a1 = log.record("INC-1", "complaint_submitted", {})
    b1 = log.record("INC-2", "complaint_submitted", {})
    a2 = log.record("INC-1", "committee_assigned", {"committee_id": "c1"})
    assert (a2.seq, a2.prev_hash) == (2, a1.entry_hash)
    assert b1.seq == 1
    assert [e.seq for e in repo.events("INC-1")] == [1, 2]


def test_unknown_event_type_rejected():
    log, _ = _log()
    with pytest.raises(ValueError):
        log.record("INC-1", "made_up", {})


def test_float_data_rejected_before_writing():
    log, repo = _log()
    with pytest.raises(NonCanonicalValue):
        log.record("INC-1", "severity_assessed", {"score": 0.7})
    assert repo.events("INC-1") == []


def test_unanchored_heads_and_anchors():
    log, repo = _log()
    log.record("INC-1", "complaint_submitted", {})
    e2 = log.record("INC-1", "committee_assigned", {})
    assert repo.unanchored_heads() == [("INC-1", 2, e2.entry_hash)]
    repo.save_anchor(AnchorRecord("INC-1", 2, e2.entry_hash, "0xabc", 7))
    assert repo.unanchored_heads() == []
    e3 = log.record("INC-1", "status_changed", {"to": "investigating"})
    assert repo.unanchored_heads() == [("INC-1", 3, e3.entry_hash)]
