import pytest
from pydantic import ValidationError
from web3 import Web3

from app.chain.semaphore import ProofIn, pack_groth16
from app.chain.web3_client import revert_reason


def _proof(**kw):
    base = dict(merkle_tree_depth=16, merkle_tree_root="1", nullifier="2", message="3", scope="4",
                points=[str(i) for i in range(8)])
    return ProofIn(**{**base, **kw})


def test_proof_parses_decimal_strings_and_builds_tuple():
    assert _proof().as_tuple() == (16, 1, 2, 3, 4, [0, 1, 2, 3, 4, 5, 6, 7])


@pytest.mark.parametrize("bad", [
    {"points": ["1"] * 7},
    {"merkle_tree_depth": 0},
    {"merkle_tree_depth": 33},
    {"nullifier": str(2**256)},
    {"scope": "-1"},
])
def test_proof_rejects_bad_fields(bad):
    with pytest.raises(ValidationError):
        _proof(**bad)


def test_pack_groth16_swaps_g2_coordinates():
    a, b, c = [1, 2], [[3, 4], [5, 6]], [7, 8]
    assert pack_groth16(a, b, c) == [1, 2, 4, 3, 6, 5, 7, 8]


class _FakeCustomError(Exception):
    def __init__(self, data):
        super().__init__("reverted")
        self.data = data


def test_revert_reason_maps_known_selectors():
    sel = Web3.to_hex(Web3.keccak(text="Semaphore__YouAreUsingTheSameNullifierTwice()")[:4])
    assert revert_reason(_FakeCustomError(sel)) == "replay"
    sel = Web3.to_hex(Web3.keccak(text="SeqNotIncreasing(uint64,uint64)")[:4])
    assert revert_reason(_FakeCustomError(sel + "00" * 64)) == "seq_not_increasing"


def test_revert_reason_unknown():
    assert revert_reason(_FakeCustomError("0xdeadbeef")) == "unknown_revert"
    assert revert_reason(Exception("no data")) == "unknown_revert"
