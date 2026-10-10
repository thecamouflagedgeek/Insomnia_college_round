# ZK interop: Flutter ↔ backend ↔ Semaphore on Amoy

## Verified so far (on an Anvil fork of Amoy, against the real Semaphore V4 deployment)

- `@semaphore-protocol/core` 4.14.3 encodes text messages/scopes exactly like `backend/app/chain/signals.py::bytes32_text`
  (UTF-8 bytes right-padded to 32 bytes). So `ZK_SIGNAL_MODE=text` is the reference behaviour.
- JS proofs (depth 16) pass `verifyProof`/`validateProof`; replays revert on-chain (`replay`); proofs from an
  identity outside the group revert with `unknown_root`; duplicate enrolment reverts with `already_enrolled`.

## Rules for the Flutter app (M1)

1. Identity secret stays in `flutter_secure_storage`. Only `identity.commitment()` (decimal string) is sent to
   `POST /zk/enroll` (HR-authorised).
2. Build the group from `GET /zk/group` → `members` **in the order given** (on-chain index order). Compare your
   `group.root()` with `onchain_root` from the same response before proving. If they differ, stop: the proof will fail.
3. `message` = `"m:" + sha256hex(payloadText).substring(0, 28)` where `payloadText` is the exact JSON string you send
   as `payload` in the request body. Hash the UTF-8 bytes. Don't re-serialize after hashing.
4. `scope` = `sdk_argument` from `GET /zk/scopes/complaint` or `GET /zk/scopes/challenge?case_id=&member_id=`.
5. `merkleTreeDepth` = 16.
6. Send `{"payload": payloadText, "proof": {merkle_tree_depth, merkle_tree_root, nullifier, message, scope, points}}`,
   with all big numbers as decimal strings and `points` the 8 Solidity-ordered values.

## Spike (to do with M1 on a real phone)

Pinned SDK: `zkmopro/semaphore_flutter` @ `<commit sha>`

1. Flutter: `Identity` from private key `utf8.encode("incognito-spike-1")`, print `commitment()`.
2. Backend: enrol it (`POST /zk/enroll`, or `ZkService.enroll` in a shell).
3. Flutter: build the group from `/zk/group` and compare roots.
4. `PYTHONPATH=backend .venv/bin/python scripts/spike_params.py '{"t":"spike"}' 'cmp:2026-10-10'` and generate
   a proof with the **text-mode** args. Dump every proof field to `proof.json`.
5. `PYTHONPATH=backend .venv/bin/python scripts/check_proof.py proof.json '{"t":"spike"}' 'cmp:2026-10-10'`

| Observation | Action |
|---|---|
| message/scope match, `verifyProof: True` | `ZK_SIGNAL_MODE=text`. Done. |
| message/scope differ in text mode | Retry with numeric-mode args; if they match → `ZK_SIGNAL_MODE=numeric` |
| neither mode matches | Print the SDK's message/scope, derive its encoding, adjust `sdk_argument` (the JS behaviour is the reference) |
| roots differ | Member order or element format wrong in the Flutter group build; compare with `node tools/proofgen/gen.mjs` |
| `verifyProof: False` with matching root/signals | Points order: give the checker raw `a,b,c` (it packs) vs already-packed `points` |
| `bad_depth` | SDK depth isn't 16; set it explicitly |
| SDK won't build after ~2h | Fallback: bundle `@semaphore-protocol/core` into a hidden WebView (`flutter_inappwebview`) |

## Findings

| Item | Value |
|---|---|
| SDK commit | _record here_ |
| `ZK_SIGNAL_MODE` | _record here_ |
| Points packing needed? | _record here_ |
| Proof time on phone | _record here_ |
| Spike tx hashes | _record here_ |

## Backend integration (M3)

```python
# app/main.py
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from fastapi import FastAPI
from app.chain.config import ChainSettings
from app.chain.hashing import content_sha256
from app.chain.routes import build_router, complaint_scope_texts
from app.chain.services import build_services, start_anchorer
from app.chain.semaphore import ProofIn
from app.chain.zk_service import ProofRejected

@asynccontextmanager
async def lifespan(app):
    app.state.chain = build_services(ChainSettings.from_env())
    stop = start_anchorer(app.state.chain)
    yield
    stop()

app = FastAPI(lifespan=lifespan)
app.include_router(build_router(enroll_guard=require_role("hr"), case_guard=require_case_access))  # M2's guards

# Complaint submission. Body: {"payload": "<json string>", "proof": ProofIn}
try:
    ok = app.state.chain.zk.verify_submission(
        body.proof, body.payload, complaint_scope_texts(datetime.now(timezone.utc).date()), "complaint")
except ProofRejected as exc:
    raise HTTPException(400, {"reason": exc.reason})   # replay / invalid_proof / unknown_root → Claim Integrity
# store body.payload verbatim in complaints.raw_payload (+ complaints.case_id), then:
app.state.chain.audit.record(case_id, "complaint_submitted", {
    "content_sha256": content_sha256(body.payload.encode()), "nullifier": str(ok.nullifier), "proof_tx": ok.tx_hash})
```

- `verify_submission` waits for an Amoy tx (~2–6 s). The phone shows "Verifying on-chain…".
- Committee challenge: same pattern with `[challenge_scope_text(case_id, member_id)]` and kind `"challenge"`.
- Call `app.state.chain.audit.record(case_id, <event_type>, {...})` at every workflow step. Allowed types and their
  data fields are in `backend/app/chain/audit_log.py::EVENT_TYPES`. Data is IDs, enums and hashes only. No names,
  no free text, no floats.
- Required table on M3's side: `complaints(case_id text, raw_payload text, ...)`.
