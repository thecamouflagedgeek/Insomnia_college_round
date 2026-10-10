# INCOGNITO employee mobile app

## Current live proving integration (2026-10-11)

Live mode uses the official Semaphore JS SDK 4.14.3 inside a hidden native WebView.
The bundled HTML is included; Node is only needed to rebuild it. See
`../tools/webprover/README.md` for build and fork/device checks.

`APP_MODE=live` defaults to `ZK_PROVER=webview`; explicitly set `ZK_PROVER=offline`
for the offline stub. Switching provers changes the commitment, so verify membership
again with an invite code. The existing secure-storage identity bytes are reused;
private keys stay on the phone. Release API transport must use HTTPS.

Tell Your Story uses labelled local fixtures in both modes. No classification
request or report occurs during understanding. After explicit confirmation, live
submission uses the agreed `/reports` contract and uploads attachments only after
acceptance. Backend classification remains disabled until its transport and
no-retention guarantees are approved and verified.

The development notes below describe earlier milestones; current validation is
recorded in `../docs/chain/zk-interop.md`.

Flutter employee experience with a shared lavender design system. Changes are confined to this folder.

## Run

```
flutter pub get
flutter run --dart-define=APP_MODE=demo
flutter analyze
flutter test
```

The default is explicitly labelled demo mode. All report, committee, conversation, witness and audit records are in-memory fixtures. Selecting evidence reads files for local preview; nothing is uploaded. Clearing the session discards demo records. Demo submission is not backend acceptance or anonymous membership verification.

`APP_MODE=live` disables demo entry and shows the integration-pending verification screen. Do not enable a live repository without the shared contract. `.env.example` documents non-secret configuration; no credential or secret should be placed there. Current startup uses compile-time APP_MODE, not an automatically loaded .env file.

## Implemented

Welcome and pending membership verification; optional device biometrics and resume lock; home navigation; four-step category/details/evidence/review form; local submission confirmation; reports and details; committee conflict challenge with pending independent outcome; investigation messages; voluntary witness accept/decline; expandable audit receipts and copy action; privacy and local-session controls.

Android uses FlutterFragmentActivity and biometric permission. Biometrics guard local access after backgrounding. Credentials are not issued in demo mode. The secure-storage preference is not a credential or membership proof. Document selections show metadata; images support local preview. Demo files are limited to five, 20 MB each; backend limits remain to be agreed.

## Integration handoff — blocked contracts

No `shared/api-contract.yaml`, backend implementation or design-reference image was present at inspection. The provided visual tokens guided the design. Do not infer production API schemas from the demo models.

`EmployeeRepository` isolates presentation from demo persistence. `ApiService` provides one Dio client, timeouts and proposed read-route transport; it is intentionally unwired. The bearer-header setter is a proposed transport capability, not an agreed authentication mechanism.

Required from backend/ZKP teammates:

- Membership enrollment/proof and anonymous session schema, expiry and recovery.
- Own-report listing, report submission/detail schemas and authorized action flags.
- Evidence upload, size/type validation, private access and retry semantics.
- Committee assignments, challenge request/status/outcome schemas.
- Message fetch/send schemas, pagination and sender authorization.
- Witness listing/context/response schemas.
- Audit event/receipt verification schemas, timestamps and integrity states.
- Idempotency support before any submission retry mechanism is enabled.

Proposed routes from the brief: POST /reports; GET /reports/{id}; POST /reports/{id}/challenge; GET/POST /reports/{id}/messages; POST /witness-invitations/{id}/respond; GET /reports/{id}/audit. No production payload adapters are invented here.

Live authorization, credential expiry/recovery, upload progress/retries, independent challenge outcomes/reassignment, real audit verification, and real API error mapping remain integration work. Demo audit failure is explicitly illustrative. No AI classification, ZKP cryptography, blockchain verification, HR workflow or backend business rules are implemented locally.

## Validation performed

- `flutter pub get`: passed.
- `flutter analyze`: passed with no issues.
- `flutter test`: all five tests passed, including the 360×740 guided report journey and enlarged-text screen checks.
- Android debug APK built and installed on API 33 emulator.
- Emulator checks: welcome rendering, verification-pending screen, demo entry, biometric skip, home rendering, report list and case-detail navigation.
- Screenshots saved in `artifacts/`.
- Native file picker, biometric authentication, real backend communication, and full real investigation lifecycle are not yet validated.

Debug APK: `build/app/outputs/flutter-apk/app-debug.apk`. Debug signing is for development only.

## Private Tell Your Story

Home offers **Tell Your Story** separately from structured reporting. The freeform narrative and classification selections live only in Riverpod memory. Understanding does not call the report repository, create cases/audit records, upload files, or communicate with HR. There are no narrative logs, analytics, external AI calls or persistence hooks.

Guidance is a labelled fixed UI fixture, not NLP inferred from the narrative. Employees may select multiple possibilities or leave classification uncertain, consider optional contextual questions, continue understanding, or discard privately. Back navigation out of the workspace and clearing the employee session discard temporary state. Returning from review to understanding intentionally retains the draft.

**Proceed to Report** shows the exact untrimmed narrative, selected suggested categories, and optional attachment metadata. Review entry does not submit anything. A confirmation checkbox plus a final submit action gate the repository call. Attachment changes revoke confirmation. Failure retains the draft; success clears it and opens the formal local demo case. Story reports preserve multiple categories and do not invent an incident date.

Files remain local: demo submission stores names only, as disclosed in review. Live submission remains pending the approved report/evidence contract. `StoryReportRepository` and `StorySubmission` are application boundaries, not invented HTTP schemas. Future POST /reports integration must run only after explicit confirmation and begin case navigation only after backend acceptance.

No backend classification is implemented. Member 3 must provide an agreed stateless schema, HTTPS transport configuration, and verified no-retention behavior before narratives leave the device. No external AI endpoint is used.

The 11-test suite covers report isolation, discard, multiple categories, exact whitespace preservation, confirmation gating, failure retention, fresh-app defaults, sign-out and back navigation, plus the existing reporter journey.

Tell Your Story final validation: `flutter analyze` passed with no issues; `flutter test --timeout 45s` passed all 11 tests; the Android debug APK was rebuilt successfully. Updated-device visual validation was not performed because the earlier emulator was no longer connected. Existing screenshots predate this feature.
