import json
from dataclasses import dataclass
from pathlib import Path

from web3 import Web3

from app.chain.hashing import from_hex, to_hex

REGISTRY_ABI = json.loads((Path(__file__).parent / "abi" / "CaseAuditRegistry.json").read_text())


@dataclass(frozen=True)
class OnchainAnchor:
    seq: int
    head: str
    timestamp: int


@dataclass(frozen=True)
class AnchorTx:
    tx_hash: str
    block_number: int


class RegistryClient:
    def __init__(self, w3: Web3, sender, address: str):
        self._c = w3.eth.contract(address=Web3.to_checksum_address(address), abi=REGISTRY_ABI)
        self._sender = sender

    def anchor(self, case_key_hex: str, seq: int, head_hex: str) -> AnchorTx:
        receipt = self._sender.send(self._c.functions.anchor(from_hex(case_key_hex), seq, from_hex(head_hex)))
        return AnchorTx(tx_hash=Web3.to_hex(receipt["transactionHash"]), block_number=receipt["blockNumber"])

    def anchors(self, case_key_hex: str) -> list[OnchainAnchor]:
        key = from_hex(case_key_hex)
        count = self._c.functions.anchorCount(key).call()
        out = []
        for i in range(count):
            head, seq, ts = self._c.functions.getAnchor(key, i).call()
            out.append(OnchainAnchor(seq=seq, head=to_hex(head), timestamp=ts))
        return out
