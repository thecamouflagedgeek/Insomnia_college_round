# INCOGNITO — ZK Membership, Evidence Sealing & Silent Audit (Member 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the INCOGNITO backend anonymous-but-verified complaint submission (Semaphore V4 on Polygon Amoy, nullifiers enforced on-chain) and a tamper-evident Silent Audit (salted commitments, per-case hash chains, heads anchored in a `CaseAuditRegistry` contract on Amoy), with a verification endpoint, reporter receipts and a scripted tamper demo.

**Architecture:** The backend wallet ("relayer") is both the Semaphore group admin and the only address allowed to anchor audit heads, so employees never need a wallet. Flutter generates proofs on-device; the backend checks message/scope binding, then calls `verifyProof` (free view) and `validateProof` (tx, consumes nullifier on-chain). Every workflow step is recorded as an audit event `keccak(salt ‖ canonicalJSON(envelope))` chained per case; a background worker anchors the latest head of each case; the verifier recomputes everything from the DB and compares it against heads read **directly from the chain**.

**Tech Stack:** Solidity 0.8.24 + Foundry; Python 3.11+, FastAPI, web3.py 7.x, psycopg 3, pydantic 2, pytest; Node 20 + `@semaphore-protocol/core` v4 (test proof generation only); Supabase Postgres; Polygon Amoy (chainId 80002); Anvil (fork fallback).

**Spec:** Project brief pasted in chat on 2026-10-10 (no spec file). Binding decisions are copied into Global Constraints below.

## Global Constraints

- Chain: Polygon Amoy, chainId `80002`. Explorer tx URL: `https://amoy.polygonscan.com/tx/{hash}`.
- Semaphore V4 (already deployed on Amoy, do NOT redeploy): Semaphore `0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D`, SemaphoreVerifier `0x4DeC9E3784EcC1eE002001BfE91deEf4A48931f8`.
- One Semaphore group for the organisation; admin = relayer address. Default Merkle-root validity window (1 hour) is kept.
- Proof `merkleTreeDepth` is fixed at `16` everywhere (Flutter, Node tool, tests).
- Signal encoding: every message/scope is a **text of ≤ 31 UTF-8 bytes**; its field value is the bytes right-padded with zeros to 32 bytes, read big-endian (= ethers `encodeBytes32String`). Messages: `"m:" + sha256hex(payload_text)[:28]`. Complaint scope: `"cmp:YYYY-MM-DD"` (UTC). Challenge scope: `"chl:" + sha256hex(case_id + "|" + member_id)[:26]`.
- Anonymous submissions carry the payload as a **string** (`payload_text`); the backend hashes the exact received string, then parses it. No canonical-JSON parity is needed between Dart and Python.
- Audit commitments: `keccak256(salt32 ‖ canonical_json(envelope))`, canonical JSON = sorted keys, `(",", ":")` separators, UTF-8, `ensure_ascii=False`; floats forbidden in payloads.
- Never put plaintext, names, employee IDs or unsalted hashes on-chain. Audit event data holds IDs/hashes only, never reporter identity.
- Relayer private key lives only in `.env` (gitignored). One relayer key = one nonce stream; all txs go through `TxSender`.
- Python package root for this work: `backend/app/chain/`. Tests: `backend/tests/chain/`. Chain-touching tests are marked `@pytest.mark.chain` and run only when `CHAIN_TEST_RPC_URL` is set.

## Interfaces with teammates (agree in hour 1)

| With | You provide | You need |
|---|---|---|
| M1 (Flutter) | `GET /zk/group`, `GET /zk/scopes/complaint`, `GET /zk/scopes/challenge`, `POST /zk/enroll`, proof wire format (Task 4), signal rules above, receipts endpoint | Flutter SDK pinned + building by hour 2; proof printed as JSON for the Task 5 spike |
| M3 (FastAPI) | `ChainServices` (`zk`, `audit`, `verifier`), `build_router(...)`, `start_anchorer(...)`, `ProofRejected.reason` codes, `EVENT_TYPES` | complaints table column `raw_payload text` + `case_id text`; calls `audit.record(...)` at each workflow step; evidence bytes at upload time |
| M2 (access control) | `build_router(enroll_guard=..., case_guard=...)` hooks | guards: HR-only for enrol, case-participant for receipts/verify |

## Schedule (24h)

| Hours | Task |
|---|---|
| 0–1.5 | Task 1 — contract, tests, Amoy deploy (M1 starts installing the Flutter SDK in parallel) |
| 1.5–2.5 | Task 2 — hashing + signal encoding |
| 2.5–4 | Task 3 — chain clients, group creation |
| 4–5.5 | Task 4 — ZkService + JS proof generator + integration tests |
| 5.5–7.5 | Task 5 — **Flutter ↔ chain interop spike with M1** (highest risk) |
| 7.5–9.5 | Task 6 — audit log + migration |
| 9.5–10.5 | Task 7 — anchoring worker |
| 10.5–12.5 | Task 8 — verifier + receipts |
| 12.5–14 | Task 9 — API routes + wiring handoff |
| 14–16 | Task 10 — tamper demo, Anvil fallback, runbook |
| 16–24 | Integration with team, bug fixing, rehearsal |

## File Structure

```
blockchain/                                Foundry project
  foundry.toml
  src/CaseAuditRegistry.sol               append-only per-case head registry
  test/CaseAuditRegistry.t.sol
  script/Deploy.s.sol
backend/
  migrations/0040_chain.sql               zk_members, zk_nullifiers, audit_events, audit_anchors
  app/chain/
    __init__.py
    config.py        ChainSettings.from_env
    hashing.py       canonical JSON, salts, case_key, commitment, entry_hash, content_sha256
    signals.py       ≤31-byte signal texts → field values; message/scope builders
    web3_client.py   make_w3, TxSender, revert_reason
    semaphore.py     ABI, ProofIn, pack_groth16, SemaphoreClient
    registry.py      RegistryClient, OnchainAnchor, AnchorTx
    abi/CaseAuditRegistry.json            copied from Foundry artifact
    zk_repo.py       Member, ZkRepository (in-memory + Postgres)
    zk_service.py    ZkService, ProofRejected, EnrollmentRejected, ValidatedProof
    audit_repo.py    AuditEvent, AnchorRecord, AuditRepository (in-memory + Postgres)
    audit_log.py     EVENT_TYPES, AuditLog.record
    anchorer.py      Anchorer.run_once / run_forever
    verifier.py      CaseVerifier.verify / receipts
    services.py      ChainServices, build_services, start_anchorer
    routes.py        build_router(enroll_guard, case_guard)
  tests/chain/
    conftest.py fakes.py
    test_hashing.py test_signals.py test_semaphore_unit.py test_zk_service.py
    test_audit_log.py test_anchorer.py test_verifier.py test_routes.py
    test_chain_integration.py
tools/proofgen/                           Node: commitments + proofs for tests and the spike
  package.json gen.mjs
scripts/
  create_group.py check_proof.py spike_params.py tamper_demo.py
docs/chain/
  zk-interop.md demo-runbook.md
.env.example
```

---

### Task 1: CaseAuditRegistry contract, tests and Amoy deployment

**Files:**
- Create: `blockchain/foundry.toml`, `blockchain/src/CaseAuditRegistry.sol`, `blockchain/test/CaseAuditRegistry.t.sol`, `blockchain/script/Deploy.s.sol`, `.env.example`
- Create: `backend/app/chain/abi/CaseAuditRegistry.json` (copied artifact)

**Interfaces:**
- Produces (Solidity): `anchor(bytes32 caseKey, uint64 seq, bytes32 head)`, `anchorCount(bytes32) returns (uint256)`, `getAnchor(bytes32, uint256) returns (Anchor{bytes32 head; uint64 seq; uint64 timestamp})`, event `Anchored(bytes32 indexed caseKey, uint64 indexed seq, bytes32 head, uint256 index)`, errors `NotAnchorer()`, `SeqNotIncreasing(uint64 last, uint64 given)`, `ZeroHead()`.

- [ ] **Step 1: Wallet, faucet, RPC (do first — faucets rate-limit)**

```bash
cast wallet new            # save address + private key in your password manager
```
Fund the address with Amoy POL from the Polygon faucet (https://faucet.polygon.technology) and create an Alchemy (or Infura) Amoy RPC URL. Write `.env` (never commit) and commit `.env.example`:

```bash
# .env.example
AMOY_RPC_URL=https://polygon-amoy.g.alchemy.com/v2/<key>
RELAYER_PRIVATE_KEY=0x<64 hex>
RELAYER_ADDRESS=0x<address>
SEMAPHORE_ADDRESS=0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D
SEMAPHORE_GROUP_ID=
REGISTRY_ADDRESS=
DATABASE_URL=postgresql://postgres:<pw>@db.<project>.supabase.co:5432/postgres
EXPLORER_TX_URL=https://amoy.polygonscan.com/tx/{hash}
MIN_PRIORITY_GWEI=30
ANCHOR_INTERVAL_S=5
ZK_SIGNAL_MODE=text
```
Add `.env` to `.gitignore`.

- [ ] **Step 2: Scaffold Foundry**

```bash
forge init contracts --no-git --no-commit
rm blockchain/src/Counter.sol blockchain/test/Counter.t.sol blockchain/script/Counter.s.sol
```
`blockchain/foundry.toml`:
```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.24"
optimizer = true
optimizer_runs = 200
```

- [ ] **Step 3: Write the failing tests** — `blockchain/test/CaseAuditRegistry.t.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {CaseAuditRegistry} from "../src/CaseAuditRegistry.sol";

contract CaseAuditRegistryTest is Test {
    CaseAuditRegistry internal reg;
    address internal anchorer = address(0xA11CE);
    bytes32 internal constant CASE = keccak256("incognito:case:test");
    bytes32 internal constant HEAD1 = bytes32(uint256(0xbeef));
    bytes32 internal constant HEAD2 = bytes32(uint256(0xcafe));

    function setUp() public {
        reg = new CaseAuditRegistry(anchorer);
    }

    function test_anchorStoresAndEmits() public {
        vm.expectEmit(true, true, false, true);
        emit CaseAuditRegistry.Anchored(CASE, 1, HEAD1, 0);
        vm.prank(anchorer);
        reg.anchor(CASE, 1, HEAD1);

        assertEq(reg.anchorCount(CASE), 1);
        CaseAuditRegistry.Anchor memory a = reg.getAnchor(CASE, 0);
        assertEq(a.head, HEAD1);
        assertEq(a.seq, 1);
        assertEq(a.timestamp, block.timestamp);
    }

    function test_appendsInOrder() public {
        vm.startPrank(anchorer);
        reg.anchor(CASE, 1, HEAD1);
        reg.anchor(CASE, 3, HEAD2);
        vm.stopPrank();
        assertEq(reg.anchorCount(CASE), 2);
        assertEq(reg.getAnchor(CASE, 1).seq, 3);
    }

    function test_rejectsNonAnchorer() public {
        vm.expectRevert(CaseAuditRegistry.NotAnchorer.selector);
        reg.anchor(CASE, 1, HEAD1);
    }

    function test_rejectsNonIncreasingSeq() public {
        vm.startPrank(anchorer);
        reg.anchor(CASE, 2, HEAD1);
        vm.expectRevert(abi.encodeWithSelector(CaseAuditRegistry.SeqNotIncreasing.selector, uint64(2), uint64(2)));
        reg.anchor(CASE, 2, HEAD2);
        vm.stopPrank();
    }

    function test_rejectsZeroSeq() public {
        vm.prank(anchorer);
        vm.expectRevert(abi.encodeWithSelector(CaseAuditRegistry.SeqNotIncreasing.selector, uint64(0), uint64(0)));
        reg.anchor(CASE, 0, HEAD1);
    }

    function test_rejectsZeroHead() public {
        vm.prank(anchorer);
        vm.expectRevert(CaseAuditRegistry.ZeroHead.selector);
        reg.anchor(CASE, 1, bytes32(0));
    }

    function test_casesAreIndependent() public {
        vm.startPrank(anchorer);
        reg.anchor(CASE, 5, HEAD1);
        reg.anchor(keccak256("other"), 1, HEAD2);
        vm.stopPrank();
        assertEq(reg.anchorCount(CASE), 1);
        assertEq(reg.anchorCount(keccak256("other")), 1);
    }
}
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd blockchain && forge test`
Expected: compilation error — `CaseAuditRegistry.sol` not found.

- [ ] **Step 5: Implement** — `blockchain/src/CaseAuditRegistry.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title CaseAuditRegistry
/// @notice Append-only registry of INCOGNITO audit-chain heads. Each case is identified by
///         caseKey = keccak256("incognito:case:" ++ caseId). A head commits to every audit
///         event of that case up to `seq`; nothing here reveals case content.
contract CaseAuditRegistry {
    struct Anchor {
        bytes32 head;
        uint64 seq;
        uint64 timestamp;
    }

    address public immutable anchorer;
    mapping(bytes32 => Anchor[]) private _anchors;

    event Anchored(bytes32 indexed caseKey, uint64 indexed seq, bytes32 head, uint256 index);

    error NotAnchorer();
    error SeqNotIncreasing(uint64 last, uint64 given);
    error ZeroHead();

    constructor(address anchorer_) {
        anchorer = anchorer_;
    }

    function anchor(bytes32 caseKey, uint64 seq, bytes32 head) external {
        if (msg.sender != anchorer) revert NotAnchorer();
        if (head == bytes32(0)) revert ZeroHead();
        Anchor[] storage list = _anchors[caseKey];
        uint64 last = list.length == 0 ? 0 : list[list.length - 1].seq;
        if (seq <= last) revert SeqNotIncreasing(last, seq);
        list.push(Anchor({head: head, seq: seq, timestamp: uint64(block.timestamp)}));
        emit Anchored(caseKey, seq, head, list.length - 1);
    }

    function anchorCount(bytes32 caseKey) external view returns (uint256) {
        return _anchors[caseKey].length;
    }

    function getAnchor(bytes32 caseKey, uint256 index) external view returns (Anchor memory) {
        return _anchors[caseKey][index];
    }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd blockchain && forge test -vv`
Expected: 7 tests PASS.

- [ ] **Step 7: Deploy script** — `blockchain/script/Deploy.s.sol`

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console} from "forge-std/Script.sol";
import {CaseAuditRegistry} from "../src/CaseAuditRegistry.sol";

contract Deploy is Script {
    function run() external returns (CaseAuditRegistry reg) {
        address anchorer = vm.envAddress("RELAYER_ADDRESS");
        vm.startBroadcast();
        reg = new CaseAuditRegistry(anchorer);
        vm.stopBroadcast();
        console.log("CaseAuditRegistry", address(reg));
    }
}
```

- [ ] **Step 8: Deploy to Amoy and record the address**

```bash
set -a; source .env; set +a
cd blockchain && forge script script/Deploy.s.sol --rpc-url "$AMOY_RPC_URL" \
  --private-key "$RELAYER_PRIVATE_KEY" --broadcast
```
Expected: `CaseAuditRegistry 0x...`. Put it in `.env` as `REGISTRY_ADDRESS`. Optional but good for judges: add `--verify --etherscan-api-key <polygonscan key>` so the source is readable on Polygonscan.

- [ ] **Step 9: Export the ABI for Python**

```bash
mkdir -p backend/app/chain/abi
jq '.abi' blockchain/out/CaseAuditRegistry.sol/CaseAuditRegistry.json > backend/app/chain/abi/CaseAuditRegistry.json
jq '{abi: .abi, bytecode: .bytecode.object}' blockchain/out/CaseAuditRegistry.sol/CaseAuditRegistry.json > backend/tests/chain/CaseAuditRegistry.artifact.json
```
(The second file lets the integration tests deploy a fresh registry on Anvil.)

- [ ] **Step 10: Commit**

```bash
git add contracts .env.example .gitignore backend/app/chain/abi backend/tests/chain/CaseAuditRegistry.artifact.json
git commit -m "feat(chain): CaseAuditRegistry contract with tests and Amoy deploy script"
```

---

### Task 2: Hashing and signal encoding (pure Python)

**Files:**
- Create: `backend/app/chain/__init__.py` (empty), `backend/app/chain/hashing.py`, `backend/app/chain/signals.py`
- Test: `backend/tests/chain/__init__.py` (empty), `backend/tests/chain/test_hashing.py`, `backend/tests/chain/test_signals.py`

**Interfaces:**
- Produces (`hashing.py`): `ZERO_HASH: str`; `NonCanonicalValue(TypeError)`; `canonical_bytes(value) -> bytes`; `to_hex(b: bytes) -> str` (0x-prefixed); `from_hex(h: str) -> bytes`; `new_salt() -> str`; `case_key(case_id: str) -> str`; `commitment(salt: str, envelope: dict) -> str`; `entry_hash(case_key_hex: str, prev_hex: str, seq: int, commitment_hex: str) -> str`; `content_sha256(data: bytes) -> str` (64 lowercase hex, no prefix).
- Produces (`signals.py`): `SNARK_SCALAR_FIELD: int`; `bytes32_text(text: str) -> int`; `message_text(payload_text: str) -> str`; `complaint_scope_text(day: date) -> str`; `challenge_scope_text(case_id: str, member_id: str) -> str`; `sdk_argument(text: str, mode: str) -> str`.

- [ ] **Step 1: Install Python deps** (coordinate with M3's `backend/requirements.txt`)

```
web3==7.*
psycopg[binary]==3.2.*
pydantic==2.*
fastapi
httpx
pytest
```
Run: `pip install -r backend/requirements.txt`

- [ ] **Step 2: Write failing tests** — `backend/tests/chain/test_hashing.py`

```python
import pytest

from app.chain.hashing import (
    ZERO_HASH, NonCanonicalValue, canonical_bytes, case_key, commitment,
    content_sha256, entry_hash, from_hex, new_salt,
)


def test_canonical_bytes_sorts_keys_and_is_compact():
    assert canonical_bytes({"b": 1, "a": [True, None, "x"]}) == b'{"a":[true,null,"x"],"b":1}'


def test_canonical_bytes_independent_of_insertion_order():
    assert canonical_bytes({"x": 1, "y": {"q": 2, "p": 3}}) == canonical_bytes({"y": {"p": 3, "q": 2}, "x": 1})


def test_canonical_bytes_keeps_unicode_as_utf8():
    assert canonical_bytes({"t": "é"}) == '{"t":"é"}'.encode("utf-8")


@pytest.mark.parametrize("bad", [{"f": 1.5}, {"s": {1, 2}}, {1: "non-str key"}, [b"bytes"]])
def test_canonical_bytes_rejects_non_canonical_values(bad):
    with pytest.raises(NonCanonicalValue):
        canonical_bytes(bad)


def test_salt_is_32_random_bytes():
    a, b = new_salt(), new_salt()
    assert len(from_hex(a)) == 32 and a != b


def test_commitment_depends_on_salt_and_content():
    env = {"type": "complaint_submitted", "data": {"k": "v"}, "at": "2026-10-10T10:00:00+00:00"}
    s = new_salt()
    assert commitment(s, env) == commitment(s, dict(env))
    assert commitment(s, env) != commitment(new_salt(), env)
    assert commitment(s, env) != commitment(s, {**env, "data": {"k": "w"}})
    assert len(from_hex(commitment(s, env))) == 32


def test_case_key_is_deterministic_and_distinct():
    assert case_key("INC-104") == case_key("INC-104")
    assert case_key("INC-104") != case_key("INC-105")


def test_entry_hash_binds_every_input():
    k, c = case_key("INC-1"), commitment(new_salt(), {"a": 1})
    base = entry_hash(k, ZERO_HASH, 1, c)
    assert base != entry_hash(case_key("INC-2"), ZERO_HASH, 1, c)
    assert base != entry_hash(k, "0x" + "11" * 32, 1, c)
    assert base != entry_hash(k, ZERO_HASH, 2, c)
    assert base != entry_hash(k, ZERO_HASH, 1, commitment(new_salt(), {"a": 1}))


def test_content_sha256_hex():
    assert content_sha256(b"abc") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
```

`backend/tests/chain/test_signals.py`

```python
from datetime import date

import pytest

from app.chain.signals import (
    SNARK_SCALAR_FIELD, bytes32_text, challenge_scope_text, complaint_scope_text,
    message_text, sdk_argument,
)


def test_bytes32_text_matches_ethers_encodeBytes32String():
    # ethers.encodeBytes32String("a") == 0x61 followed by 31 zero bytes
    assert bytes32_text("a") == 0x61 << 248


def test_bytes32_text_rejects_more_than_31_bytes():
    bytes32_text("x" * 31)
    with pytest.raises(ValueError):
        bytes32_text("x" * 32)


def test_message_text_is_short_prefixed_and_content_bound():
    m = message_text('{"description":"hello"}')
    assert m.startswith("m:") and len(m.encode()) == 30
    assert m != message_text('{"description":"hello!"}')


def test_scope_texts_fit_and_are_stable():
    assert complaint_scope_text(date(2026, 10, 10)) == "cmp:2026-10-10"
    s = challenge_scope_text("7b1c-uuid-case", "member-42")
    assert s.startswith("chl:") and len(s.encode()) == 30
    assert s == challenge_scope_text("7b1c-uuid-case", "member-42")
    assert s != challenge_scope_text("7b1c-uuid-case", "member-43")


def test_sdk_argument_modes():
    assert sdk_argument("cmp:2026-10-10", "text") == "cmp:2026-10-10"
    assert sdk_argument("cmp:2026-10-10", "numeric") == str(bytes32_text("cmp:2026-10-10"))
    with pytest.raises(ValueError):
        sdk_argument("x", "other")


def test_field_constant():
    assert SNARK_SCALAR_FIELD == 21888242871839275222246405745257275088548364400416034343698204186575808495617
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd backend && pytest tests/chain/test_hashing.py tests/chain/test_signals.py -v`
Expected: FAIL — `ModuleNotFoundError: app.chain.hashing`.

- [ ] **Step 4: Implement** — `backend/app/chain/hashing.py`

```python
"""Hashing primitives for the Silent Audit. Everything here is deterministic except new_salt."""
import hashlib
import json
import secrets
from typing import Any

from eth_utils import keccak

ZERO_HASH = "0x" + "00" * 32


class NonCanonicalValue(TypeError):
    pass


def _check(value: Any, path: str = "$") -> None:
    if value is None or isinstance(value, (str, bool, int)):
        return
    if isinstance(value, float):
        raise NonCanonicalValue(f"float at {path}; store numbers as int or str")
    if isinstance(value, list):
        for i, item in enumerate(value):
            _check(item, f"{path}[{i}]")
        return
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                raise NonCanonicalValue(f"non-string key {key!r} at {path}")
            _check(item, f"{path}.{key}")
        return
    raise NonCanonicalValue(f"unsupported {type(value).__name__} at {path}")


def canonical_bytes(value: Any) -> bytes:
    _check(value)
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def to_hex(data: bytes) -> str:
    return "0x" + data.hex()


def from_hex(value: str) -> bytes:
    return bytes.fromhex(value.removeprefix("0x"))


def new_salt() -> str:
    return to_hex(secrets.token_bytes(32))


def case_key(case_id: str) -> str:
    return to_hex(keccak(b"incognito:case:" + case_id.encode("utf-8")))


def commitment(salt: str, envelope: dict) -> str:
    return to_hex(keccak(from_hex(salt) + canonical_bytes(envelope)))


def entry_hash(case_key_hex: str, prev_hex: str, seq: int, commitment_hex: str) -> str:
    return to_hex(keccak(
        from_hex(case_key_hex) + from_hex(prev_hex) + seq.to_bytes(8, "big") + from_hex(commitment_hex)
    ))


def content_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
```

`backend/app/chain/signals.py`

```python
"""Semaphore message/scope encoding.

Every signal is a short text (<= 31 UTF-8 bytes). Its field value is the text right-padded to
32 bytes and read big-endian, which is what @semaphore-protocol/core does with non-numeric
strings (ethers encodeBytes32String). The Semaphore contract then hashes it (keccak >> 8).
"""
import hashlib
from datetime import date

SNARK_SCALAR_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617


def bytes32_text(text: str) -> int:
    raw = text.encode("utf-8")
    if len(raw) > 31:
        raise ValueError(f"signal text must be <= 31 bytes, got {len(raw)}")
    return int.from_bytes(raw.ljust(32, b"\x00"), "big")


def message_text(payload_text: str) -> str:
    return "m:" + hashlib.sha256(payload_text.encode("utf-8")).hexdigest()[:28]


def complaint_scope_text(day: date) -> str:
    return f"cmp:{day.isoformat()}"


def challenge_scope_text(case_id: str, member_id: str) -> str:
    return "chl:" + hashlib.sha256(f"{case_id}|{member_id}".encode("utf-8")).hexdigest()[:26]


def sdk_argument(text: str, mode: str) -> str:
    """The string the Flutter app passes to generateSemaphoreProof (mode fixed in Task 5)."""
    if mode == "text":
        return text
    if mode == "numeric":
        return str(bytes32_text(text))
    raise ValueError(f"unknown signal mode {mode!r}")
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd backend && pytest tests/chain/test_hashing.py tests/chain/test_signals.py -v`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/app/chain/__init__.py backend/app/chain/hashing.py backend/app/chain/signals.py backend/tests/chain
git commit -m "feat(chain): canonical hashing and Semaphore signal encoding"
```

---

### Task 3: Chain clients (TxSender, Semaphore, Registry) and group creation

**Files:**
- Create: `backend/app/chain/config.py`, `backend/app/chain/web3_client.py`, `backend/app/chain/semaphore.py`, `backend/app/chain/registry.py`, `scripts/create_group.py`
- Test: `backend/tests/chain/conftest.py`, `backend/tests/chain/test_semaphore_unit.py`, `backend/tests/chain/test_chain_integration.py`

**Interfaces:**
- Consumes: `hashing.to_hex`, `hashing.from_hex`.
- Produces:
  - `ChainSettings` (frozen dataclass) with fields `rpc_url, relayer_private_key, semaphore_address, group_id: int | None, registry_address, database_url, explorer_tx_url, min_priority_gwei: int, anchor_interval_s: float, signal_mode: str`; `ChainSettings.from_env(env=os.environ)`.
  - `make_w3(rpc_url) -> Web3`; `TxSender(w3, private_key, min_priority_gwei=30)` with `.address: str` and `.send(fn) -> TxReceipt`; `TxFailed(RuntimeError)`; `revert_reason(exc) -> str`.
  - `ProofIn` (pydantic) fields `merkle_tree_depth, merkle_tree_root, nullifier, message, scope: int; points: list[int]` + `.as_tuple()`; `pack_groth16(a, b, c) -> list[int]`; `AddedMember(index, commitment, root, tx_hash)`; `SemaphoreClient(w3, sender, address)` with `.create_group(admin) -> int`, `.add_member(group_id, commitment) -> AddedMember`, `.verify(group_id, proof) -> bool`, `.validate(group_id, proof) -> str` (tx hash), `.root(group_id) -> int`.
  - `OnchainAnchor(seq: int, head: str, timestamp: int)`, `AnchorTx(tx_hash: str, block_number: int)`, `RegistryClient(w3, sender, address)` with `.anchor(case_key_hex, seq, head_hex) -> AnchorTx`, `.anchors(case_key_hex) -> list[OnchainAnchor]`.

- [ ] **Step 1: Write failing unit tests** — `backend/tests/chain/test_semaphore_unit.py`

```python
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
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && pytest tests/chain/test_semaphore_unit.py -v`
Expected: FAIL — `ModuleNotFoundError: app.chain.semaphore`.

- [ ] **Step 3: Implement** — `backend/app/chain/config.py`

```python
import os
from dataclasses import dataclass
from typing import Mapping


@dataclass(frozen=True)
class ChainSettings:
    rpc_url: str
    relayer_private_key: str
    semaphore_address: str
    group_id: int | None
    registry_address: str
    database_url: str
    explorer_tx_url: str
    min_priority_gwei: int
    anchor_interval_s: float
    signal_mode: str

    @classmethod
    def from_env(cls, env: Mapping[str, str] = os.environ) -> "ChainSettings":
        group = env.get("SEMAPHORE_GROUP_ID", "")
        return cls(
            rpc_url=env["AMOY_RPC_URL"],
            relayer_private_key=env["RELAYER_PRIVATE_KEY"],
            semaphore_address=env.get("SEMAPHORE_ADDRESS", "0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D"),
            group_id=int(group) if group else None,
            registry_address=env.get("REGISTRY_ADDRESS", ""),
            database_url=env.get("DATABASE_URL", ""),
            explorer_tx_url=env.get("EXPLORER_TX_URL", "https://amoy.polygonscan.com/tx/{hash}"),
            min_priority_gwei=int(env.get("MIN_PRIORITY_GWEI", "30")),
            anchor_interval_s=float(env.get("ANCHOR_INTERVAL_S", "5")),
            signal_mode=env.get("ZK_SIGNAL_MODE", "text"),
        )
```

`backend/app/chain/web3_client.py`

```python
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
```

`backend/app/chain/semaphore.py`

```python
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
```

`backend/app/chain/registry.py`

```python
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
```

- [ ] **Step 4: Run unit tests**

Run: `cd backend && pytest tests/chain/test_semaphore_unit.py -v`
Expected: all PASS.

- [ ] **Step 5: Integration fixtures** — `backend/tests/chain/conftest.py`

```python
import json
import os
from pathlib import Path

import pytest

ANVIL_KEY_0 = "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"


def pytest_configure(config):
    config.addinivalue_line("markers", "chain: needs CHAIN_TEST_RPC_URL (anvil --fork-url $AMOY_RPC_URL)")


@pytest.fixture(scope="session")
def chain():
    rpc = os.environ.get("CHAIN_TEST_RPC_URL")
    if not rpc:
        pytest.skip("CHAIN_TEST_RPC_URL not set")
    from app.chain.semaphore import SemaphoreClient
    from app.chain.web3_client import TxSender, make_w3

    w3 = make_w3(rpc)
    sender = TxSender(w3, ANVIL_KEY_0, min_priority_gwei=1)
    semaphore = SemaphoreClient(w3, sender, "0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D")
    return {"w3": w3, "sender": sender, "semaphore": semaphore}


@pytest.fixture(scope="session")
def registry(chain):
    from app.chain.registry import RegistryClient

    artifact = json.loads((Path(__file__).parent / "CaseAuditRegistry.artifact.json").read_text())
    w3, sender = chain["w3"], chain["sender"]
    factory = w3.eth.contract(abi=artifact["abi"], bytecode=artifact["bytecode"])
    receipt = sender.send(factory.constructor(sender.address))
    return RegistryClient(w3, sender, receipt["contractAddress"])
```

Note: `TxSender.send` calls `fn.build_transaction`, which both contract functions and constructors support.

- [ ] **Step 6: Write integration tests** — `backend/tests/chain/test_chain_integration.py`

```python
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
```

- [ ] **Step 7: Run integration tests against an Amoy fork**

```bash
set -a; source .env; set +a
anvil --fork-url "$AMOY_RPC_URL" --chain-id 80002 --port 8545 &      # leave running
cd backend && CHAIN_TEST_RPC_URL=http://127.0.0.1:8545 pytest tests/chain/test_chain_integration.py -v -m chain
```
Expected: 4 PASS. If `already_enrolled` comes back as `unknown_revert`, print `exc.value.data` and add the real error signature to `_ERRORS` (LeanIMT error names are the least certain entries).

- [ ] **Step 8: Group creation script** — `scripts/create_group.py`

```python
"""Create the organisation's Semaphore group on Amoy (run once). Prints SEMAPHORE_GROUP_ID."""
from app.chain.config import ChainSettings
from app.chain.semaphore import SemaphoreClient
from app.chain.web3_client import TxSender, make_w3

if __name__ == "__main__":
    s = ChainSettings.from_env()
    w3 = make_w3(s.rpc_url)
    sender = TxSender(w3, s.relayer_private_key, s.min_priority_gwei)
    group_id = SemaphoreClient(w3, sender, s.semaphore_address).create_group(sender.address)
    print(f"SEMAPHORE_GROUP_ID={group_id}")
```
Run: `set -a; source .env; set +a; cd backend && PYTHONPATH=. python ../scripts/create_group.py`
Expected: `SEMAPHORE_GROUP_ID=<n>`; add it to `.env`.

- [ ] **Step 9: Commit**

```bash
git add backend/app/chain backend/tests/chain scripts/create_group.py
git commit -m "feat(chain): relayer tx sender, Semaphore and registry clients, group creation"
```

---

### Task 4: ZkService (enrol, group view, verify-and-consume) + JS proof generator

**Files:**
- Create: `backend/app/chain/zk_repo.py`, `backend/app/chain/zk_service.py`, `tools/proofgen/package.json`, `tools/proofgen/gen.mjs`
- Create: `backend/migrations/0040_chain.sql` (ZK tables only here; audit tables added in Task 6)
- Test: `backend/tests/chain/fakes.py`, `backend/tests/chain/test_zk_service.py`, append to `backend/tests/chain/test_chain_integration.py`

**Interfaces:**
- Consumes: `SemaphoreClient`, `ProofIn`, `AddedMember` (Task 3); `bytes32_text`, `message_text` (Task 2); `revert_reason`.
- Produces:
  - `Member(index: int, commitment: int, root: int, tx_hash: str)`; `InMemoryZkRepository()`, `PostgresZkRepository(dsn)` with `add_member(m)`, `members() -> list[Member]` (ordered by index), `has_commitment(c) -> bool`, `nullifier_used(n) -> bool`, `save_nullifier(nullifier, scope, message, kind, tx_hash)`.
  - `ProofRejected(Exception).reason: str`, `EnrollmentRejected(Exception).reason: str`, `ValidatedProof(nullifier: int, scope_text: str, tx_hash: str)`, `GroupView(group_id: int, members: list[int], root: int, onchain_root: int)`.
  - `ZkService(semaphore, repo, group_id)` with `.enroll(commitment: int) -> Member`, `.group() -> GroupView`, `.verify_submission(proof: ProofIn, payload_text: str, allowed_scope_texts: list[str], kind: str) -> ValidatedProof`.
  - Rejection reasons (M3's Claim Integrity Engine maps these): `message_mismatch`, `scope_mismatch`, `replay`, `invalid_proof`, `unknown_root`, `root_expired`, `bad_depth`, `empty_group`, `no_group`, `unknown_revert`.
  - `node tools/proofgen/gen.mjs commitment <secret>` → `{"commitment": "<dec>"}`; `node tools/proofgen/gen.mjs proof '<json>'` with `{secret, members, message, scope, depth}` → `{"commitment", "proof": {merkleTreeDepth, merkleTreeRoot, nullifier, message, scope, points}}`.

- [ ] **Step 1: Migration (ZK part)** — `backend/migrations/0040_chain.sql`

```sql
-- INCOGNITO chain tables (owner: Member 4). No foreign keys to employees, by design.
create table if not exists zk_members (
  member_index        integer primary key,
  identity_commitment numeric(78,0) not null unique,
  merkle_root         numeric(78,0) not null,
  tx_hash             text not null,
  created_at          timestamptz not null default now()
);

create table if not exists zk_nullifiers (
  nullifier  numeric(78,0) primary key,
  scope      numeric(78,0) not null,
  message    numeric(78,0) not null,
  kind       text not null,
  tx_hash    text not null,
  created_at timestamptz not null default now()
);
```
Run it in the Supabase SQL editor (or `psql "$DATABASE_URL" -f backend/migrations/0040_chain.sql`).

- [ ] **Step 2: Fakes for unit tests** — `backend/tests/chain/fakes.py`

```python
from app.chain.registry import AnchorTx, OnchainAnchor
from app.chain.semaphore import AddedMember


class FakeCustomError(Exception):
    def __init__(self, signature: str):
        from web3 import Web3
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
```

Because `FakeCustomError` is not a `ContractLogicError`, `ZkService` must catch the broader `Exception` for chain calls and then classify via `revert_reason` — see Step 4.

- [ ] **Step 3: Write failing tests** — `backend/tests/chain/test_zk_service.py`

```python
import pytest

from app.chain.semaphore import ProofIn
from app.chain.signals import bytes32_text, message_text
from app.chain.zk_repo import InMemoryZkRepository
from app.chain.zk_service import EnrollmentRejected, ProofRejected, ZkService
from tests.chain.fakes import FakeCustomError, FakeSemaphore

PAYLOAD = '{"category":"harassment","description":"..."}'
SCOPE = "cmp:2026-10-10"


def _svc():
    sem, repo = FakeSemaphore(), InMemoryZkRepository()
    return ZkService(sem, repo, group_id=1), sem, repo


def _proof(payload=PAYLOAD, scope=SCOPE, nullifier=9):
    return ProofIn(merkle_tree_depth=16, merkle_tree_root=1001, nullifier=nullifier,
                   message=bytes32_text(message_text(payload)), scope=bytes32_text(scope), points=[0] * 8)


def test_enroll_mirrors_member_and_group_view():
    svc, _, _ = _svc()
    m = svc.enroll(555)
    assert (m.index, m.commitment) == (0, 555)
    view = svc.group()
    assert view.members == [555] and view.root == m.root == view.onchain_root


def test_enroll_twice_rejected():
    svc, _, _ = _svc()
    svc.enroll(555)
    with pytest.raises(EnrollmentRejected) as exc:
        svc.enroll(555)
    assert exc.value.reason == "already_enrolled"


def test_valid_submission_is_consumed_once():
    svc, _, repo = _svc()
    ok = svc.verify_submission(_proof(), PAYLOAD, [SCOPE], kind="complaint")
    assert ok.nullifier == 9 and ok.scope_text == SCOPE and ok.tx_hash.startswith("0x")
    assert repo.nullifier_used(9)
    with pytest.raises(ProofRejected) as exc:
        svc.verify_submission(_proof(), PAYLOAD, [SCOPE], kind="complaint")
    assert exc.value.reason == "replay"


def test_replay_caught_on_chain_even_if_db_forgot():
    svc, sem, _ = _svc()
    svc.verify_submission(_proof(), PAYLOAD, [SCOPE], kind="complaint")
    fresh = ZkService(sem, InMemoryZkRepository(), group_id=1)
    with pytest.raises(ProofRejected) as exc:
        fresh.verify_submission(_proof(), PAYLOAD, [SCOPE], kind="complaint")
    assert exc.value.reason == "replay"


def test_payload_swap_rejected():
    svc, _, _ = _svc()
    with pytest.raises(ProofRejected) as exc:
        svc.verify_submission(_proof(), PAYLOAD + " ", [SCOPE], kind="complaint")
    assert exc.value.reason == "message_mismatch"


def test_wrong_scope_rejected():
    svc, _, _ = _svc()
    with pytest.raises(ProofRejected) as exc:
        svc.verify_submission(_proof(scope="cmp:2026-10-01"), PAYLOAD, [SCOPE], kind="complaint")
    assert exc.value.reason == "scope_mismatch"


def test_forged_proof_rejected():
    svc, sem, _ = _svc()
    sem.valid = False
    with pytest.raises(ProofRejected) as exc:
        svc.verify_submission(_proof(), PAYLOAD, [SCOPE], kind="complaint")
    assert exc.value.reason == "invalid_proof"


def test_unknown_root_reason_propagates():
    svc, sem, _ = _svc()
    sem.verify_error = FakeCustomError("Semaphore__MerkleTreeRootIsNotPartOfTheGroup()")
    with pytest.raises(ProofRejected) as exc:
        svc.verify_submission(_proof(), PAYLOAD, [SCOPE], kind="complaint")
    assert exc.value.reason == "unknown_root"
```

Make `tests` importable: ensure `backend/tests/__init__.py` exists (create empty if M3 hasn't).

- [ ] **Step 4: Run to verify failure, then implement**

Run: `cd backend && pytest tests/chain/test_zk_service.py -v` → FAIL (`ModuleNotFoundError: app.chain.zk_repo`).

`backend/app/chain/zk_repo.py`

```python
import threading
from dataclasses import dataclass
from typing import Protocol

import psycopg


@dataclass(frozen=True)
class Member:
    index: int
    commitment: int
    root: int
    tx_hash: str


class ZkRepository(Protocol):
    def add_member(self, m: Member) -> None: ...
    def members(self) -> list[Member]: ...
    def has_commitment(self, commitment: int) -> bool: ...
    def nullifier_used(self, nullifier: int) -> bool: ...
    def save_nullifier(self, nullifier: int, scope: int, message: int, kind: str, tx_hash: str) -> None: ...


class InMemoryZkRepository:
    def __init__(self):
        self._members: dict[int, Member] = {}
        self._nullifiers: dict[int, tuple] = {}
        self._lock = threading.Lock()

    def add_member(self, m: Member) -> None:
        with self._lock:
            self._members[m.index] = m

    def members(self) -> list[Member]:
        return [self._members[i] for i in sorted(self._members)]

    def has_commitment(self, commitment: int) -> bool:
        return any(m.commitment == commitment for m in self._members.values())

    def nullifier_used(self, nullifier: int) -> bool:
        return nullifier in self._nullifiers

    def save_nullifier(self, nullifier, scope, message, kind, tx_hash) -> None:
        with self._lock:
            self._nullifiers[nullifier] = (scope, message, kind, tx_hash)


class PostgresZkRepository:
    def __init__(self, dsn: str):
        self._dsn = dsn

    def add_member(self, m: Member) -> None:
        with psycopg.connect(self._dsn) as conn:
            conn.execute(
                "insert into zk_members (member_index, identity_commitment, merkle_root, tx_hash) "
                "values (%s, %s, %s, %s)", (m.index, m.commitment, m.root, m.tx_hash))

    def members(self) -> list[Member]:
        with psycopg.connect(self._dsn) as conn:
            rows = conn.execute("select member_index, identity_commitment, merkle_root, tx_hash "
                                "from zk_members order by member_index").fetchall()
        return [Member(int(r[0]), int(r[1]), int(r[2]), r[3]) for r in rows]

    def has_commitment(self, commitment: int) -> bool:
        with psycopg.connect(self._dsn) as conn:
            return conn.execute("select 1 from zk_members where identity_commitment = %s",
                                (commitment,)).fetchone() is not None

    def nullifier_used(self, nullifier: int) -> bool:
        with psycopg.connect(self._dsn) as conn:
            return conn.execute("select 1 from zk_nullifiers where nullifier = %s",
                                (nullifier,)).fetchone() is not None

    def save_nullifier(self, nullifier, scope, message, kind, tx_hash) -> None:
        with psycopg.connect(self._dsn) as conn:
            conn.execute("insert into zk_nullifiers (nullifier, scope, message, kind, tx_hash) "
                         "values (%s, %s, %s, %s, %s)", (nullifier, scope, message, kind, tx_hash))
```

`backend/app/chain/zk_service.py`

```python
from dataclasses import dataclass

from app.chain.semaphore import ProofIn
from app.chain.signals import bytes32_text, message_text
from app.chain.web3_client import revert_reason
from app.chain.zk_repo import Member, ZkRepository


class ProofRejected(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


class EnrollmentRejected(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True)
class ValidatedProof:
    nullifier: int
    scope_text: str
    tx_hash: str


@dataclass(frozen=True)
class GroupView:
    group_id: int
    members: list[int]
    root: int
    onchain_root: int


class ZkService:
    def __init__(self, semaphore, repo: ZkRepository, group_id: int):
        self._sem = semaphore
        self._repo = repo
        self._group_id = group_id

    def enroll(self, commitment: int) -> Member:
        if self._repo.has_commitment(commitment):
            raise EnrollmentRejected("already_enrolled")
        try:
            added = self._sem.add_member(self._group_id, commitment)
        except Exception as exc:
            raise EnrollmentRejected(revert_reason(exc)) from exc
        member = Member(index=added.index, commitment=added.commitment, root=added.root, tx_hash=added.tx_hash)
        self._repo.add_member(member)
        return member

    def group(self) -> GroupView:
        members = self._repo.members()
        return GroupView(
            group_id=self._group_id,
            members=[m.commitment for m in members],
            root=members[-1].root if members else 0,
            onchain_root=self._sem.root(self._group_id),
        )

    def verify_submission(self, proof: ProofIn, payload_text: str,
                          allowed_scope_texts: list[str], kind: str) -> ValidatedProof:
        if proof.message != bytes32_text(message_text(payload_text)):
            raise ProofRejected("message_mismatch")
        scope_text = next((s for s in allowed_scope_texts if bytes32_text(s) == proof.scope), None)
        if scope_text is None:
            raise ProofRejected("scope_mismatch")
        if self._repo.nullifier_used(proof.nullifier):
            raise ProofRejected("replay")
        try:
            if not self._sem.verify(self._group_id, proof):
                raise ProofRejected("invalid_proof")
            tx_hash = self._sem.validate(self._group_id, proof)
        except ProofRejected:
            raise
        except Exception as exc:
            raise ProofRejected(revert_reason(exc)) from exc
        self._repo.save_nullifier(proof.nullifier, proof.scope, proof.message, kind, tx_hash)
        return ValidatedProof(nullifier=proof.nullifier, scope_text=scope_text, tx_hash=tx_hash)
```

Note: catching `Exception` around chain calls also turns RPC outages into `unknown_revert`. That is acceptable for the demo; log `exc` in M3's handler so outages are visible.

- [ ] **Step 5: Run unit tests**

Run: `cd backend && pytest tests/chain/test_zk_service.py -v`
Expected: 8 PASS.

- [ ] **Step 6: JS proof generator** — `tools/proofgen/package.json`

```json
{
  "name": "incognito-proofgen",
  "private": true,
  "type": "module",
  "dependencies": {
    "@semaphore-protocol/core": "^4.0.0"
  }
}
```
Run `cd tools/proofgen && npm install` and commit `package-lock.json` (this pins the exact version).

`tools/proofgen/gen.mjs`

```js
// Usage:
//   node gen.mjs commitment <secret>
//   node gen.mjs proof '{"secret":"s","members":["1","2"],"message":"m:...","scope":"cmp:...","depth":16}'
import { Group, Identity, generateProof } from "@semaphore-protocol/core"

const replacer = (_k, v) => (typeof v === "bigint" ? v.toString() : v)
const [mode, arg] = process.argv.slice(2)

if (mode === "commitment") {
  const identity = new Identity(arg)
  console.log(JSON.stringify({ commitment: identity.commitment }, replacer))
} else if (mode === "proof") {
  const input = JSON.parse(arg)
  const identity = new Identity(input.secret)
  const group = new Group(input.members.map((m) => BigInt(m)))
  const proof = await generateProof(identity, group, input.message, input.scope, input.depth ?? 16)
  console.log(JSON.stringify({ commitment: identity.commitment, proof }, replacer))
  process.exit(0)
} else {
  console.error("usage: gen.mjs commitment <secret> | proof <json>")
  process.exit(1)
}
```
The first `proof` run downloads the depth-16 snark artifacts (needs internet; cached afterwards).

- [ ] **Step 7: End-to-end ZK integration test** — append to `backend/tests/chain/test_chain_integration.py`

```python
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
    commitment = int(_node("commitment", "alice-secret")["commitment"])
    svc.enroll(commitment)
    svc.enroll(int(_node("commitment", "bob-secret")["commitment"]))

    payload = '{"category":"harassment","description":"test"}'
    scope = "cmp:2026-10-10"
    members = [str(m) for m in svc.group().members]
    proof = _wire(_node("proof", json.dumps({"secret": "alice-secret", "members": members,
                                             "message": message_text(payload), "scope": scope, "depth": 16}))["proof"])

    # JS encodes text signals exactly like signals.bytes32_text, otherwise this raises message/scope mismatch
    ok = svc.verify_submission(proof, payload, [scope], kind="complaint")
    assert ok.tx_hash.startswith("0x")

    with pytest.raises(ProofRejected) as exc:
        svc.verify_submission(proof, payload, [scope], kind="complaint")
    assert exc.value.reason == "replay"

    forged = proof.model_copy(update={"points": [proof.points[0] ^ 1] + proof.points[1:]})
    fresh = ZkService(sem, InMemoryZkRepository(), svc.group().group_id)
    with pytest.raises(ProofRejected) as exc:
        fresh.verify_submission(forged.model_copy(update={"nullifier": proof.nullifier + 1}), payload, [scope], kind="complaint")
    assert exc.value.reason in {"invalid_proof", "unknown_revert"}


def test_outsider_identity_rejected(chain):
    sem, sender = chain["semaphore"], chain["sender"]
    svc = ZkService(sem, InMemoryZkRepository(), sem.create_group(sender.address))
    svc.enroll(int(_node("commitment", "alice-secret")["commitment"]))
    payload, scope = '{"x":"y"}', "cmp:2026-10-10"
    eve = int(_node("commitment", "eve-secret")["commitment"])
    fake_members = [str(m) for m in svc.group().members] + [str(eve)]   # Eve builds a group she is in
    proof = _wire(_node("proof", json.dumps({"secret": "eve-secret", "members": fake_members,
                                             "message": message_text(payload), "scope": scope, "depth": 16}))["proof"])
    with pytest.raises(ProofRejected) as exc:
        svc.verify_submission(proof, payload, [scope], kind="complaint")
    assert exc.value.reason == "unknown_root"
```

- [ ] **Step 8: Run**

Run: `cd backend && CHAIN_TEST_RPC_URL=http://127.0.0.1:8545 pytest tests/chain/test_chain_integration.py -v -m chain`
Expected: 6 PASS. If the first test fails with `message_mismatch`/`scope_mismatch`, print `proof.message` vs `bytes32_text(...)`: it means JS does not encode text as assumed — fix `bytes32_text` to match JS before Task 5.

- [ ] **Step 9: Commit**

```bash
git add backend/app/chain/zk_repo.py backend/app/chain/zk_service.py backend/migrations/0040_chain.sql \
        backend/tests tools/proofgen/package.json tools/proofgen/package-lock.json tools/proofgen/gen.mjs
git commit -m "feat(zk): enrolment, group view and on-chain nullifier-consuming proof verification"
```

---

### Task 5: Flutter ↔ chain interop spike (pair with M1)

The single biggest team risk. Goal: a proof generated by `semaphore_flutter` on a real phone passes `verifyProof` on Amoy, and we know exactly how to convert the SDK's output into `ProofIn`.

**Files:**
- Create: `scripts/spike_params.py`, `scripts/check_proof.py`, `docs/chain/zk-interop.md`

**Interfaces:**
- Consumes: `signals.*`, `ProofIn`, `pack_groth16`, `SemaphoreClient.verify`, `revert_reason`, `ChainSettings`.
- Produces: the decided value of `ZK_SIGNAL_MODE` (`text` or `numeric`) and the documented Dart → wire-format conversion, recorded in `docs/chain/zk-interop.md` for M1.

- [ ] **Step 1: Spike parameter printer** — `scripts/spike_params.py`

```python
"""Print exactly what the phone must pass to generateSemaphoreProof, for both signal modes."""
import json
import sys

from app.chain.signals import bytes32_text, message_text, sdk_argument

payload_text, scope_text = sys.argv[1], sys.argv[2]
msg = message_text(payload_text)
print(json.dumps({
    "message_text": msg, "scope_text": scope_text,
    "expected_message_value": str(bytes32_text(msg)), "expected_scope_value": str(bytes32_text(scope_text)),
    "sdk_args_text_mode": {"message": sdk_argument(msg, "text"), "scope": sdk_argument(scope_text, "text")},
    "sdk_args_numeric_mode": {"message": sdk_argument(msg, "numeric"), "scope": sdk_argument(scope_text, "numeric")},
}, indent=2))
```

- [ ] **Step 2: Proof checker** — `scripts/check_proof.py`

```python
"""Check a proof JSON from the phone against Amoy. Accepts either the wire format
({merkle_tree_depth, merkle_tree_root, nullifier, message, scope, points[8]}) or a raw
Groth16 form ({..., "a": [..], "b": [[..],[..]], "c": [..]}) which gets packed."""
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
```

- [ ] **Step 3: Run the spike with M1**

1. M1 pins `semaphore_flutter` to a commit SHA in `pubspec.yaml` (`git: {url: https://github.com/zkmopro/semaphore_flutter, ref: <sha>}`) and builds on a physical Android phone.
2. M1 creates `Identity` from private key `utf8.encode("incognito-spike-1")`, prints `commitment()`.
3. You enrol it: `PYTHONPATH=backend python -c "from app.chain...` — or simply call `ZkService.enroll` from a Python shell with Amoy settings; note the tx on Polygonscan.
4. M1 builds the `Group` from the member list in on-chain index order (from `GET /zk/group` once Task 9 lands; for now paste the list) and compares `group.root()` with the on-chain root from `check_proof.py`. **Roots must match before anything else.**
5. Run `PYTHONPATH=backend python scripts/spike_params.py '{"t":"spike"}' 'cmp:2026-10-10'`. M1 generates a proof with depth 16 using the **text-mode** args, dumps every field of the proof object to JSON, sends it to you.
6. `PYTHONPATH=backend python scripts/check_proof.py proof.json '{"t":"spike"}' 'cmp:2026-10-10'`.

Decision table:

| Observation | Action |
|---|---|
| message/scope match, `verifyProof: True` | `ZK_SIGNAL_MODE=text`. Done. |
| message/scope differ in text mode | Retry with numeric-mode args. If they match → `ZK_SIGNAL_MODE=numeric`. |
| neither mode matches | Have M1 print the SDK's message/scope; derive its encoding; adjust `sdk_argument` (not `bytes32_text` — the JS path is the reference) |
| roots differ | Member order or element format wrong in Flutter group build; compare with `node tools/proofgen/gen.mjs` using the same members |
| `verifyProof: False` with matching root/signals | Points order: try packed vs raw `a,b,c` (checker packs raw); if the SDK already packs, do not pack again |
| `bad_depth` | SDK depth differs from 16; set it explicitly |
| SDK won't build / crashes after 2h | Fallback: run `@semaphore-protocol/core` inside a hidden WebView (`flutter_inappwebview`) with the same `gen.mjs` logic bundled via esbuild |

- [ ] **Step 4: Record results** — `docs/chain/zk-interop.md`

Write down: pinned SDK commit, chosen `ZK_SIGNAL_MODE`, the exact Dart code M1 uses to turn the SDK proof into the wire JSON (`merkle_tree_depth`, `merkle_tree_root`, `nullifier`, `message`, `scope`, `points` as decimal strings), whether points needed packing, the spike tx hashes, and the measured proof-generation time on the phone.

- [ ] **Step 5: Commit**

```bash
git add scripts/spike_params.py scripts/check_proof.py docs/chain/zk-interop.md .env.example
git commit -m "chore(zk): Flutter interop spike tooling and findings"
```

---

### Task 6: Audit log (salted commitments + per-case hash chain)

**Files:**
- Modify: `backend/migrations/0040_chain.sql` (append audit tables)
- Create: `backend/app/chain/audit_repo.py`, `backend/app/chain/audit_log.py`
- Test: `backend/tests/chain/test_audit_log.py`

**Interfaces:**
- Consumes: `hashing.*` (Task 2).
- Produces:
  - `AuditEvent(case_id, seq, event_type, payload: dict, salt, commitment, prev_hash, entry_hash)` (frozen dataclass; `payload` is the envelope `{"type","data","at"}`).
  - `AnchorRecord(case_id, seq, head, tx_hash, block_number)`.
  - `AuditRepository` protocol + `InMemoryAuditRepository()` + `PostgresAuditRepository(dsn)`: `append(case_id, build: Callable[[int, str], AuditEvent]) -> AuditEvent`, `events(case_id) -> list[AuditEvent]`, `unanchored_heads() -> list[tuple[str, int, str]]`, `save_anchor(rec)`, `anchors(case_id) -> list[AnchorRecord]`.
  - `EVENT_TYPES: frozenset[str]`; `AuditLog(repo, clock=...)` with `.record(case_id, event_type, data) -> AuditEvent`.

- [ ] **Step 1: Migration (append)** — `backend/migrations/0040_chain.sql`

```sql
create table if not exists audit_events (
  id          bigserial primary key,
  case_id     text not null,
  seq         integer not null,
  event_type  text not null,
  payload     jsonb not null,
  salt        text not null,
  commitment  text not null,
  prev_hash   text not null,
  entry_hash  text not null,
  created_at  timestamptz not null default now(),
  unique (case_id, seq)
);

create table if not exists audit_anchors (
  case_id      text not null,
  seq          integer not null,
  head         text not null,
  tx_hash      text not null,
  block_number bigint not null,
  anchored_at  timestamptz not null default now(),
  primary key (case_id, seq)
);

create or replace function audit_append_only() returns trigger language plpgsql as $$
begin
  raise exception '% is append-only', tg_table_name;
end $$;

drop trigger if exists audit_events_append_only on audit_events;
create trigger audit_events_append_only before update or delete on audit_events
  for each row execute function audit_append_only();

drop trigger if exists audit_anchors_append_only on audit_anchors;
create trigger audit_anchors_append_only before update or delete on audit_anchors
  for each row execute function audit_append_only();
```
(The tamper demo deliberately disables the trigger to play a rogue DB admin — detection must not rely on the trigger.)

- [ ] **Step 2: Write failing tests** — `backend/tests/chain/test_audit_log.py`

```python
from datetime import datetime, timezone

import pytest

from app.chain.audit_log import AuditLog
from app.chain.audit_repo import InMemoryAuditRepository
from app.chain.hashing import ZERO_HASH, NonCanonicalValue, case_key, commitment, entry_hash

FIXED = datetime(2026, 10, 10, 12, 0, 0, tzinfo=timezone.utc)


def _log():
    repo = InMemoryAuditRepository()
    return AuditLog(repo, clock=lambda: FIXED), repo


def test_first_event_chains_from_zero_hash():
    log, _ = _log()
    ev = log.record("INC-1", "complaint_submitted", {"content_sha256": "ab" * 32})
    assert ev.seq == 1 and ev.prev_hash == ZERO_HASH
    assert ev.payload == {"type": "complaint_submitted", "data": {"content_sha256": "ab" * 32},
                          "at": "2026-10-10T12:00:00+00:00"}
    assert ev.commitment == commitment(ev.salt, ev.payload)
    assert ev.entry_hash == entry_hash(case_key("INC-1"), ZERO_HASH, 1, ev.commitment)


def test_events_chain_per_case():
    log, repo = _log()
    a1 = log.record("INC-1", "complaint_submitted", {})
    b1 = log.record("INC-2", "complaint_submitted", {})
    a2 = log.record("INC-1", "committee_assigned", {"committee_id": "c1"})
    assert (a2.seq, a2.prev_hash) == (2, a1.entry_hash)
    assert b1.seq == 1
    assert [e.seq for e in repo.events("INC-1")] == [1, 2]


def test_unknown_event_type_rejected():
    log, _ = _log()
    with pytest.raises(ValueError):
        log.record("INC-1", "made_up", {})


def test_float_data_rejected_before_writing():
    log, repo = _log()
    with pytest.raises(NonCanonicalValue):
        log.record("INC-1", "severity_assessed", {"score": 0.7})
    assert repo.events("INC-1") == []


def test_unanchored_heads_and_anchors():
    from app.chain.audit_repo import AnchorRecord
    log, repo = _log()
    log.record("INC-1", "complaint_submitted", {})
    e2 = log.record("INC-1", "committee_assigned", {})
    assert repo.unanchored_heads() == [("INC-1", 2, e2.entry_hash)]
    repo.save_anchor(AnchorRecord("INC-1", 2, e2.entry_hash, "0xabc", 7))
    assert repo.unanchored_heads() == []
    e3 = log.record("INC-1", "status_changed", {"to": "investigating"})
    assert repo.unanchored_heads() == [("INC-1", 3, e3.entry_hash)]
```

- [ ] **Step 3: Run to verify failure**

Run: `cd backend && pytest tests/chain/test_audit_log.py -v`
Expected: FAIL — `ModuleNotFoundError: app.chain.audit_log`.

- [ ] **Step 4: Implement** — `backend/app/chain/audit_repo.py`

```python
import threading
from dataclasses import dataclass
from typing import Callable, Protocol

import psycopg
from psycopg.types.json import Jsonb

from app.chain.hashing import ZERO_HASH


@dataclass(frozen=True)
class AuditEvent:
    case_id: str
    seq: int
    event_type: str
    payload: dict
    salt: str
    commitment: str
    prev_hash: str
    entry_hash: str


@dataclass(frozen=True)
class AnchorRecord:
    case_id: str
    seq: int
    head: str
    tx_hash: str
    block_number: int


Builder = Callable[[int, str], AuditEvent]


class AuditRepository(Protocol):
    def append(self, case_id: str, build: Builder) -> AuditEvent: ...
    def events(self, case_id: str) -> list[AuditEvent]: ...
    def unanchored_heads(self) -> list[tuple[str, int, str]]: ...
    def save_anchor(self, rec: AnchorRecord) -> None: ...
    def anchors(self, case_id: str) -> list[AnchorRecord]: ...


class InMemoryAuditRepository:
    def __init__(self):
        self._events: dict[str, list[AuditEvent]] = {}
        self._anchors: dict[str, list[AnchorRecord]] = {}
        self._lock = threading.Lock()

    def append(self, case_id: str, build: Builder) -> AuditEvent:
        with self._lock:
            chain = self._events.setdefault(case_id, [])
            seq, prev = (chain[-1].seq + 1, chain[-1].entry_hash) if chain else (1, ZERO_HASH)
            event = build(seq, prev)
            chain.append(event)
            return event

    def events(self, case_id: str) -> list[AuditEvent]:
        return list(self._events.get(case_id, []))

    def unanchored_heads(self) -> list[tuple[str, int, str]]:
        out = []
        for case_id, chain in self._events.items():
            anchored = max((a.seq for a in self._anchors.get(case_id, [])), default=0)
            if chain and chain[-1].seq > anchored:
                out.append((case_id, chain[-1].seq, chain[-1].entry_hash))
        return out

    def save_anchor(self, rec: AnchorRecord) -> None:
        with self._lock:
            self._anchors.setdefault(rec.case_id, []).append(rec)

    def anchors(self, case_id: str) -> list[AnchorRecord]:
        return list(self._anchors.get(case_id, []))


_EVENT_COLS = "case_id, seq, event_type, payload, salt, commitment, prev_hash, entry_hash"


class PostgresAuditRepository:
    def __init__(self, dsn: str):
        self._dsn = dsn

    def append(self, case_id: str, build: Builder) -> AuditEvent:
        with psycopg.connect(self._dsn) as conn, conn.transaction():
            conn.execute("select pg_advisory_xact_lock(hashtext(%s))", (case_id,))
            row = conn.execute("select seq, entry_hash from audit_events where case_id = %s "
                               "order by seq desc limit 1", (case_id,)).fetchone()
            seq, prev = (row[0] + 1, row[1]) if row else (1, ZERO_HASH)
            ev = build(seq, prev)
            conn.execute(f"insert into audit_events ({_EVENT_COLS}) values (%s, %s, %s, %s, %s, %s, %s, %s)",
                         (ev.case_id, ev.seq, ev.event_type, Jsonb(ev.payload), ev.salt,
                          ev.commitment, ev.prev_hash, ev.entry_hash))
            return ev

    def events(self, case_id: str) -> list[AuditEvent]:
        with psycopg.connect(self._dsn) as conn:
            rows = conn.execute(f"select {_EVENT_COLS} from audit_events where case_id = %s order by seq",
                                (case_id,)).fetchall()
        return [AuditEvent(*r) for r in rows]

    def unanchored_heads(self) -> list[tuple[str, int, str]]:
        with psycopg.connect(self._dsn) as conn:
            return [tuple(r) for r in conn.execute("""
                select e.case_id, e.seq, e.entry_hash
                from audit_events e
                join (select case_id, max(seq) seq from audit_events group by case_id) m
                  on m.case_id = e.case_id and m.seq = e.seq
                left join (select case_id, max(seq) seq from audit_anchors group by case_id) a
                  on a.case_id = e.case_id
                where a.seq is null or a.seq < e.seq
            """).fetchall()]

    def save_anchor(self, rec: AnchorRecord) -> None:
        with psycopg.connect(self._dsn) as conn:
            conn.execute("insert into audit_anchors (case_id, seq, head, tx_hash, block_number) "
                         "values (%s, %s, %s, %s, %s)",
                         (rec.case_id, rec.seq, rec.head, rec.tx_hash, rec.block_number))

    def anchors(self, case_id: str) -> list[AnchorRecord]:
        with psycopg.connect(self._dsn) as conn:
            rows = conn.execute("select case_id, seq, head, tx_hash, block_number from audit_anchors "
                                "where case_id = %s order by seq", (case_id,)).fetchall()
        return [AnchorRecord(*r) for r in rows]
```

`backend/app/chain/audit_log.py`

```python
from datetime import datetime, timezone
from typing import Callable

from app.chain.audit_repo import AuditEvent, AuditRepository
from app.chain.hashing import canonical_bytes, case_key, commitment, entry_hash, new_salt

# Data rules: IDs, enums and hashes only. Never reporter identity, never free text
# (store content elsewhere and put its sha256 in "content_sha256").
EVENT_TYPES = frozenset({
    "complaint_submitted",      # {content_sha256, nullifier, proof_tx}
    "evidence_sealed",          # {evidence_id, content_sha256, size, mime}
    "case_classified",          # {category}
    "severity_assessed",        # {level}
    "committee_assigned",       # {committee_id, member_ids}
    "challenge_filed",          # {challenge_id, member_id, nullifier, proof_tx}
    "challenge_decided",        # {challenge_id, decision, reviewer_id}
    "member_replaced",          # {old_member_id, new_member_id}
    "access_revoked",           # {member_id}
    "witness_quorum_started",   # {quorum_id, invited_count}
    "witness_response_recorded",# {quorum_id, accepted_count, declined_count}
    "inbox_message",            # {message_id, direction, content_sha256}
    "notice_sent",              # {notice_id, template_id}
    "status_changed",           # {from, to}
    "resolution_recorded",      # {resolution_id, content_sha256}
    "export_generated",         # {export_id, content_sha256}
})


class AuditLog:
    def __init__(self, repo: AuditRepository, clock: Callable[[], datetime] = lambda: datetime.now(timezone.utc)):
        self._repo = repo
        self._clock = clock

    def record(self, case_id: str, event_type: str, data: dict) -> AuditEvent:
        if event_type not in EVENT_TYPES:
            raise ValueError(f"unknown audit event type {event_type!r}")
        envelope = {"type": event_type, "data": data, "at": self._clock().isoformat(timespec="seconds")}
        canonical_bytes(envelope)  # fail before touching storage
        key = case_key(case_id)

        def build(seq: int, prev: str) -> AuditEvent:
            salt = new_salt()
            c = commitment(salt, envelope)
            return AuditEvent(case_id, seq, event_type, envelope, salt, c, prev, entry_hash(key, prev, seq, c))

        return self._repo.append(case_id, build)
```

- [ ] **Step 5: Run tests**

Run: `cd backend && pytest tests/chain/test_audit_log.py -v`
Expected: 5 PASS.

- [ ] **Step 6: Apply migration to Supabase and smoke-test Postgres repo**

```bash
psql "$DATABASE_URL" -f backend/migrations/0040_chain.sql
cd backend && PYTHONPATH=. python -c "
import os
from app.chain.audit_log import AuditLog
from app.chain.audit_repo import PostgresAuditRepository
repo = PostgresAuditRepository(os.environ['DATABASE_URL'])
log = AuditLog(repo)
print(log.record('SMOKE-1', 'status_changed', {'from': 'new', 'to': 'review'}))
print(repo.events('SMOKE-1')[-1].payload)"
```
Expected: event printed twice with identical payload dict. (Check the jsonb round-trip keeps payload equal — if not, commitments won't verify.)

- [ ] **Step 7: Commit**

```bash
git add backend/migrations/0040_chain.sql backend/app/chain/audit_repo.py backend/app/chain/audit_log.py backend/tests/chain/test_audit_log.py
git commit -m "feat(audit): salted commitments with per-case append-only hash chain"
```

---

### Task 7: Anchoring worker

**Files:**
- Create: `backend/app/chain/anchorer.py`
- Test: `backend/tests/chain/test_anchorer.py`

**Interfaces:**
- Consumes: `AuditRepository.unanchored_heads/save_anchor`, `RegistryClient.anchor` (or `FakeRegistry`), `case_key`.
- Produces: `Anchorer(repo, registry)` with `.run_once() -> list[AnchorRecord]` and `.run_forever(stop: threading.Event, interval_s: float) -> None`.

- [ ] **Step 1: Write failing tests** — `backend/tests/chain/test_anchorer.py`

```python
import threading

from app.chain.anchorer import Anchorer
from app.chain.audit_log import AuditLog
from app.chain.audit_repo import InMemoryAuditRepository
from app.chain.hashing import case_key
from tests.chain.fakes import FakeRegistry


def test_anchors_only_latest_head_per_case_and_is_idempotent():
    repo, reg = InMemoryAuditRepository(), FakeRegistry()
    log = AuditLog(repo)
    log.record("INC-1", "complaint_submitted", {})
    last = log.record("INC-1", "severity_assessed", {"level": "high"})
    log.record("INC-2", "complaint_submitted", {})

    done = Anchorer(repo, reg).run_once()
    assert sorted((r.case_id, r.seq) for r in done) == [("INC-1", 2), ("INC-2", 1)]
    assert reg.anchors(case_key("INC-1"))[0].head == last.entry_hash
    assert Anchorer(repo, reg).run_once() == []


def test_failure_on_one_case_does_not_lose_others():
    repo, reg = InMemoryAuditRepository(), FakeRegistry()
    log = AuditLog(repo)
    log.record("BAD", "complaint_submitted", {})
    log.record("GOOD", "complaint_submitted", {})
    original = reg.anchor

    def flaky(key, seq, head):
        if key == case_key("BAD"):
            raise RuntimeError("rpc down")
        return original(key, seq, head)

    reg.anchor = flaky
    done = Anchorer(repo, reg).run_once()
    assert [r.case_id for r in done] == ["GOOD"]
    assert [c for c, _, _ in repo.unanchored_heads()] == ["BAD"]


def test_run_forever_stops():
    repo, reg = InMemoryAuditRepository(), FakeRegistry()
    AuditLog(repo).record("INC-1", "complaint_submitted", {})
    stop = threading.Event()
    t = threading.Thread(target=Anchorer(repo, reg).run_forever, args=(stop, 0.01))
    t.start()
    while not reg.anchors(case_key("INC-1")):
        pass
    stop.set()
    t.join(timeout=2)
    assert not t.is_alive()
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && pytest tests/chain/test_anchorer.py -v` → FAIL (`ModuleNotFoundError`).

- [ ] **Step 3: Implement** — `backend/app/chain/anchorer.py`

```python
import logging
import threading

from app.chain.audit_repo import AnchorRecord, AuditRepository
from app.chain.hashing import case_key

log = logging.getLogger(__name__)


class Anchorer:
    """Anchors the latest head of every case that has new events. Anchoring only the latest head
    is enough: each head commits to the whole chain before it."""

    def __init__(self, repo: AuditRepository, registry):
        self._repo = repo
        self._registry = registry

    def run_once(self) -> list[AnchorRecord]:
        done = []
        for case_id, seq, head in self._repo.unanchored_heads():
            try:
                tx = self._registry.anchor(case_key(case_id), seq, head)
            except Exception:
                log.exception("anchoring %s seq=%s failed; will retry", case_id, seq)
                continue
            rec = AnchorRecord(case_id, seq, head, tx.tx_hash, tx.block_number)
            self._repo.save_anchor(rec)
            done.append(rec)
        return done

    def run_forever(self, stop: threading.Event, interval_s: float = 5.0) -> None:
        while not stop.is_set():
            try:
                self.run_once()
            except Exception:
                log.exception("anchor sweep failed")
            stop.wait(interval_s)
```

- [ ] **Step 4: Run tests**

Run: `cd backend && pytest tests/chain/test_anchorer.py -v`
Expected: 3 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/chain/anchorer.py backend/tests/chain/test_anchorer.py
git commit -m "feat(audit): background anchoring of case heads to CaseAuditRegistry"
```

---

### Task 8: Independent verifier and receipts

**Files:**
- Create: `backend/app/chain/verifier.py`
- Test: `backend/tests/chain/test_verifier.py`

**Interfaces:**
- Consumes: `AuditRepository.events/anchors`, `RegistryClient.anchors` (reads chain, not DB), `hashing.*`.
- Produces:
  - `ContentLoader = Callable[[str, dict], bytes | None]` (args: case_id, event data).
  - `EventCheck(seq, event_type, at, commitment_ok, chain_ok, content_ok: bool | None, anchored_by: int | None, status)` where status ∈ `verified | pending_anchor | tampered`.
  - `AnchorCheck(seq, onchain_head, recomputed_head: str | None, ok, tx_hash: str | None)`.
  - `CaseVerification(case_id, ok: bool, events: list[EventCheck], anchors: list[AnchorCheck])`.
  - `Receipt(seq, event_type, at, commitment, entry_hash, anchor_seq: int | None, anchor_tx: str | None, explorer_url: str | None)`.
  - `CaseVerifier(repo, registry, content_loaders: dict[str, ContentLoader], explorer_tx_url: str)` with `.verify(case_id) -> CaseVerification`, `.receipts(case_id) -> list[Receipt]`.

- [ ] **Step 1: Write failing tests** — `backend/tests/chain/test_verifier.py`

```python
from dataclasses import replace

from app.chain.anchorer import Anchorer
from app.chain.audit_log import AuditLog
from app.chain.audit_repo import InMemoryAuditRepository
from app.chain.hashing import content_sha256
from app.chain.verifier import CaseVerifier
from tests.chain.fakes import FakeRegistry

COMPLAINT = b'{"description":"original"}'


def _setup(store=None):
    repo, reg = InMemoryAuditRepository(), FakeRegistry()
    store = store if store is not None else {"INC-1": COMPLAINT}
    log = AuditLog(repo)
    log.record("INC-1", "complaint_submitted", {"content_sha256": content_sha256(COMPLAINT)})
    log.record("INC-1", "committee_assigned", {"committee_id": "c1"})
    Anchorer(repo, reg).run_once()
    verifier = CaseVerifier(repo, reg, {"complaint_submitted": lambda case_id, data: store.get(case_id)},
                            "https://amoy.polygonscan.com/tx/{hash}")
    return repo, reg, log, verifier, store


def test_untouched_case_verifies():
    _, _, _, v, _ = _setup()
    r = v.verify("INC-1")
    assert r.ok
    assert [e.status for e in r.events] == ["verified", "verified"]
    assert r.events[0].content_ok is True and r.events[1].content_ok is None
    assert [a.ok for a in r.anchors] == [True]


def test_new_event_is_pending_until_anchored():
    repo, reg, log, v, _ = _setup()
    log.record("INC-1", "status_changed", {"from": "review", "to": "investigating"})
    r = v.verify("INC-1")
    assert r.ok and r.events[-1].status == "pending_anchor"
    Anchorer(repo, reg).run_once()
    assert v.verify("INC-1").events[-1].status == "verified"


def test_tampered_audit_payload_detected_even_if_commitment_left_alone():
    repo, _, _, v, _ = _setup()
    chain = repo._events["INC-1"]
    ev = chain[1]
    chain[1] = replace(ev, payload={**ev.payload, "data": {"committee_id": "c2"}})
    r = v.verify("INC-1")
    assert not r.ok
    assert r.events[1].commitment_ok is False and r.events[1].status == "tampered"
    assert r.anchors[0].ok is False


def test_rewritten_commitment_still_breaks_anchor():
    from app.chain.hashing import commitment
    repo, _, _, v, _ = _setup()
    chain = repo._events["INC-1"]
    ev = chain[1]
    forged = {**ev.payload, "data": {"committee_id": "c2"}}
    chain[1] = replace(ev, payload=forged, commitment=commitment(ev.salt, forged))
    r = v.verify("INC-1")
    assert not r.ok and r.events[1].chain_ok is False and r.anchors[0].ok is False


def test_edited_complaint_text_detected():
    store = {"INC-1": COMPLAINT}
    _, _, _, v, store = _setup(store)
    store["INC-1"] = b'{"description":"softened"}'
    r = v.verify("INC-1")
    assert not r.ok and r.events[0].content_ok is False and r.events[0].status == "tampered"


def test_deleted_event_detected():
    repo, _, _, v, _ = _setup()
    repo._events["INC-1"].pop()
    r = v.verify("INC-1")
    assert not r.ok and r.anchors[0].recomputed_head is None


def test_receipts_link_anchor_tx():
    _, _, _, v, _ = _setup()
    rs = v.receipts("INC-1")
    assert [r.seq for r in rs] == [1, 2]
    assert rs[0].anchor_seq == 2 and rs[0].explorer_url.startswith("https://amoy.polygonscan.com/tx/0x")
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && pytest tests/chain/test_verifier.py -v` → FAIL (`ModuleNotFoundError`).

- [ ] **Step 3: Implement** — `backend/app/chain/verifier.py`

```python
from dataclasses import dataclass
from typing import Callable

from app.chain.audit_repo import AuditRepository
from app.chain.hashing import ZERO_HASH, case_key, commitment, content_sha256, entry_hash

ContentLoader = Callable[[str, dict], "bytes | None"]


@dataclass(frozen=True)
class EventCheck:
    seq: int
    event_type: str
    at: str
    commitment_ok: bool
    chain_ok: bool
    content_ok: bool | None
    anchored_by: int | None
    status: str


@dataclass(frozen=True)
class AnchorCheck:
    seq: int
    onchain_head: str
    recomputed_head: str | None
    ok: bool
    tx_hash: str | None


@dataclass(frozen=True)
class CaseVerification:
    case_id: str
    ok: bool
    events: list[EventCheck]
    anchors: list[AnchorCheck]


@dataclass(frozen=True)
class Receipt:
    seq: int
    event_type: str
    at: str
    commitment: str
    entry_hash: str
    anchor_seq: int | None
    anchor_tx: str | None
    explorer_url: str | None


class CaseVerifier:
    """Recomputes every commitment and chain link from storage and compares the result against
    heads read from the chain itself. Nothing stored in the DB is trusted."""

    def __init__(self, repo: AuditRepository, registry, content_loaders: dict[str, ContentLoader],
                 explorer_tx_url: str):
        self._repo = repo
        self._registry = registry
        self._loaders = content_loaders
        self._explorer = explorer_tx_url

    def verify(self, case_id: str) -> CaseVerification:
        key = case_key(case_id)
        events = self._repo.events(case_id)
        onchain = self._registry.anchors(key)
        tx_by_seq = {a.seq: a.tx_hash for a in self._repo.anchors(case_id)}

        prev, heads, partial = ZERO_HASH, {}, []
        for expected_seq, ev in enumerate(events, start=1):
            recomputed = commitment(ev.salt, ev.payload)
            head = entry_hash(key, prev, ev.seq, recomputed)
            partial.append((ev, recomputed == ev.commitment,
                            ev.seq == expected_seq and ev.prev_hash == prev and head == ev.entry_hash,
                            self._content_ok(case_id, ev)))
            heads[ev.seq] = head
            prev = head

        anchor_checks = [AnchorCheck(a.seq, a.head, heads.get(a.seq), heads.get(a.seq) == a.head,
                                     tx_by_seq.get(a.seq)) for a in onchain]

        checks = []
        for ev, commitment_ok, chain_ok, content_ok in partial:
            covering = next((a for a in anchor_checks if a.seq >= ev.seq), None)
            if not (commitment_ok and chain_ok and content_ok is not False) or (covering and not covering.ok):
                status = "tampered"
            elif covering is None:
                status = "pending_anchor"
            else:
                status = "verified"
            checks.append(EventCheck(ev.seq, ev.event_type, ev.payload.get("at", ""), commitment_ok, chain_ok,
                                     content_ok, covering.seq if covering else None, status))

        ok = all(c.status != "tampered" for c in checks) and all(a.ok for a in anchor_checks)
        return CaseVerification(case_id, ok, checks, anchor_checks)

    def receipts(self, case_id: str) -> list[Receipt]:
        anchors = self._repo.anchors(case_id)
        out = []
        for ev in self._repo.events(case_id):
            a = next((x for x in anchors if x.seq >= ev.seq), None)
            out.append(Receipt(ev.seq, ev.event_type, ev.payload.get("at", ""), ev.commitment, ev.entry_hash,
                               a.seq if a else None, a.tx_hash if a else None,
                               self._explorer.format(hash=a.tx_hash) if a else None))
        return out

    def _content_ok(self, case_id: str, ev) -> bool | None:
        loader = self._loaders.get(ev.event_type)
        expected = ev.payload.get("data", {}).get("content_sha256")
        if loader is None or expected is None:
            return None
        data = loader(case_id, ev.payload["data"])
        return data is not None and content_sha256(data) == expected
```

- [ ] **Step 4: Run tests**

Run: `cd backend && pytest tests/chain/test_verifier.py -v`
Expected: 7 PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/chain/verifier.py backend/tests/chain/test_verifier.py
git commit -m "feat(audit): chain-backed case verification and reporter receipts"
```

---

### Task 9: Service wiring and API routes (handoff to M3/M2/M1)

**Files:**
- Create: `backend/app/chain/services.py`, `backend/app/chain/routes.py`
- Test: `backend/tests/chain/test_routes.py`

**Interfaces:**
- Consumes: everything above.
- Produces:
  - `ChainServices(zk: ZkService, audit: AuditLog, verifier: CaseVerifier, anchorer: Anchorer, settings: ChainSettings)`.
  - `build_services(settings) -> ChainServices` (Postgres repos; content loaders read `complaints.raw_payload` by `case_id`, evidence via `evidence_loader` argument).
  - `start_anchorer(services) -> Callable[[], None]` (returns stop function).
  - `build_router(enroll_guard, case_guard) -> APIRouter`; routes read `request.app.state.chain: ChainServices`.
  - Endpoints:
    - `GET /zk/group` → `{group_id, depth: 16, members: [dec str], root: dec str, onchain_root: dec str}`
    - `GET /zk/scopes/complaint` → `{scope_text, sdk_argument, valid_scope_texts}` (today, yesterday UTC)
    - `GET /zk/scopes/challenge?case_id=&member_id=` → `{scope_text, sdk_argument}`
    - `POST /zk/enroll` `{commitment: dec str}` → `{index, root, tx_hash}`; 409 `{reason}` on rejection
    - `GET /audit/cases/{case_id}/verify` → `CaseVerification` JSON
    - `GET /audit/cases/{case_id}/receipts` → `[Receipt]`
  - Helper for M3's complaint/challenge routes: `complaint_scope_texts(today: date) -> list[str]`.

- [ ] **Step 1: Write failing tests** — `backend/tests/chain/test_routes.py`

```python
from datetime import date

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.chain.anchorer import Anchorer
from app.chain.audit_log import AuditLog
from app.chain.audit_repo import InMemoryAuditRepository
from app.chain.config import ChainSettings
from app.chain.routes import build_router, complaint_scope_texts
from app.chain.services import ChainServices
from app.chain.verifier import CaseVerifier
from app.chain.zk_repo import InMemoryZkRepository
from app.chain.zk_service import ZkService
from tests.chain.fakes import FakeRegistry, FakeSemaphore

SETTINGS = ChainSettings.from_env({"AMOY_RPC_URL": "x", "RELAYER_PRIVATE_KEY": "0x" + "1" * 64,
                                   "SEMAPHORE_GROUP_ID": "1"})


def _client():
    repo, reg = InMemoryAuditRepository(), FakeRegistry()
    services = ChainServices(
        zk=ZkService(FakeSemaphore(), InMemoryZkRepository(), 1),
        audit=AuditLog(repo),
        verifier=CaseVerifier(repo, reg, {}, SETTINGS.explorer_tx_url),
        anchorer=Anchorer(repo, reg),
        settings=SETTINGS,
    )
    app = FastAPI()
    app.state.chain = services
    app.include_router(build_router(enroll_guard=lambda: None, case_guard=lambda: None))
    return TestClient(app), services


def test_enroll_then_group():
    client, _ = _client()
    r = client.post("/zk/enroll", json={"commitment": "12345678901234567890"})
    assert r.status_code == 200 and r.json()["index"] == 0
    g = client.get("/zk/group").json()
    assert g["members"] == ["12345678901234567890"] and g["depth"] == 16
    assert client.post("/zk/enroll", json={"commitment": "12345678901234567890"}).status_code == 409


def test_scopes():
    client, _ = _client()
    c = client.get("/zk/scopes/complaint").json()
    assert c["scope_text"].startswith("cmp:") and len(c["valid_scope_texts"]) == 2
    ch = client.get("/zk/scopes/challenge", params={"case_id": "INC-1", "member_id": "m1"}).json()
    assert ch["scope_text"].startswith("chl:")


def test_complaint_scope_texts_allow_midnight_slack():
    assert complaint_scope_texts(date(2026, 10, 10)) == ["cmp:2026-10-10", "cmp:2026-10-09"]


def test_verify_and_receipts():
    client, services = _client()
    services.audit.record("INC-9", "complaint_submitted", {})
    services.anchorer.run_once()
    v = client.get("/audit/cases/INC-9/verify").json()
    assert v["ok"] is True and v["events"][0]["status"] == "verified"
    rs = client.get("/audit/cases/INC-9/receipts").json()
    assert rs[0]["anchor_tx"].startswith("0x")
```

- [ ] **Step 2: Run to verify failure**

Run: `cd backend && pytest tests/chain/test_routes.py -v` → FAIL (`ModuleNotFoundError`).

- [ ] **Step 3: Implement** — `backend/app/chain/services.py`

```python
import threading
from dataclasses import dataclass
from typing import Callable

import psycopg

from app.chain.anchorer import Anchorer
from app.chain.audit_log import AuditLog
from app.chain.audit_repo import PostgresAuditRepository
from app.chain.config import ChainSettings
from app.chain.registry import RegistryClient
from app.chain.semaphore import SemaphoreClient
from app.chain.verifier import CaseVerifier, ContentLoader
from app.chain.web3_client import TxSender, make_w3
from app.chain.zk_repo import PostgresZkRepository
from app.chain.zk_service import ZkService


@dataclass(frozen=True)
class ChainServices:
    zk: ZkService
    audit: AuditLog
    verifier: CaseVerifier
    anchorer: Anchorer
    settings: ChainSettings


def _complaint_loader(dsn: str) -> ContentLoader:
    def load(case_id: str, data: dict) -> bytes | None:
        with psycopg.connect(dsn) as conn:
            row = conn.execute("select raw_payload from complaints where case_id = %s", (case_id,)).fetchone()
        return row[0].encode("utf-8") if row else None
    return load


def build_services(settings: ChainSettings, evidence_loader: ContentLoader | None = None) -> ChainServices:
    w3 = make_w3(settings.rpc_url)
    sender = TxSender(w3, settings.relayer_private_key, settings.min_priority_gwei)
    registry = RegistryClient(w3, sender, settings.registry_address)
    audit_repo = PostgresAuditRepository(settings.database_url)
    loaders: dict[str, ContentLoader] = {"complaint_submitted": _complaint_loader(settings.database_url)}
    if evidence_loader:
        loaders["evidence_sealed"] = evidence_loader
    return ChainServices(
        zk=ZkService(SemaphoreClient(w3, sender, settings.semaphore_address),
                     PostgresZkRepository(settings.database_url), settings.group_id),
        audit=AuditLog(audit_repo),
        verifier=CaseVerifier(audit_repo, registry, loaders, settings.explorer_tx_url),
        anchorer=Anchorer(audit_repo, registry),
        settings=settings,
    )


def start_anchorer(services: ChainServices) -> Callable[[], None]:
    stop = threading.Event()
    thread = threading.Thread(target=services.anchorer.run_forever,
                              args=(stop, services.settings.anchor_interval_s), daemon=True, name="anchorer")
    thread.start()

    def shutdown() -> None:
        stop.set()
        thread.join(timeout=10)
    return shutdown
```

`backend/app/chain/routes.py`

```python
from dataclasses import asdict
from datetime import date, datetime, timedelta, timezone
from typing import Callable

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.chain.signals import challenge_scope_text, complaint_scope_text, sdk_argument
from app.chain.zk_service import EnrollmentRejected

PROOF_DEPTH = 16


class EnrollIn(BaseModel):
    commitment: int


def complaint_scope_texts(today: date) -> list[str]:
    return [complaint_scope_text(today), complaint_scope_text(today - timedelta(days=1))]


def build_router(enroll_guard: Callable, case_guard: Callable) -> APIRouter:
    router = APIRouter()

    def svc(request: Request):
        return request.app.state.chain

    @router.get("/zk/group")
    def group(request: Request):
        g = svc(request).zk.group()
        return {"group_id": g.group_id, "depth": PROOF_DEPTH, "members": [str(m) for m in g.members],
                "root": str(g.root), "onchain_root": str(g.onchain_root)}

    @router.get("/zk/scopes/complaint")
    def complaint_scope(request: Request):
        texts = complaint_scope_texts(datetime.now(timezone.utc).date())
        return {"scope_text": texts[0], "sdk_argument": sdk_argument(texts[0], svc(request).settings.signal_mode),
                "valid_scope_texts": texts}

    @router.get("/zk/scopes/challenge")
    def challenge_scope(request: Request, case_id: str, member_id: str):
        text = challenge_scope_text(case_id, member_id)
        return {"scope_text": text, "sdk_argument": sdk_argument(text, svc(request).settings.signal_mode)}

    @router.post("/zk/enroll", dependencies=[Depends(enroll_guard)])
    def enroll(request: Request, body: EnrollIn):
        try:
            m = svc(request).zk.enroll(body.commitment)
        except EnrollmentRejected as exc:
            raise HTTPException(status_code=409, detail={"reason": exc.reason})
        return {"index": m.index, "root": str(m.root), "tx_hash": m.tx_hash}

    @router.get("/audit/cases/{case_id}/verify", dependencies=[Depends(case_guard)])
    def verify(request: Request, case_id: str):
        return asdict(svc(request).verifier.verify(case_id))

    @router.get("/audit/cases/{case_id}/receipts", dependencies=[Depends(case_guard)])
    def receipts(request: Request, case_id: str):
        return [asdict(r) for r in svc(request).verifier.receipts(case_id)]

    return router
```

- [ ] **Step 4: Run all unit tests**

Run: `cd backend && pytest tests/chain -v`
Expected: all non-`chain` tests PASS; `chain` tests SKIP (no `CHAIN_TEST_RPC_URL`).

- [ ] **Step 5: Write the integration snippet for M3** — add to `docs/chain/zk-interop.md` under "Backend integration":

```python
# app/main.py (M3)
from contextlib import asynccontextmanager
from app.chain.config import ChainSettings
from app.chain.routes import build_router, complaint_scope_texts
from app.chain.services import build_services, start_anchorer

@asynccontextmanager
async def lifespan(app):
    app.state.chain = build_services(ChainSettings.from_env())
    stop = start_anchorer(app.state.chain)
    yield
    stop()

app = FastAPI(lifespan=lifespan)
app.include_router(build_router(enroll_guard=require_role("hr"), case_guard=require_case_access))  # M2's guards

# complaint submission (M3), body = {"payload": "<json string>", "proof": ProofIn}
ok = app.state.chain.zk.verify_submission(body.proof, body.payload,
                                          complaint_scope_texts(datetime.now(timezone.utc).date()), "complaint")
# store body.payload verbatim in complaints.raw_payload, then:
app.state.chain.audit.record(case_id, "complaint_submitted",
                             {"content_sha256": content_sha256(body.payload.encode()),
                              "nullifier": str(ok.nullifier), "proof_tx": ok.tx_hash})
# on ProofRejected(reason): 400 {"reason": reason}; "replay" and "invalid_proof"/"unknown_root" feed Claim Integrity
```
Also note for M1/M3: since `verify_submission` waits for an Amoy tx (~2–6 s), the submit request is slow; M1 shows "Verifying on-chain…".

- [ ] **Step 6: Commit**

```bash
git add backend/app/chain/services.py backend/app/chain/routes.py backend/tests/chain/test_routes.py docs/chain/zk-interop.md
git commit -m "feat(chain): service wiring, anchorer lifecycle and ZK/audit API routes"
```

---

### Task 10: Tamper demo, Anvil fallback and runbook

**Files:**
- Create: `scripts/tamper_demo.py`, `docs/chain/demo-runbook.md`

**Interfaces:**
- Consumes: `build_services`, `ChainSettings`, `CaseVerifier.verify`; tables `audit_events`, `complaints(case_id, raw_payload)`.
- Produces: CLI `python scripts/tamper_demo.py {audit|complaint|restore|verify} --case <id> [--seq N]`.

- [ ] **Step 1: Write the script** — `scripts/tamper_demo.py`

```python
"""Silent Audit tamper demo. Plays a rogue DB admin who bypasses the append-only trigger.

  python scripts/tamper_demo.py verify    --case INC-104
  python scripts/tamper_demo.py audit     --case INC-104 --seq 2   # rewrite an audit event's data
  python scripts/tamper_demo.py complaint --case INC-104           # soften the complaint text
  python scripts/tamper_demo.py restore   --case INC-104
"""
import argparse
import json
from pathlib import Path

import psycopg
from psycopg.types.json import Jsonb

from app.chain.config import ChainSettings
from app.chain.services import build_services

BACKUP = Path(".tamper_backup.json")


def show(case_id: str) -> None:
    result = build_services(ChainSettings.from_env()).verifier.verify(case_id)
    print(f"\nCase {case_id}: {'VERIFIED ✅' if result.ok else 'TAMPERING DETECTED ❌'}")
    for e in result.events:
        print(f"  #{e.seq:<3} {e.event_type:<26} {e.status:<15} commitment={e.commitment_ok} "
              f"chain={e.chain_ok} content={e.content_ok}")
    for a in result.anchors:
        print(f"  anchor seq={a.seq} ok={a.ok} onchain={a.onchain_head[:18]}… tx={a.tx_hash}")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("action", choices=["verify", "audit", "complaint", "restore"])
    p.add_argument("--case", required=True)
    p.add_argument("--seq", type=int, default=2)
    args = p.parse_args()
    dsn = ChainSettings.from_env().database_url

    if args.action == "verify":
        return show(args.case)

    with psycopg.connect(dsn) as conn:
        if args.action == "audit":
            row = conn.execute("select payload from audit_events where case_id=%s and seq=%s",
                               (args.case, args.seq)).fetchone()
            BACKUP.write_text(json.dumps({"kind": "audit", "seq": args.seq, "payload": row[0]}))
            forged = {**row[0], "data": {**row[0]["data"], "tampered": "quietly changed by admin"}}
            conn.execute("alter table audit_events disable trigger audit_events_append_only")
            conn.execute("update audit_events set payload=%s where case_id=%s and seq=%s",
                         (Jsonb(forged), args.case, args.seq))
            conn.execute("alter table audit_events enable trigger audit_events_append_only")
        elif args.action == "complaint":
            row = conn.execute("select raw_payload from complaints where case_id=%s", (args.case,)).fetchone()
            BACKUP.write_text(json.dumps({"kind": "complaint", "raw_payload": row[0]}))
            conn.execute("update complaints set raw_payload=%s where case_id=%s",
                         (row[0].replace("harass", "disagree"), args.case))
        elif args.action == "restore":
            b = json.loads(BACKUP.read_text())
            if b["kind"] == "audit":
                conn.execute("alter table audit_events disable trigger audit_events_append_only")
                conn.execute("update audit_events set payload=%s where case_id=%s and seq=%s",
                             (Jsonb(b["payload"]), args.case, b["seq"]))
                conn.execute("alter table audit_events enable trigger audit_events_append_only")
            else:
                conn.execute("update complaints set raw_payload=%s where case_id=%s", (b["raw_payload"], args.case))
            BACKUP.unlink()
    show(args.case)


if __name__ == "__main__":
    main()
```
The `complaint` tamper uses a word replacement; make sure the seeded demo complaint text contains "harass" (or change the replacement to fit the demo text).

- [ ] **Step 2: Rehearse on a seeded case**

```bash
set -a; source .env; set +a; export PYTHONPATH=backend
python scripts/tamper_demo.py verify --case INC-104        # all verified ✅
python scripts/tamper_demo.py audit  --case INC-104 --seq 2 # ❌ seq 2 tampered, anchor mismatch
python scripts/tamper_demo.py restore --case INC-104        # ✅ again
python scripts/tamper_demo.py complaint --case INC-104      # ❌ seq 1 content mismatch
python scripts/tamper_demo.py restore --case INC-104
```
Expected: exactly the statuses in the comments. Also confirm the HR dashboard / Flutter Silent Audit screen (calling `/audit/cases/{id}/verify`) flips to ❌ at the same time.

- [ ] **Step 3: Anvil fallback rehearsal**

```bash
BLOCK=$(cast block-number --rpc-url "$AMOY_RPC_URL")
anvil --fork-url "$AMOY_RPC_URL" --fork-block-number "$BLOCK" --chain-id 80002 --port 8545
cast rpc anvil_setBalance "$RELAYER_ADDRESS" 0x56BC75E2D63100000 --rpc-url http://127.0.0.1:8545   # 100 POL
AMOY_RPC_URL=http://127.0.0.1:8545 <start backend>
```
Run the full demo once against the fork: the fork contains the real Semaphore group and registry (state at `$BLOCK`), and Foundry caches fetched state on disk for a pinned block, so a second run works even if Amoy RPC is down. Note: explorer links won't resolve for txs made on the fork.

- [ ] **Step 4: Runbook** — `docs/chain/demo-runbook.md`

Write: pre-demo checklist (relayer balance ≥ 2 POL via `cast balance`, RPC reachable, anchorer thread logging, `verify` green on all seeded cases, Polygonscan tabs open for registry + Semaphore contract), the demo-point → command/screen mapping (#1 anonymous submission → Flutter submit + show no identity in DB; #2 forged/replay → resubmit same proof → `replay`, outsider identity → `unknown_root`; #5 tamper → Step 2 commands), the fallback switch (Step 3), and the one-sentence explanation for judges: "The phone proves it's in the employee group without saying which member; the chain refuses the same nullifier twice; every case event is a salted hash chained and anchored on Polygon, so any later edit — even by a DB superuser — shows up as a mismatch against the chain."

- [ ] **Step 5: Commit**

```bash
git add scripts/tamper_demo.py docs/chain/demo-runbook.md
git commit -m "feat(audit): tamper demo script, Anvil fallback and demo runbook"
```

---

## Self-review notes

- Spec coverage (M4 deliverables): Semaphore proof verification → Tasks 3–5; scoped nullifier replay protection → Task 4 (on-chain + DB mirror) with scopes from Task 2; CaseAuditRegistry + Amoy deploy → Task 1; complaint & evidence commitments → Tasks 6, 8 (`complaint_submitted` / `evidence_sealed` with `content_sha256` + loaders); investigation-event commitments → Task 6 `EVENT_TYPES`; verification endpoint + receipts → Tasks 8–9; tamper demo → Task 10. Demo points #2 (forged/replay) and #5 (tamper) are covered end-to-end.
- Known uncertainties, each with a detection step: LeanIMT revert names (Task 3 Step 7), JS text-signal encoding (Task 4 Step 8), Flutter SDK signal/proof format (Task 5 decision table).
- Out of scope for M4 (owned by teammates, interfaces listed above): reporter case-access tokens for inbox/challenge ownership, evidence upload/storage, role guards.
