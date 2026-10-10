import pytest
from web3.exceptions import ContractLogicError

from app.chain.hashing import case_key
from app.chain.web3_client import revert_reason

pytestmark = pytest.mark.chain


def test_create_group_and_add_member(chain):
    sem, sender = chain["semaphore"], chain["sender"]
    group_id = sem.create_group(sender.address)
    added = sem.add_member(group_id, 123456789)
    assert added.index == 0 and added.commitment == 123456789
    assert sem.root(group_id) == added.root


def test_duplicate_member_reverts_with_reason(chain):
    sem, sender = chain["semaphore"], chain["sender"]
    group_id = sem.create_group(sender.address)
    sem.add_member(group_id, 42)
    with pytest.raises(ContractLogicError) as exc:
        sem.add_member(group_id, 42)
    assert revert_reason(exc.value) == "already_enrolled"


def test_registry_anchor_and_read_back(registry):
    key = case_key("INC-TEST-1")
    tx = registry.anchor(key, 1, "0x" + "ab" * 32)
    assert tx.tx_hash.startswith("0x") and tx.block_number > 0
    anchors = registry.anchors(key)
    assert [(a.seq, a.head) for a in anchors] == [(1, "0x" + "ab" * 32)]


def test_registry_rejects_stale_seq(registry):
    key = case_key("INC-TEST-2")
    registry.anchor(key, 3, "0x" + "01" * 32)
    with pytest.raises(ContractLogicError) as exc:
        registry.anchor(key, 3, "0x" + "02" * 32)
    assert revert_reason(exc.value) == "seq_not_increasing"


# --- ZK end-to-end: real Semaphore proofs from @semaphore-protocol/core -------------------------
import json
import subprocess
from pathlib import Path

from app.chain.semaphore import ProofIn
from app.chain.signals import message_text
from app.chain.zk_repo import InMemoryZkRepository
from app.chain.zk_service import ProofRejected, ZkService

PROOFGEN = Path(__file__).resolve().parents[3] / "tools" / "proofgen" / "gen.mjs"


def _node(*args):
    out = subprocess.run(["node", str(PROOFGEN), *args], check=True, capture_output=True, text=True, timeout=180)
    return json.loads(out.stdout)


def _wire(p):
    return ProofIn(merkle_tree_depth=p["merkleTreeDepth"], merkle_tree_root=p["merkleTreeRoot"],
                   nullifier=p["nullifier"], message=p["message"], scope=p["scope"], points=p["points"])


def test_js_proof_accepted_once_then_replay_and_forgery_rejected(chain):
    sem, sender = chain["semaphore"], chain["sender"]
    svc = ZkService(sem, InMemoryZkRepository(), sem.create_group(sender.address))
    svc.enroll(int(_node("commitment", "alice-secret")["commitment"]))
    svc.enroll(int(_node("commitment", "bob-secret")["commitment"]))

    payload = '{"category":"harassment","description":"test"}'
    scope = "cmp:2026-10-10"
    members = [str(m) for m in svc.group().members]
    proof = _wire(_node("proof", json.dumps({"secret": "alice-secret", "members": members,
                                             "message": message_text(payload), "scope": scope, "depth": 16}))["proof"])

    ok = svc.verify_submission(proof, payload, [scope], kind="complaint")
    assert ok.tx_hash.startswith("0x")

    with pytest.raises(ProofRejected) as exc:
        svc.verify_submission(proof, payload, [scope], kind="complaint")
    assert exc.value.reason == "replay"

    fresh = ZkService(sem, InMemoryZkRepository(), svc.group().group_id)
    with pytest.raises(ProofRejected) as exc:
        fresh.verify_submission(proof, payload, [scope], kind="complaint")
    assert exc.value.reason == "replay"  # the chain itself refuses the nullifier

    forged = proof.model_copy(update={"points": [proof.points[0] ^ 1] + proof.points[1:],
                                      "nullifier": proof.nullifier + 1})
    with pytest.raises(ProofRejected) as exc:
        fresh.verify_submission(forged, payload, [scope], kind="complaint")
    assert exc.value.reason in {"invalid_proof", "unknown_revert"}


def test_outsider_identity_rejected(chain):
    sem, sender = chain["semaphore"], chain["sender"]
    svc = ZkService(sem, InMemoryZkRepository(), sem.create_group(sender.address))
    svc.enroll(int(_node("commitment", "alice-secret")["commitment"]))
    payload, scope = '{"x":"y"}', "cmp:2026-10-10"
    eve = int(_node("commitment", "eve-secret")["commitment"])
    fake_members = [str(m) for m in svc.group().members] + [str(eve)]  # Eve builds a group she is in
    proof = _wire(_node("proof", json.dumps({"secret": "eve-secret", "members": fake_members,
                                             "message": message_text(payload), "scope": scope, "depth": 16}))["proof"])
    with pytest.raises(ProofRejected) as exc:
        svc.verify_submission(proof, payload, [scope], kind="complaint")
    assert exc.value.reason == "unknown_root"
