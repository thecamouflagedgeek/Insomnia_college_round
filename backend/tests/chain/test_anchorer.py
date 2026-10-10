import threading
import time

from app.chain.anchorer import Anchorer
from app.chain.audit_log import AuditLog
from app.chain.audit_repo import InMemoryAuditRepository
from app.chain.hashing import case_key
from tests.chain.fakes import FakeRegistry


def test_anchors_only_latest_head_per_case_and_is_idempotent():
    repo, reg = InMemoryAuditRepository(), FakeRegistry()
    log = AuditLog(repo)
    log.record("INC-1", "complaint_submitted", {})
    last = log.record("INC-1", "severity_assessed", {"level": "high"})
    log.record("INC-2", "complaint_submitted", {})

    done = Anchorer(repo, reg).run_once()
    assert sorted((r.case_id, r.seq) for r in done) == [("INC-1", 2), ("INC-2", 1)]
    assert reg.anchors(case_key("INC-1"))[0].head == last.entry_hash
    assert Anchorer(repo, reg).run_once() == []


def test_failure_on_one_case_does_not_lose_others():
    repo, reg = InMemoryAuditRepository(), FakeRegistry()
    log = AuditLog(repo)
    log.record("BAD", "complaint_submitted", {})
    log.record("GOOD", "complaint_submitted", {})
    original = reg.anchor

    def flaky(key, seq, head):
        if key == case_key("BAD"):
            raise RuntimeError("rpc down")
        return original(key, seq, head)

    reg.anchor = flaky
    done = Anchorer(repo, reg).run_once()
    assert [r.case_id for r in done] == ["GOOD"]
    assert [c for c, _, _ in repo.unanchored_heads()] == ["BAD"]


def test_run_forever_stops():
    repo, reg = InMemoryAuditRepository(), FakeRegistry()
    AuditLog(repo).record("INC-1", "complaint_submitted", {})
    stop = threading.Event()
    t = threading.Thread(target=Anchorer(repo, reg).run_forever, args=(stop, 0.01))
    t.start()
    deadline = time.time() + 2
    while not reg.anchors(case_key("INC-1")) and time.time() < deadline:
        time.sleep(0.01)
    stop.set()
    t.join(timeout=2)
    assert reg.anchors(case_key("INC-1")) and not t.is_alive()
