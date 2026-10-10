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
