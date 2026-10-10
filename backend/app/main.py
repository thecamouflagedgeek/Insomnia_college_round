import logging
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.core.config import get_settings
from app.core.database import Database
from app.api import reports, credentials, committees, challenges, witnesses, messages, audit, notifications, exports, integrations

settings = get_settings()
logging.basicConfig(level=getattr(logging, settings.log_level.upper(), logging.INFO), format="%(levelname)s %(name)s %(message)s")
logger = logging.getLogger("incognito.api")
app = FastAPI(title="INCOGNITO API", version="0.1.0", description="Privacy-first reporting API. Data operations fail closed until schema and auth are verified.")
app.add_middleware(CORSMiddleware, allow_origins=settings.allowed_origins, allow_credentials=True, allow_methods=["GET","POST","PATCH"], allow_headers=["Authorization","Content-Type"])

for route in (reports.router, credentials.router, committees.router, challenges.router, witnesses.router, messages.router, audit.router, notifications.router, exports.router, integrations.router):
    app.include_router(route, prefix="/api/v1")

@app.exception_handler(Exception)
async def safe_unhandled_error(request: Request, exc: Exception):
    # Avoid paths too: references can be sensitive correlators in anonymous workflows.
    logger.error("Unhandled request error")
    if settings.app_env == "production":
        return JSONResponse(status_code=500, content={"detail":{"code":"internal_error","message":"An internal error occurred"}})
    return JSONResponse(status_code=500, content={"detail":{"code":"internal_error","message":"An internal error occurred"}})

@app.get("/health", tags=["health"])
def health():
    db = Database.from_settings(settings).health()
    return {"status":"ok", "environment":settings.app_env, "database":db, "complaint_submissions_enabled":False,
            "note":"Synthetic/local API readiness only; no production data operations are enabled."}
