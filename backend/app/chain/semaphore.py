from dataclasses import dataclass

from pydantic import BaseModel, Field, field_validator
from web3 import Web3
from web3.logs import DISCARD

_PROOF = {
    "name": "proof", "type": "tuple", "components": [
        {"name": "merkleTreeDepth", "type": "uint256"},
        {"name": "merkleTreeRoot", "type": "uint256"},
        {"name": "nullifier", "type": "uint256"},
        {"name": "message", "type": "uint256"},
        {"name": "scope", "type": "uint256"},
        {"name": "points", "type": "uint256[8]"},
    ],
}
_GROUP_ID = {"name": "groupId", "type": "uint256"}

SEMAPHORE_ABI = [
    {"type": "function", "name": "createGroup", "stateMutability": "nonpayable",
     "inputs": [{"name": "admin", "type": "address"}], "outputs": [{"name": "", "type": "uint256"}]},
    {"type": "function", "name": "addMember", "stateMutability": "nonpayable",
     "inputs": [_GROUP_ID, {"name": "identityCommitment", "type": "uint256"}], "outputs": []},
    {"type": "function", "name": "validateProof", "stateMutability": "nonpayable",
     "inputs": [_GROUP_ID, _PROOF], "outputs": []},
    {"type": "function", "name": "verifyProof", "stateMutability": "view",
     "inputs": [_GROUP_ID, _PROOF], "outputs": [{"name": "", "type": "bool"}]},
    {"type": "function", "name": "getMerkleTreeRoot", "stateMutability": "view",
     "inputs": [_GROUP_ID], "outputs": [{"name": "", "type": "uint256"}]},
    {"type": "event", "name": "GroupCreated", "anonymous": False,
     "inputs": [{"name": "groupId", "type": "uint256", "indexed": True}]},
    {"type": "event", "name": "MemberAdded", "anonymous": False, "inputs": [
        {"name": "groupId", "type": "uint256", "indexed": True},
        {"name": "index", "type": "uint256", "indexed": False},
        {"name": "identityCommitment", "type": "uint256", "indexed": False},
        {"name": "merkleTreeRoot", "type": "uint256", "indexed": False},
    ]},
]


class ProofIn(BaseModel):
    """Wire format for a Semaphore proof (decimal strings or ints). Points are Solidity-packed."""
    merkle_tree_depth: int = Field(ge=1, le=32)
    merkle_tree_root: int
    nullifier: int
    message: int
    scope: int
    points: list[int] = Field(min_length=8, max_length=8)

    @field_validator("merkle_tree_root", "nullifier", "message", "scope")
    @classmethod
    def _uint256(cls, v: int) -> int:
        if not 0 <= v < 2**256:
            raise ValueError("must be a uint256")
        return v

    @field_validator("points")
    @classmethod
    def _points_uint256(cls, v: list[int]) -> list[int]:
        if any(not 0 <= p < 2**256 for p in v):
            raise ValueError("points must be uint256")
        return v

    def as_tuple(self) -> tuple:
        return (self.merkle_tree_depth, self.merkle_tree_root, self.nullifier,
                self.message, self.scope, list(self.points))


def pack_groth16(a: list[int], b: list[list[int]], c: list[int]) -> list[int]:
    """snarkjs/arkworks (a, b, c) -> the 8 points the Solidity verifier expects (G2 coords swapped)."""
    return [a[0], a[1], b[0][1], b[0][0], b[1][1], b[1][0], c[0], c[1]]


@dataclass(frozen=True)
class AddedMember:
    index: int
    commitment: int
    root: int
    tx_hash: str


class SemaphoreClient:
    def __init__(self, w3: Web3, sender, address: str):
        self._c = w3.eth.contract(address=Web3.to_checksum_address(address), abi=SEMAPHORE_ABI)
        self._sender = sender

    def create_group(self, admin: str) -> int:
        receipt = self._sender.send(self._c.functions.createGroup(Web3.to_checksum_address(admin)))
        return self._c.events.GroupCreated().process_receipt(receipt, errors=DISCARD)[0]["args"]["groupId"]

    def add_member(self, group_id: int, commitment: int) -> AddedMember:
        receipt = self._sender.send(self._c.functions.addMember(group_id, commitment))
        args = self._c.events.MemberAdded().process_receipt(receipt, errors=DISCARD)[0]["args"]
        return AddedMember(index=args["index"], commitment=args["identityCommitment"],
                           root=args["merkleTreeRoot"], tx_hash=Web3.to_hex(receipt["transactionHash"]))

    def verify(self, group_id: int, proof: ProofIn) -> bool:
        return self._c.functions.verifyProof(group_id, proof.as_tuple()).call()

    def validate(self, group_id: int, proof: ProofIn) -> str:
        receipt = self._sender.send(self._c.functions.validateProof(group_id, proof.as_tuple()))
        return Web3.to_hex(receipt["transactionHash"])

    def root(self, group_id: int) -> int:
        return self._c.functions.getMerkleTreeRoot(group_id).call()
