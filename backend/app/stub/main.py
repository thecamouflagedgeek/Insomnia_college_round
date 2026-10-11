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


def _init_offline_audit(chain, store: StubStore) -> None:
    for case in store.cases.values():
        if not chain.audit.events(case.case_id):
            chain.audit.record(case.case_id, "complaint_submitted", {
                "content_sha256": "0" * 64, "nullifier": case.nullifier, "proof_tx": case.proof_tx})
            if case.committee:
                chain.audit.record(case.case_id, "committee_assigned", {
                    "member_ids": [m["member_id"] for m in case.committee]})
            for ch in case.challenges:
                chain.audit.record(case.case_id, "challenge_filed", {
                    "challenge_id": ch.challenge_id, "member_id": ch.member_id, "proof_tx": ch.proof_tx})
                if ch.status != "pending_review":
                    chain.audit.record(case.case_id, "challenge_decided", {
                        "challenge_id": ch.challenge_id, "decision": ch.status, "reviewer_id": ch.reviewer_id or "usr_aris"})
            for m in case.messages:
                chain.audit.record(case.case_id, "inbox_message", {
                    "message_id": m.message_id, "direction": "in" if m.sender == "you" else "out"})
            if case.resolution:
                chain.audit.record(case.case_id, "resolution_recorded", case.resolution)


def create_app(env: dict[str, str] | None = None) -> FastAPI:
    if env is None:
        root_dir = Path(__file__).resolve().parents[3]
        backend_dir = Path(__file__).resolve().parents[2]
        env = {
            **_load_dotenv(root_dir / ".env"),
            **_load_dotenv(backend_dir / ".env"),
            **os.environ,
        }
    mode = env.get("CHAIN_MODE", "offline")
    if mode not in ("offline", "live"):
        raise RuntimeError("CHAIN_MODE must be offline or live")
    app_env = env.get("APP_ENV", "development").lower()
    if app_env == "production" and mode == "offline":
        raise RuntimeError("CHAIN_MODE cannot be offline in production environment (APP_ENV=production)")

    is_prod = app_env == "production"
    demo_mode = (not is_prod) and env.get("DEMO_MODE", "true").lower() in ("true", "1", "yes")

    settings = ChainSettings.from_env({**_OFFLINE_DEFAULTS, **env} if mode == "offline" else env)
    key_str = env.get("ENCRYPTION_KEY", "").strip()
    key_bytes = None
    if key_str and key_str != "replace_with_32_byte_urlsafe_base64_key":
        try:
            decoded = base64.urlsafe_b64decode(key_str)
            if len(decoded) == 32:
                key_bytes = decoded
        except Exception:
            pass

    state_path = env.get("STUB_STATE_PATH")
    if not state_path and not is_prod and key_bytes:
        backend_dir = Path(__file__).resolve().parents[2]
        state_path = str(backend_dir / ".stub_state.json")

    supabase_repo = None
    supabase_url = env.get("SUPABASE_URL")
    supabase_key = env.get("SUPABASE_SECRET_KEY")
    if supabase_url and supabase_key and supabase_key != "replace_me":
        try:
            from app.core.supabase_repo import SupabaseRepository
            from supabase import create_client
            sb_client = create_client(supabase_url, supabase_key)
            supabase_repo = SupabaseRepository(sb_client, key_bytes)
        except Exception as exc:
            if is_prod:
                raise RuntimeError(f"Production Supabase initialization failed: {exc}") from exc
    elif is_prod:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SECRET_KEY are required in production (APP_ENV=production)")

    store = StubStore(
        state_path or None,
        key_bytes,
        seed_demo=demo_mode,
        supabase=supabase_repo
    )

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.chain = build_stub_services(settings, store, offline=mode == "offline")
        if mode == "offline":
            _init_offline_audit(app.state.chain, store)
        stop = start_anchorer(app.state.chain)
        yield
        stop()

    app = FastAPI(title="INCOGNITO integration stub", lifespan=lifespan)
    app.state.store = store
    app.state.supabase = supabase_repo
    app.state.chain_mode = mode
    app.state.is_production = is_prod
    app.state.demo_permitted = (not is_prod) and demo_mode and mode == "offline"
    app.state.enroll_codes = [c.strip() for c in env.get("STUB_ENROLL_CODES", "DEMO-INVITE").split(",") if c.strip()]
    app.state.admin_key = env.get("STUB_ADMIN_KEY", "adm" if not is_prod else "")
    app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["*"], allow_headers=["*"],
                       expose_headers=["X-Export-Id", "X-Content-SHA256", "Content-Disposition"])
    app.include_router(build_router(enroll_guard=enroll_guard, case_guard=case_guard))
    app.include_router(build_api_router())
    if app.state.admin_key:
        app.include_router(build_admin_router())
        app.include_router(build_hr_router())
    return app


app = create_app()
