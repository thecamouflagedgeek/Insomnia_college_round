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

Offline mode accepts proofs without checking them cryptographically and keeps state in memory, so it is for UI work only.
Cases appear once reports are filed from the mobile app (enrolment code `DEMO-INVITE`).
Live mode (`CHAIN_MODE=live`) needs the repo-root `.env` filled from `.env.example`, plus `DATABASE_URL`; never commit `.env`.

## 2. HR dashboard

In a second terminal:

```bash
cd web
npm install
VITE_API_BASE_URL=http://localhost:8000 VITE_STUB_ADMIN_KEY=adm npm run dev -- --host 127.0.0.1 --port 5173
```

Open http://127.0.0.1:5173. The badge in the top bar shows **Live backend** when it reaches the API.
`VITE_STUB_ADMIN_KEY` must match the backend's `STUB_ADMIN_KEY`.

No backend? Run `VITE_FORCE_MOCK=true npm run dev` for the built-in demo data (badge shows **Demo data**).

Other commands in `web/`: `npm run build`, `npm run lint`.
