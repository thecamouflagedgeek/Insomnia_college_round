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
