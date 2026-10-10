"""Check a proof JSON from the phone against the chain.

Accepts the wire format ({merkle_tree_depth, merkle_tree_root, nullifier, message, scope, points[8]})
or a raw Groth16 form ({..., "a": [..], "b": [[..],[..]], "c": [..]}) which gets packed.

    set -a; source .env; set +a
    PYTHONPATH=backend .venv/bin/python scripts/check_proof.py proof.json '{"t":"spike"}' 'cmp:2026-10-10'
"""
import json
import sys

from app.chain.config import ChainSettings
from app.chain.semaphore import ProofIn, SemaphoreClient, pack_groth16
from app.chain.signals import bytes32_text, message_text
from app.chain.web3_client import TxSender, make_w3, revert_reason

raw = json.load(open(sys.argv[1]))
payload_text, scope_text = sys.argv[2], sys.argv[3]
if "points" not in raw:
    raw["points"] = pack_groth16([int(x) for x in raw["a"]], [[int(x) for x in r] for r in raw["b"]],
                                 [int(x) for x in raw["c"]])
proof = ProofIn(**{k: raw[k] for k in ("merkle_tree_depth", "merkle_tree_root", "nullifier", "message", "scope", "points")})

print("message matches:", proof.message == bytes32_text(message_text(payload_text)), proof.message)
print("scope matches:  ", proof.scope == bytes32_text(scope_text), proof.scope)
s = ChainSettings.from_env()
w3 = make_w3(s.rpc_url)
sem = SemaphoreClient(w3, TxSender(w3, s.relayer_private_key), s.semaphore_address)
print("on-chain root:  ", sem.root(s.group_id), "proof root:", proof.merkle_tree_root)
try:
    print("verifyProof:    ", sem.verify(s.group_id, proof))
except Exception as exc:
    print("verifyProof reverted:", revert_reason(exc), getattr(exc, "data", exc))
