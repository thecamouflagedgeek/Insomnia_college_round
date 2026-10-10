"""Run with TEST_DATABASE_URL pointing at a scratch Postgres that has migrations/0040_chain.sql applied."""
import os
import uuid

import psycopg
import pytest

from app.chain.audit_log import AuditLog
from app.chain.audit_repo import AnchorRecord, PostgresAuditRepository
from app.chain.hashing import commitment
from app.chain.zk_repo import Member, PostgresZkRepository

DSN = os.environ.get("TEST_DATABASE_URL")
pytestmark = pytest.mark.skipif(not DSN, reason="TEST_DATABASE_URL not set")


def test_audit_roundtrip_keeps_commitment_valid():
    repo = PostgresAuditRepository(DSN)
    case = f"PG-{uuid.uuid4()}"
    log = AuditLog(repo)
    e1 = log.record(case, "complaint_submitted", {"content_sha256": "ab" * 32, "nullifier": str(2**250)})
    e2 = log.record(case, "committee_assigned", {"committee_id": "c1", "member_ids": ["m1", "m2"], "note": "é"})
    stored = repo.events(case)
    assert [e.seq for e in stored] == [1, 2] and stored[1].prev_hash == e1.entry_hash
    for original, back in zip([e1, e2], stored):
        assert back == original
        assert commitment(back.salt, back.payload) == back.commitment  # jsonb round-trip is lossless


def test_unanchored_heads_and_anchor_records():
    repo = PostgresAuditRepository(DSN)
    case = f"PG-{uuid.uuid4()}"
    log = AuditLog(repo)
    log.record(case, "complaint_submitted", {})
    e2 = log.record(case, "status_changed", {"from": "new", "to": "review"})
    assert (case, 2, e2.entry_hash) in repo.unanchored_heads()
    repo.save_anchor(AnchorRecord(case, 2, e2.entry_hash, "0xabc", 7))
    assert all(c != case for c, _, _ in repo.unanchored_heads())
    assert repo.anchors(case) == [AnchorRecord(case, 2, e2.entry_hash, "0xabc", 7)]


def test_audit_events_are_append_only():
    repo = PostgresAuditRepository(DSN)
    case = f"PG-{uuid.uuid4()}"
    AuditLog(repo).record(case, "complaint_submitted", {})
    with psycopg.connect(DSN) as conn:
        with pytest.raises(psycopg.errors.RaiseException):
            conn.execute("update audit_events set event_type = 'x' where case_id = %s", (case,))


def test_zk_repo_roundtrip_with_big_numbers():
    repo = PostgresZkRepository(DSN)
    big = 2**253 + uuid.uuid4().int
    with psycopg.connect(DSN) as conn:
        next_index = conn.execute("select coalesce(max(member_index), -1) + 1 from zk_members").fetchone()[0]
    repo.add_member(Member(next_index, big, big - 1, "0xabc"))
    assert repo.has_commitment(big)
    assert repo.members()[-1] == Member(next_index, big, big - 1, "0xabc")
    n = 2**254 + uuid.uuid4().int
    assert not repo.nullifier_used(n)
    repo.save_nullifier(n, 1, 2, "complaint", "0xdef")
    assert repo.nullifier_used(n)
