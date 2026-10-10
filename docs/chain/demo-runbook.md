# Blockchain / ZK demo runbook (Member 4)

## One-time setup (before the hackathon clock gets tight)

1. `cast wallet new`, then put the key and address in `.env` (`RELAYER_PRIVATE_KEY`, `RELAYER_ADDRESS`). Fund it with Amoy POL
   from https://faucet.polygon.technology (aim for ≥ 2 POL).
2. Get an **Alchemy** Amoy RPC URL. Public RPCs (publicnode) work for live use but prune old state within minutes, so
   they cannot back an Anvil fork for long.
3. Deploy the registry:
   `cd blockchain && forge script script/Deploy.s.sol --rpc-url "$AMOY_RPC_URL" --private-key "$RELAYER_PRIVATE_KEY" --broadcast`
   Then set `REGISTRY_ADDRESS`.
4. Create the group: `PYTHONPATH=backend .venv/bin/python scripts/create_group.py`, then set `SEMAPHORE_GROUP_ID`.
5. Apply `backend/migrations/0040_chain.sql` in the Supabase SQL editor.
6. Seed a rehearsal case: `PYTHONPATH=backend .venv/bin/python scripts/seed_demo_case.py INC-104`

Always `set -a; source .env; set +a` first.

## Pre-demo checklist

- [ ] `cast balance $RELAYER_ADDRESS --rpc-url $AMOY_RPC_URL --ether` ≥ 1
- [ ] Backend logs show the anchorer running; `/audit/cases/INC-104/verify` returns `ok: true`
- [ ] Polygonscan tabs open: the registry address and the Semaphore contract `0x8A1fd199516489B0Fb7153EB5f075cDAC83c693D`
- [ ] `.tamper_backup.json` does not exist (no leftover tamper)

## Demo points → what to show

| # | Demo point | How |
|---|---|---|
| 1 | Anonymous submission | Submit from the phone. Show the `complaints` row: no employee ID, only the nullifier, plus the `validateProof` tx on Polygonscan |
| 2 | Abuse resistance | Resubmit the same proof, which fails with `replay` (the chain refuses the nullifier). A proof from an unenrolled identity fails with `unknown_root` |
| 5 | Silent Audit tamper | `tamper_demo.py audit --case INC-104 --seq 2`, so the screen shows ❌ and `first altered record: #2`. Then `tamper_demo.py restore --case INC-104`. Variant: `tamper_demo.py complaint` softens the complaint text, which gives a content mismatch on #1 |

What to tell the judges: the phone proves it's in the employee group without saying which member. The chain refuses
the same nullifier twice. Every case event is a salted hash, chained and anchored on Polygon, so any later edit, even
by a database superuser who disables the protections, shows up as a mismatch against the chain.

Status meanings on the verify screen: `tampered` = this record's own data changed; `chain_broken` = intact itself but
an earlier record changed; `anchor_mismatch` = intact, but the on-chain head covering it no longer matches;
`pending_anchor` = not yet anchored (a few seconds).

## Fallback if Amoy is down during judging

```bash
BLOCK=$(cast block-number --rpc-url "$AMOY_RPC_URL")       # needs an archive-capable RPC (Alchemy)
anvil --fork-url "$AMOY_RPC_URL" --fork-block-number "$BLOCK" --chain-id 80002 --port 8545
cast rpc anvil_setBalance "$RELAYER_ADDRESS" 0x56BC75E2D63100000 --rpc-url http://127.0.0.1:8545
AMOY_RPC_URL=http://127.0.0.1:8545   # restart the backend with this
```
Run the full demo once against the fork beforehand. With a pinned block, Foundry caches the fetched state on disk,
so the fork keeps working even if Amoy becomes unreachable. Explorer links won't resolve for transactions made on the fork.

## Running the tests

```bash
cd blockchain && forge test                                   # contract
cd backend && ../.venv/bin/pytest tests                       # unit (chain/DB tests skip)
anvil --fork-url https://polygon-amoy-bor-rpc.publicnode.com --chain-id 80002 &   # fresh fork, run tests within minutes
docker run -d --rm --name incognito-pg -e POSTGRES_PASSWORD=test -p 54329:5432 postgres:16-alpine
docker exec -i incognito-pg psql -U postgres < backend/migrations/0040_chain.sql
CHAIN_TEST_RPC_URL=http://127.0.0.1:8545 TEST_DATABASE_URL=postgresql://postgres:test@127.0.0.1:54329/postgres \
  ../.venv/bin/pytest tests                                   # everything (needs node + tools/proofgen npm install)
```
