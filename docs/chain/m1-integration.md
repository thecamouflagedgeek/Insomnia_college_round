# M1 integration: going live with the Flutter app

Everything the employee app needs to stop being a demo. The screens stay as they are. `LiveRepository`
implements the same `EmployeeRepository` / `StoryReportRepository` interfaces as `DemoRepository`.

| Piece | Where |
|---|---|
| API contract (the `shared/api-contract.yaml` the mobile README was waiting for) | `shared/api-contract.yaml` |
| Stub backend that serves it (until M3's backend lands) | `backend/app/stub/` |
| Dart integration layer | `mobile/lib/integration/` |
| Real ZK prover (needs the Semaphore SDK) | `mobile/integration/semaphore_prover.dart.example` |

## What has been verified

| Check | Result |
|---|---|
| Stub API vs contract | A test asserts every documented route is served and every served route is documented |
| Stub backend tests | 11 pass (journey, tamper detection, token scoping, proof binding, replay, witness, restart) |
| Dart: encodings vs backend | Byte-identical (`test/integration/signals_test.dart`) |
| Dart: full journey via `LiveRepository` against the stub | Passes: enrol, report + evidence, replay refused, inbox, challenge, double challenge refused, witness, audit all "Verified on Polygon" |
| Existing app | `flutter analyze` clean; all 11 original tests still pass |
| `SemaphoreProver` against the real SDK API | Type-checks (`flutter analyze`) with the SDK added |
| **Semaphore SDK engine on-chain** | Proofs from `semaphore-protocol` 0.1.0 (the Rust engine inside the Flutter SDK), sent through the stub to the real Semaphore V4 contract on an Amoy fork: accepted. Replay refused; challenge proof accepted; 7 audit events anchored and verified. Same identity commitments as the JS library. Proof time 0.1–0.3 s on a laptop |

Not verified: proving on a real phone. The Semaphore Flutter SDK does not build from public code (section 3), so real
ZK on the phone goes through the WebView + JS prover, whose proofs are already verified against the contract.

## 1. Run the stub

```bash
cd backend
../.venv/bin/pip install -r requirements.txt
# UI work, no chain, no DB, proofs not checked cryptographically:
CHAIN_MODE=offline STUB_ADMIN_KEY=adm ../.venv/bin/uvicorn app.stub.main:app --host 0.0.0.0 --port 8000
```

`CHAIN_MODE=live` uses the real Semaphore group 23 and CaseAuditRegistry on Amoy. It reads the repo `.env` and
needs `DATABASE_URL` with `backend/migrations/0040_chain.sql` applied. Each enrol, report and challenge is a
real Amoy transaction paid by the relayer (about 0.01 POL each). Only live mode accepts real proofs, and only
real proofs pass live mode.

| Env | Default | Meaning |
|---|---|---|
| `CHAIN_MODE` | `offline` | `offline` or `live` |
| `STUB_ENROLL_CODES` | `DEMO-INVITE` | Comma-separated codes accepted by `POST /zk/enroll` (M2 replaces with HR-issued codes) |
| `STUB_ADMIN_KEY` | empty (admin routes off) | Enables `/_stub/*`, the stand-in for the HR dashboard |
| `STUB_STATE_PATH` | empty (memory only) | JSON file to keep cases across restarts |

App URL: the emulator reaches the laptop at `http://10.0.2.2:8000` (the default). For a real phone on the same
Wi-Fi: `--dart-define=API_BASE_URL=http://<laptop LAN IP>:8000`. The debug manifest now allows plain HTTP;
release builds stay HTTPS-only.

## 2. Switch the app to live (M1, about 30 minutes)

1. **Repository**, in `lib/data/repository.dart`:
   ```dart
   import '../integration/live_providers.dart';
   final repositoryProvider = Provider<EmployeeRepository>(
     (ref) => demoEnabled ? DemoRepository() : ref.watch(liveRepositoryProvider));
   ```
   Run with `--dart-define=APP_MODE=live`.
2. **Enrolment.** In `VerificationScreen`, ask for the invite code, then
   `await ref.read(reporterZkProvider).enroll(code)`. Use `isEnrolled()` to skip this screen next time.
   Errors: `ApiFailure.reason == 'bad_enroll_code'`.
3. **Evidence upload.** In `create_report.dart` line ~101, pass paths instead of names:
   `files.map((f) => f.path ?? f.name).toList()`. Story attachments already carry paths.
4. **Witness code entry.** Add a field somewhere (Inbox or Settings) that calls
   `ref.read(caseVaultProvider).setWitnessCode(code)`. Then `invitations()` returns real invitations.
5. **Copy and wording.** Live strings to change: "demo" labels; `Challenge.status` is a const `'Submitted — demo'`
   in the model (make it a field); `Note.date` is always `now()` (add a date parameter if you want message
   timestamps; the API returns `at`).
6. **Errors to show to the user** (`ApiFailure.reason`):
   - `replay` on a report: "You've already filed a report today." One report per phone per UTC day, by design
     (the daily scope's nullifier).
   - `replay` on a challenge: "You've already challenged this member."
   - `NotEnrolled`: send the user to enrolment.
   - `network_error`: offline, retry.
   - `GroupRootMismatch` (live only): refresh and retry. It means someone enrolled mid-proof.
7. **Clear session.** Also call `ref.read(caseVaultProvider).clear()` if "clear session" should forget cases.
   Leave the identity key alone: deleting it means the phone must be re-enrolled.

Proof calls take about 2–6 s in live mode (an Amoy transaction). Show "Verifying on-chain…".

## 3. The Semaphore SDK spike (real ZK on the phone)

`zkmopro/semaphore_flutter` @ `27b64def484a35b729d494d5e42d3b5a31447550` (Oct 2025; no license file).

**Known problem: it does not build out of the box.** `rust/Cargo.toml` depends on
`path = "/Users/zhengyawen/Documents/GitHub/semaphore-bindings"`, a folder on its author's laptop, and has
no precompiled binaries. To build it:

1. Install a Rust toolchain (rustup), the Android NDK (Android Studio → SDK Manager → NDK), and `protoc` (protobuf
   compiler: `apt install protobuf-compiler`, `brew install protobuf`, or a release zip). The Rust build fails
   without `protoc`.
2. Fork or vendor the SDK and repoint the dependency. The public repo is
   `https://github.com/vivianjeng/semaphore-bindings` (rev `0c9601364bc6b45bd9a18fa51681f0b67c18c683`). It has
   **no `flutter` feature**, so drop `features = ["flutter"]`. See the status note at the end of this section for
   whether the SDK's generated bridge compiles against it.
3. `pubspec.yaml`: `semaphore: {git: {url: <your fork>, ref: <commit>}}` (or `path:` to the vendored copy).
4. `main()`: `await RustLib.init();` (import `package:semaphore/src/rust/frb_generated.dart`).
5. Copy `mobile/integration/semaphore_prover.dart.example` to `lib/integration/semaphore_prover.dart` and override the
   provider:
   ```dart
   ProviderScope(overrides: [
     zkProverProvider.overrideWith((ref) => SemaphoreProver(ref.watch(identityKeyProvider))),
   ], child: const IncognitoApp())
   ```
6. Run the stub in `CHAIN_MODE=live`, enrol, submit a report. Record the proof time on the phone in
   `docs/chain/zk-interop.md` → Findings.

The first proof downloads the depth-16 zkey from `snark-artifacts.pse.dev`, so the phone needs internet.

**Fallback if the SDK won't build in ~2 h:** generate proofs with `@semaphore-protocol/core` 4.14.3 in a hidden
WebView (`flutter_inappwebview`) behind the same `ZkProver` interface. The JS library is already verified against
the contract (`tools/proofgen/`). Nothing else changes.

**SDK build status (M4, checked 2026-10-11): does not build from public code.** With the dependency repointed to
the public `vivianjeng/semaphore-bindings` (rev `0c96013`, `flutter` feature dropped), `cargo check` of the SDK's
Rust crate fails with 144 errors (`to_arc` / `init_app` missing, `group` / `identity` / `proof` modules private).
The generated bridge targets an unpublished version of the bindings. **Recommendation: use the WebView + JS prover
as the primary path**, not the fallback. Only revisit the SDK if its authors publish the matching bindings.

## 4. Driving the demo without an HR dashboard

With `STUB_ADMIN_KEY=adm`:

```bash
H='-H X-Stub-Admin:adm -H Content-Type:application/json'
curl -s $H localhost:8000/_stub/cases
curl -s $H localhost:8000/_stub/reports/INC-XXXX/investigator-message -d '{"text":"Thanks. Could you share the time?"}'
curl -s $H localhost:8000/_stub/reports/INC-XXXX/status -d '{"status":"investigating"}'
curl -s $H localhost:8000/_stub/reports/INC-XXXX/challenges/CHL-XXXX/decide -d '{"decision":"upheld"}'
curl -s $H localhost:8000/_stub/witness-invitations -d '{"case_id":"INC-XXXX","context":"Team meeting on 9 Oct"}'
```

The last call returns a `witness_code` to type into the witness's phone. An upheld challenge replaces the member and
records `challenge_decided` + `member_replaced` in the Silent Audit.

## 5. For M3

The stub is the reference implementation of the contract, not the production backend. Keep the paths, bodies,
reason codes and the case-token model. Replace the in-memory store with Supabase, the keyword `/classify` with the
real model, and `/_stub/*` with M2's dashboard APIs. The audit calls in `backend/app/stub/api.py` show which event
to record at each step.
