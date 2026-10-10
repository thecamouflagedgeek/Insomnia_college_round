# Prompt: build the WebView Semaphore prover for the INCOGNITO Flutter app

**Owner: M1.** M1 builds, verifies and phone-tests this end to end. Copy everything below the line into a coding
assistant, or follow it directly. It is self-contained. Questions about ZK encodings or the backend go to M4.

---

## Context

INCOGNITO is a privacy-first workplace misconduct reporting app. Employees report anonymously but *verifiably*:
the phone proves "I am an enrolled employee" with a **Semaphore V4 zero-knowledge proof**, without revealing which
employee. The proof is checked on-chain by the Semaphore contract on Polygon Amoy (group 23), and a per-scope
**nullifier** stops the same person reporting twice per day or challenging the same committee member twice.

Repo: `thecamouflagedgeek/Insomnia_college_round`, branch `feat/m3-integration` (latest; stacked PRs #1 → #4).

- `mobile/` is the Flutter employee app (M1). Live mode: `--dart-define=APP_MODE=live`.
- `backend/app/stub/` is the working backend; `backend/app/chain/` holds the Semaphore and Silent Audit code.
- `shared/api-contract.yaml` is the API the app uses.
- `docs/chain/zk-interop.md` and `docs/chain/m1-integration.md` explain the encodings and the app integration.

## The problem this solves

The app has a `ZkProver` interface (`mobile/lib/integration/zk_prover.dart`) with two methods: `commitment()` and
`prove(...)`. Today live mode uses `OfflineProver`, which makes **fake proofs** that only the backend's
`CHAIN_MODE=offline` accepts. Real proofs are needed for the demo.

The native Semaphore Flutter SDK (`zkmopro/semaphore_flutter`) **cannot be used**: its Rust crate depends on a
folder on its author's laptop (`/Users/zhengyawen/...`), and the public bindings repo fails with 144 compile errors.
So we run the **official JavaScript library** inside a hidden WebView instead. That library, `@semaphore-protocol/core`
4.14.3, is already verified against our contract: its proofs are accepted on-chain, replays are rejected, and its
encodings match the backend byte for byte (`tools/proofgen/gen.mjs`).

## Setup on your machine (one time)

```bash
git fetch && git checkout feat/m3-integration
# Backend (Python 3.13+)
python3 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt
# JS tooling (Node 20+)
cd tools/proofgen && npm ci && cd ../..
# Chain tools: Foundry (gives `anvil`), and Docker for Postgres
curl -L https://foundry.paradigm.xyz | bash && foundryup
```

Quick check that the backend runs (no chain, no DB):
`cd backend && CHAIN_MODE=offline STUB_ADMIN_KEY=adm ../.venv/bin/uvicorn app.stub.main:app --host 0.0.0.0 --port 8000`
then open `http://localhost:8000/health`.

You do **not** need the M4 relayer key for the fork test: the fork copies Amoy locally. To use group 23 and the
deployed registry on the fork, the backend still signs as the relayer address, so ask M4 to run step 2 with you, or
ask for a fork-only setup. Never share or paste the relayer private key.

## What to build

### 1. JS bundle → one self-contained HTML asset

- New folder `tools/webprover/` with `package.json` (`@semaphore-protocol/core@4.14.3`, `esbuild`) and `src/prover.js`.
- `prover.js` exposes `window.incognito` with two async functions:
  - `commitment(privateKey: string) → string`: `new Identity(privateKey).commitment.toString()`.
  - `prove({privateKey, members, onchainRoot, message, scope, depth}) → object`:
    1. `identity = new Identity(privateKey)`; `group = new Group(members.map(BigInt))`.
    2. If `group.root.toString() !== onchainRoot`, throw an Error whose message starts with `GROUP_ROOT_MISMATCH:`.
    3. `p = await generateProof(identity, group, message, scope, depth)` (depth 16).
    4. Return the backend's snake_case shape with every number as a decimal string:
       `{merkle_tree_depth: 16, merkle_tree_root, nullifier, message, scope, points: [8 strings]}`.
- Build: `esbuild src/prover.js --bundle --format=iife --platform=browser --minify`. A small Node script then writes
  `mobile/assets/prover/prover.html` with the bundle **inlined** in a `<script>` tag. No external script files, so it
  loads from `initialData` without file-access problems. **Commit the built HTML** so M1 does not need Node.
- Proving files: by default the library downloads `semaphore-16.wasm` (1.8 MB) and `semaphore-16.zkey` (3.4 MB) from
  `https://snark-artifacts.pse.dev/semaphore/4.13.0/`. That host sends `Access-Control-Allow-Origin: *`, so WebView
  fetches work, but the phone needs internet on the first proof. (Optional later: bundle them as assets.)

### 2. Dart: `WebViewProver implements ZkProver`

- New file `mobile/lib/integration/webview_prover.dart`. Add dependency `flutter_inappwebview` (^6) and the asset
  `assets/prover/prover.html` to `mobile/pubspec.yaml`.
- Use one `HeadlessInAppWebView` per app session:
  - load `initialData` with the HTML from `rootBundle.loadString('assets/prover/prover.html')`;
  - wait for `onLoadStop`;
  - call `callAsyncJavaScript(functionBody: 'return await window.incognito.prove(args);', arguments: {'args': {...}})`.
- Private key: reuse `IdentityKey` (32 random bytes in `flutter_secure_storage`) and pass its **base64 string** as
  `privateKey`. The same string always gives the same identity.
- Map a JS error starting with `GROUP_ROOT_MISMATCH:` to the existing `GroupRootMismatch` exception. Map other errors to
  a new `ProverFailure` and add it to `friendlyError()` in `lib/integration/errors.dart`.
- Dispose the headless WebView on app shutdown (or keep it for the session; proofs take about 1–3 s).
- Wire it in `mobile/lib/integration/live_providers.dart`: `zkProverProvider` returns `WebViewProver` when
  `String.fromEnvironment('ZK_PROVER', defaultValue: 'webview') == 'webview'`, else `OfflineProver`. Tests keep
  overriding the provider, so widget tests never start a WebView.
- **Important:** the commitment changes when switching provers, so a phone enrolled with `OfflineProver` must
  re-enroll. In the UI that is just "Verify membership" again with a fresh invite code.

### 3. Encodings that must match (do not change)

- `message` = `"m:" + sha256hex(utf8(payloadString)).substring(0, 28)`. Already done in `ReporterZk` via `messageText()`.
- `scope` = the `sdk_argument` string from `GET /zk/scopes/complaint` or `/zk/scopes/challenge`. Pass the **text**;
  the library encodes it as bytes32 like the backend.
- Group members: `GET /zk/group` → `members` in the given order (decimal strings); compare roots with `onchain_root`.

## How to verify (definition of done)

1. **Chrome first:** serve `mobile/assets/prover/prover.html` and run it in headless Chrome (`google-chrome --headless`
   or puppeteer-core) with the same arguments. Chrome uses the same engine as Android WebView.
2. **On-chain, no cost:** start an Amoy fork (`anvil --fork-url https://polygon-amoy-bor-rpc.publicnode.com`) and
   Postgres (`docker run -d --rm --name incognito-pg -e POSTGRES_PASSWORD=pg -p 54329:5432 postgres:16-alpine`, then
   apply `backend/migrations/0040_chain.sql` to a fresh database). Run the backend with
   `CHAIN_MODE=live AMOY_RPC_URL=http://127.0.0.1:8545 DATABASE_URL=... STUB_ADMIN_KEY=adm`.
   Enroll the commitment from the HTML, generate a proof, and `POST /reports`.
   Expect `201`, then `400 replay` for the same proof, then `GET /audit/cases/{id}/verify` → `ok: true`.
   The same flow is scripted for the Rust engine in `docs/chain/m1-integration.md`; reuse its shape.
3. **Phone:** build a debug APK (`flutter build apk --debug --dart-define=APP_MODE=live
   --dart-define=API_BASE_URL=http://<laptop LAN IP>:8000`). Run the backend with `--host 0.0.0.0`, then install and
   go through: enroll → report → challenge → audit shows "Verified on Polygon". Record the proof time on the phone in
   `docs/chain/zk-interop.md` → Findings.
4. Keep everything green:
   - `flutter analyze` clean;
   - `flutter test` (demo suite);
   - `flutter test test/integration/live_ui_test.dart --dart-define=APP_MODE=live`;
   - backend `pytest`.

## Constraints

- Never send the private key or identity to the server; only the commitment (at enrollment) and proofs leave the phone.
- Do not log proofs, keys or payloads.
- Don't change backend proof verification or the API contract; the backend already accepts this proof format.
- Keep demo mode and M1's existing copy and tests untouched.
