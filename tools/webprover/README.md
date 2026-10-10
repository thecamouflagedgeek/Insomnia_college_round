# Local WebView prover

`@semaphore-protocol/core` is pinned to **4.14.3** in the lockfile. The generated
`mobile/assets/prover/prover.html` is included in the repository; Flutter users do
not need Node to build the app. Rebuild from the repository root:

```sh
npm ci --prefix tools/webprover
npm run build --prefix tools/webprover
npm test --prefix tools/webprover
npm run test:chrome --prefix tools/webprover
```

Chrome tests use the installed Chrome path on Windows. Set `CHROME_PATH` on other
systems. They verify real proofs with the official verifier, text-mode bytes32
signals, ordered group roots, packed points and network boundaries. Test logs
contain metadata only.

## Flutter

Live mode defaults to the hidden WebView prover:

```sh
flutter run --dart-define=APP_MODE=live --dart-define=API_BASE_URL=https://approved-backend.example
```

Use `--dart-define=ZK_PROVER=offline` only with `CHAIN_MODE=offline`. Switching from
the offline prover changes the commitment: verify membership again with an invite
code. The same existing 32-byte secure-storage key is reused as a base64 string.
It never goes to the backend. One lazy WebView serves serialized operations and
is disposed with its provider. Failed initialization can retry; timed-out proof
operations dispose the WebView before another operation starts.

The inline bundle contains no remote scripts. Its CSP only permits downloading
public proving files from `https://snark-artifacts.pse.dev`, plus local blob workers.
Depth-16 artifacts use `/semaphore/4.13.0/`, as selected by the pinned library.
The phone needs internet for the first proof. No key, narrative or proof is sent
to that artifact host. WebView inspection, console forwarding and plugin event
diagnostic logging are disabled. API transport has no request/body logger.

The vendored Android plugin compatibility patch is documented in
`mobile/vendor/flutter_inappwebview_android/PATCHES.md`.

## No-cost local fork validation

Use an Anvil Amoy fork with an explicit **31337** local chain ID. Create a fresh
group owned by the public Anvil test account, a fresh registry and a separate
PostgreSQL database. Never use the M4 relayer key. `test/fork_setup.py` is the
Windows local setup helper: it refuses any chain ID other than 31337, expects
RPC `127.0.0.1:18545` and a loopback PostgreSQL cluster at port 54329 with user
`incognito_test`. It applies the unchanged backend migration and writes public
local configuration under ignored `.fork-tools/`.

Run the unchanged backend with that configuration (`CHAIN_MODE=live`,
`REGISTRY_ADDRESS`, `SEMAPHORE_GROUP_ID`, `DATABASE_URL`, `AMOY_RPC_URL`, public
Anvil account key, `STUB_ADMIN_KEY=adm`, `ANCHOR_INTERVAL_S=1`). Then:

```powershell
$env:FORK_BACKEND_URL='http://127.0.0.1:8011'
npm run test:chrome --prefix tools/webprover
```

The test refuses other backend origins and remote chain IDs. It checks accepted
report and challenge proofs, spent-nullifier rejection and verified audit events.
The existing content integrity check runs before proof validation: an exact
duplicate report returns 422 `claim_integrity`. A different valid payload using
the same daily nullifier returns 400 `replay`. No verifier/API changes are made.

For an Android phone connected through debugging, reverse port 8011, then from
`mobile/` run:

```sh
flutter test integration_test/webview_fork_test.dart -d DEVICE_ID --dart-define=APP_MODE=live --dart-define=API_BASE_URL=http://127.0.0.1:8011 --dart-define=FORK_DEVICE_TEST=true
```

This device test exercises the native WebView, secure-storage identity, enrollment
screen, report/challenge repository and rendered verified audit. It uses fictional
data, isolated temporary test credential names, clears those credentials afterward,
and prints proof durations only. HTTP is for debug loopback testing; release uses
HTTPS. Record actual device results in `docs/chain/zk-interop.md`.
