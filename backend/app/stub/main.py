"""Run: cd backend && ../.venv/bin/uvicorn app.stub.main:app --host 0.0.0.0 --port 8000

CHAIN_MODE=offline (default): no chain, no DB, proofs not checked cryptographically. For UI work.
CHAIN_MODE=live: real Semaphore group + CaseAuditRegistry on Amoy (needs the repo .env and DATABASE_URL)."""
import base64
import os
import secrets
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Header, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware

from app.chain.config import ChainSettings
from app.chain.routes import build_router
from app.chain.services import start_anchorer
from app.stub.api import build_admin_router, build_api_router
from app.stub.chain import build_stub_services
from app.stub.hr import build_hr_router
from app.stub.store import StubStore

_OFFLINE_DEFAULTS = {"AMOY_RPC_URL": "offline", "RELAYER_PRIVATE_KEY": "0x" + "0" * 63 + "1",
                     "SEMAPHORE_GROUP_ID": "0", "ANCHOR_INTERVAL_S": "1"}


def _load_dotenv(path: Path) -> dict[str, str]:
    env = {}
    if path.exists():
        for line in path.read_text().splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                env[k.strip()] = v.strip()
    return env


def enroll_guard(request: Request, x_enroll_code: str | None = Header(default=None)):
    """Stand-in for M2's HR-issued one-time enrolment codes. STUB_ENROLL_CODES is a comma-separated allowlist."""
    codes = request.app.state.enroll_codes
    if not x_enroll_code or not any(secrets.compare_digest(x_enroll_code, c) for c in codes):
        raise HTTPException(403, {"reason": "bad_enroll_code"})


def case_guard(request: Request, case_id: str, authorization: str | None = Header(default=None)):
    token = authorization.removeprefix("Bearer ").strip() if authorization else ""
    if not token or request.app.state.store.case_by_token(case_id, token) is None:
        raise HTTPException(404, {"reason": "case_not_found"})


def create_app(env: dict[str, str] | None = None) -> FastAPI:
    if env is None:
        env = {**_load_dotenv(Path(__file__).resolve().parents[3] / ".env"), **os.environ}
    mode = env.get("CHAIN_MODE", "offline")
    if mode not in ("offline", "live"):
        raise RuntimeError("CHAIN_MODE must be offline or live")
    settings = ChainSettings.from_env({**_OFFLINE_DEFAULTS, **env} if mode == "offline" else env)
    key = env.get("ENCRYPTION_KEY")
    store = StubStore(env.get("STUB_STATE_PATH") or None, base64.urlsafe_b64decode(key) if key else None)

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.chain = build_stub_services(settings, store, offline=mode == "offline")
        stop = start_anchorer(app.state.chain)
        yield
        stop()

    app = FastAPI(title="INCOGNITO integration stub", lifespan=lifespan)
    app.state.store = store
    app.state.chain_mode = mode
    app.state.enroll_codes = [c.strip() for c in env.get("STUB_ENROLL_CODES", "DEMO-INVITE").split(",") if c.strip()]
    app.state.admin_key = env.get("STUB_ADMIN_KEY", "")
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"])
    app.include_router(build_router(enroll_guard=enroll_guard, case_guard=case_guard))
    app.include_router(build_api_router())
    if app.state.admin_key:
        app.include_router(build_admin_router())
        app.include_router(build_hr_router())
    return app


app = create_app()
