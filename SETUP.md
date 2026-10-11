# Running INCOGNITO locally

Two processes: the backend (FastAPI on port 8000) and the HR dashboard (Vite on port 5173).
Needs Python 3.12+ and Node 20+.

## 1. Backend (offline mode: no chain, no database)

From the repo root:

```bash
python3 -m venv .venv
.venv/bin/pip install -r backend/requirements.txt

cd backend
CHAIN_MODE=offline STUB_ADMIN_KEY=adm ../.venv/bin/uvicorn app.stub.main:app --host 127.0.0.1 --port 8000
```

Windows (PowerShell): use `.venv\Scripts\pip` / `..\.venv\Scripts\uvicorn`, and set the variables first with
`$env:CHAIN_MODE="offline"; $env:STUB_ADMIN_KEY="adm"`.

Check it: open http://127.0.0.1:8000/docs.

Offline mode accepts proofs without checking them cryptographically, so it is not a demo of anonymity.

To keep data across restarts, add an encrypted state file (keep it outside the repo):

```bash
mkdir -p ~/.incognito
python3 -c "import secrets,base64;print(base64.urlsafe_b64encode(secrets.token_bytes(32)).decode())" > ~/.incognito/stub.key
CHAIN_MODE=offline STUB_ADMIN_KEY=adm STUB_STATE_PATH=$HOME/.incognito/stub_state.json \
  ENCRYPTION_KEY=$(cat ~/.incognito/stub.key) ../.venv/bin/uvicorn app.stub.main:app --host 127.0.0.1 --port 8000
```

Cases, the audit log, used nullifiers and anchors are then saved together, with report text and evidence encrypted
(AES-256-GCM). Losing the key makes the file unreadable.
Cases appear once reports are filed from the mobile app (enrolment code `DEMO-INVITE`).
Live mode (`CHAIN_MODE=live`) needs the repo-root `.env` filled from `.env.example`, plus `DATABASE_URL`; never commit `.env`.

## 2. HR dashboard

In a second terminal:

```bash
cd web
npm install
VITE_API_BASE_URL=http://localhost:8000 VITE_STUB_ADMIN_KEY=adm npm run dev -- --host 127.0.0.1 --port 5173
```

Open http://127.0.0.1:5173.
`VITE_STUB_ADMIN_KEY` must match the backend's `STUB_ADMIN_KEY`.

The dashboard shows live backend data only; if the backend is down, pages show an error with Retry.
For the old in-browser demo data instead, run `VITE_FORCE_MOCK=true npm run dev`.

Other commands in `web/`: `npm run build`, `npm run lint`.
