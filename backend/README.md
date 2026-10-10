# INCOGNITO backend

## Local setup (PowerShell)

```powershell
cd backend
py -3.13 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install --upgrade pip
pip install -r requirements.txt
Copy-Item .env.example .env
# Edit .env locally; never send or commit secret values.
uvicorn app.main:app --reload --no-access-log --host 127.0.0.1 --port 8000
```

OpenAPI docs are at `http://127.0.0.1:8000/docs`; ReDoc is at `/redoc`. API routes use `/api/v1`; health is `/health`.

Run checks from `backend/`:

```powershell
python -m pytest -q
python scripts/check_contract.py
```

To refresh the shared OpenAPI source after intentional API edits:

```powershell
python scripts/export_openapi.py
python scripts/check_contract.py
```

## Development status

The exact Supabase schema and authentication signing configuration are absent from the repository. Data reads/writes fail closed; do not accept real complaints. See [`../docs/backend-integration.md`](../docs/backend-integration.md) for a safe read-only schema inspection procedure and the remaining integration decisions. The Supabase service key is backend-only and bypasses RLS.

Blockchain and email adapters are explicit development stubs. They cannot represent a confirmed chain transaction or delivered notification. No live RPC/deployed contract is configured.

The default correlation engine is a local token overlap baseline. To use `sentence-transformers/all-MiniLM-L6-v2`, install the optional `sentence-transformers` package separately, download/cache the model in a controlled environment, set `MODEL_ENABLED=true` and `MODEL_CACHE_DIR`, and verify offline inference before demo. Model packages are intentionally not required for startup and model files are not downloaded automatically.

Never enable live intake before schema confirmation, Supabase Auth verification for the project's signing mode, role/assignment authorization, encrypted persistence, and private evidence upload/download have been integrated and tested on a dedicated non-production project.
