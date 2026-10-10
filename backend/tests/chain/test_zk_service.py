import pytest

from app.chain.semaphore import ProofIn
from app.chain.signals import bytes32_text, message_text
from app.chain.zk_repo import InMemoryZkRepository
from app.chain.zk_service import EnrollmentRejected, ProofRejected, ZkService
from tests.chain.fakes import FakeCustomError, FakeSemaphore

PAYLOAD = '{"category":"harassment","description":"..."}'
SCOPE = "cmp:2026-10-10"


def _svc():
    sem, repo = FakeSemaphore(), InMemoryZkRepository()
    return ZkService(sem, repo, group_id=1), sem, repo


def _proof(payload=PAYLOAD, scope=SCOPE, nullifier=9):
    return ProofIn(merkle_tree_depth=16, merkle_tree_root=1001, nullifier=nullifier,
                   message=bytes32_text(message_text(payload)), scope=bytes32_text(scope), points=[0] * 8)


def test_enroll_mirrors_member_and_group_view():
    svc, _, _ = _svc()
    m = svc.enroll(555)
    assert (m.index, m.commitment) == (0, 555)
    view = svc.group()
    assert view.members == [555] and view.root == m.root == view.onchain_root


def test_enroll_twice_rejected():
    svc, _, _ = _svc()
    svc.enroll(555)
    with pytest.raises(EnrollmentRejected) as exc:
        svc.enroll(555)
    assert exc.value.reason == "already_enrolled"


def test_valid_submission_is_consumed_once():
    svc, _, repo = _svc()
    ok = svc.verify_submission(_proof(), PAYLOAD, [SCOPE], kind="complaint")
    assert ok.nullifier == 9 and ok.scope_text == SCOPE and ok.tx_hash.startswith("0x")
    assert repo.nullifier_used(9)
    with pytest.raises(ProofRejected) as exc:
        svc.verify_submission(_proof(), PAYLOAD, [SCOPE], kind="complaint")
    assert exc.value.reason == "replay"


def test_replay_caught_on_chain_even_if_db_forgot():
    svc, sem, _ = _svc()
    svc.verify_submission(_proof(), PAYLOAD, [SCOPE], kind="complaint")
    fresh = ZkService(sem, InMemoryZkRepository(), group_id=1)
    with pytest.raises(ProofRejected) as exc:
        fresh.verify_submission(_proof(), PAYLOAD, [SCOPE], kind="complaint")
    assert exc.value.reason == "replay"


def test_payload_swap_rejected():
    svc, _, _ = _svc()
    with pytest.raises(ProofRejected) as exc:
        svc.verify_submission(_proof(), PAYLOAD + " ", [SCOPE], kind="complaint")
    assert exc.value.reason == "message_mismatch"


def test_wrong_scope_rejected():
    svc, _, _ = _svc()
    with pytest.raises(ProofRejected) as exc:
        svc.verify_submission(_proof(scope="cmp:2026-10-01"), PAYLOAD, [SCOPE], kind="complaint")
    assert exc.value.reason == "scope_mismatch"


def test_forged_proof_rejected():
    svc, sem, _ = _svc()
    sem.valid = False
    with pytest.raises(ProofRejected) as exc:
        svc.verify_submission(_proof(), PAYLOAD, [SCOPE], kind="complaint")
    assert exc.value.reason == "invalid_proof"


def test_unknown_root_reason_propagates():
    svc, sem, _ = _svc()
    sem.verify_error = FakeCustomError("Semaphore__MerkleTreeRootIsNotPartOfTheGroup()")
    with pytest.raises(ProofRejected) as exc:
        svc.verify_submission(_proof(), PAYLOAD, [SCOPE], kind="complaint")
    assert exc.value.reason == "unknown_root"
