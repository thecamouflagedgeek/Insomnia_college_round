from web3 import Web3

from app.chain.registry import AnchorTx, OnchainAnchor
from app.chain.semaphore import AddedMember


class FakeCustomError(Exception):
    def __init__(self, signature: str):
        super().__init__(signature)
        self.data = Web3.to_hex(Web3.keccak(text=signature)[:4])


class FakeSemaphore:
    def __init__(self):
        self.members: list[int] = []
        self.used: set[int] = set()
        self.valid = True
        self.verify_error: Exception | None = None

    def add_member(self, group_id, commitment):
        if commitment in self.members:
            raise FakeCustomError("LeafAlreadyExists()")
        self.members.append(commitment)
        return AddedMember(index=len(self.members) - 1, commitment=commitment,
                           root=1000 + len(self.members), tx_hash=f"0x{len(self.members):064x}")

    def root(self, group_id):
        return 1000 + len(self.members)

    def verify(self, group_id, proof):
        if self.verify_error:
            raise self.verify_error
        return self.valid

    def validate(self, group_id, proof):
        if proof.nullifier in self.used:
            raise FakeCustomError("Semaphore__YouAreUsingTheSameNullifierTwice()")
        self.used.add(proof.nullifier)
        return "0x" + "77" * 32


class FakeRegistry:
    def __init__(self):
        self.store: dict[str, list[OnchainAnchor]] = {}
        self.calls = 0

    def anchor(self, case_key_hex, seq, head_hex):
        self.calls += 1
        self.store.setdefault(case_key_hex, []).append(OnchainAnchor(seq=seq, head=head_hex, timestamp=0))
        return AnchorTx(tx_hash=f"0x{self.calls:064x}", block_number=self.calls)

    def anchors(self, case_key_hex):
        return list(self.store.get(case_key_hex, []))
