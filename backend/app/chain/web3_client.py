import threading

from eth_account import Account
from web3 import Web3
from web3.middleware import ExtraDataToPOAMiddleware

_ERRORS = {
    "Semaphore__InvalidProof()": "invalid_proof",
    "Semaphore__YouAreUsingTheSameNullifierTwice()": "replay",
    "Semaphore__MerkleTreeRootIsExpired()": "root_expired",
    "Semaphore__MerkleTreeRootIsNotPartOfTheGroup()": "unknown_root",
    "Semaphore__MerkleTreeDepthIsNotSupported()": "bad_depth",
    "Semaphore__GroupHasNoMembers()": "empty_group",
    "Semaphore__GroupDoesNotExist()": "no_group",
    "Semaphore__CallerIsNotTheGroupAdmin()": "not_group_admin",
    "LeafAlreadyExists()": "already_enrolled",
    "LeafGreaterThanSnarkScalarField()": "bad_commitment",
    "NotAnchorer()": "not_anchorer",
    "SeqNotIncreasing(uint64,uint64)": "seq_not_increasing",
    "ZeroHead()": "zero_head",
}
ERROR_BY_SELECTOR = {Web3.to_hex(Web3.keccak(text=sig)[:4]): code for sig, code in _ERRORS.items()}


def revert_reason(exc: Exception) -> str:
    data = getattr(exc, "data", None)
    if not isinstance(data, str):
        return "unknown_revert"
    return ERROR_BY_SELECTOR.get(data[:10].lower(), "unknown_revert")


def make_w3(rpc_url: str) -> Web3:
    w3 = Web3(Web3.HTTPProvider(rpc_url, request_kwargs={"timeout": 30}))
    w3.middleware_onion.inject(ExtraDataToPOAMiddleware, layer=0)
    return w3


class TxFailed(RuntimeError):
    pass


class TxSender:
    """Single relayer key, single nonce stream: every transaction goes through here."""

    def __init__(self, w3: Web3, private_key: str, min_priority_gwei: int = 30):
        self._w3 = w3
        self._account = Account.from_key(private_key)
        self._min_priority = Web3.to_wei(min_priority_gwei, "gwei")
        self._lock = threading.Lock()

    @property
    def address(self) -> str:
        return self._account.address

    def send(self, fn):
        with self._lock:
            tx = fn.build_transaction({
                "from": self.address,
                "nonce": self._w3.eth.get_transaction_count(self.address, "pending"),
            })
            priority = max(tx.get("maxPriorityFeePerGas", 0), self._min_priority)
            base_fee = self._w3.eth.get_block("latest")["baseFeePerGas"]
            tx["maxPriorityFeePerGas"] = priority
            tx["maxFeePerGas"] = max(tx.get("maxFeePerGas", 0), priority + 2 * base_fee)
            signed = self._account.sign_transaction(tx)
            tx_hash = self._w3.eth.send_raw_transaction(signed.raw_transaction)
            receipt = self._w3.eth.wait_for_transaction_receipt(tx_hash, timeout=180)
        if receipt["status"] != 1:
            raise TxFailed(Web3.to_hex(tx_hash))
        return receipt
