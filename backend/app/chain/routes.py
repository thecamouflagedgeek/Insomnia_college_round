from dataclasses import asdict
from datetime import date, datetime, timedelta, timezone
from typing import Callable

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.chain.signals import challenge_scope_text, complaint_scope_text, sdk_argument
from app.chain.zk_service import EnrollmentRejected

PROOF_DEPTH = 16


class EnrollIn(BaseModel):
    commitment: int


def complaint_scope_texts(today: date) -> list[str]:
    """Today's and yesterday's scope (UTC), so a proof made just before midnight still verifies."""
    return [complaint_scope_text(today), complaint_scope_text(today - timedelta(days=1))]


def build_router(enroll_guard: Callable, case_guard: Callable) -> APIRouter:
    router = APIRouter()

    def svc(request: Request):
        return request.app.state.chain

    @router.get("/zk/group")
    def group(request: Request):
        g = svc(request).zk.group()
        return {"group_id": g.group_id, "depth": PROOF_DEPTH, "members": [str(m) for m in g.members],
                "root": str(g.root), "onchain_root": str(g.onchain_root)}

    @router.get("/zk/scopes/complaint")
    def complaint_scope(request: Request):
        texts = complaint_scope_texts(datetime.now(timezone.utc).date())
        return {"scope_text": texts[0], "sdk_argument": sdk_argument(texts[0], svc(request).settings.signal_mode),
                "valid_scope_texts": texts}

    @router.get("/zk/scopes/challenge")
    def challenge_scope(request: Request, case_id: str, member_id: str):
        text = challenge_scope_text(case_id, member_id)
        return {"scope_text": text, "sdk_argument": sdk_argument(text, svc(request).settings.signal_mode)}

    @router.post("/zk/enroll", dependencies=[Depends(enroll_guard)])
    def enroll(request: Request, body: EnrollIn):
        try:
            m = svc(request).zk.enroll(body.commitment)
        except EnrollmentRejected as exc:
            raise HTTPException(status_code=409, detail={"reason": exc.reason})
        return {"index": m.index, "root": str(m.root), "tx_hash": m.tx_hash}

    @router.get("/audit/cases/{case_id}/verify", dependencies=[Depends(case_guard)])
    def verify(request: Request, case_id: str):
        return asdict(svc(request).verifier.verify(case_id))

    @router.get("/audit/cases/{case_id}/receipts", dependencies=[Depends(case_guard)])
    def receipts(request: Request, case_id: str):
        return [asdict(r) for r in svc(request).verifier.receipts(case_id)]

    return router
