import base64
import hashlib
import json
import secrets
from datetime import date, datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, File, Header, HTTPException, Request, UploadFile, Response
from pydantic import BaseModel, Field, ValidationError

from app.chain.hashing import content_sha256
from app.chain.routes import complaint_scope_texts
from app.chain.semaphore import ProofIn
from app.chain.signals import challenge_scope_text
from app.chain.zk_service import ProofRejected
from app.stub import evidence_check, intelligence
from app.stub.store import COMMITTEE, DEFAULT_REPLACEMENT, STAFF, Case, ChallengeRec, Evidence, Invitation, \
    Message, StubStore, committee_entry, new_id, now, token_hash

MAX_EVIDENCE_FILES = 5
MAX_EVIDENCE_BYTES = 20 * 1024 * 1024
CATEGORIES = ["Harassment", "Sexual Harassment", "Bullying", "Discrimination", "Abuse of Authority", "Retaliation",
              "Fraud", "Safety", "Other"]
CHALLENGE_REASONS = ["Professional relationship", "Personal relationship", "Prior involvement", "Other"]


# ---- request models --------------------------------------------------------------------------------------------

class ReportPayload(BaseModel):
    """The JSON object inside SubmitReportIn.payload (a string, so the proof's message hash is over exact bytes)."""
    category: str
    categories: list[str] = Field(default_factory=list)
    title: str = Field(min_length=1, max_length=200)
    description: str = Field(min_length=1, max_length=20000)
    incident_date: date | None = None
    client_nonce: str = Field(min_length=8, max_length=64)
    # Opaque directory reference for the person reported, chosen from a list (never a typed name). Enables Repeat
    # Allegation Intelligence; visible to authorised HR staff only.
    subject_ref: str | None = Field(default=None, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")


class SubmitReportIn(BaseModel):
    payload: str
    proof: ProofIn


class ChallengePayload(BaseModel):
    member_id: str
    reason: str
    explanation: str = Field(min_length=15, max_length=5000)
    client_nonce: str = Field(min_length=8, max_length=64)


class ChallengeIn(BaseModel):
    payload: str
    proof: ProofIn


class MessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=5000)


class ClassifyIn(BaseModel):
    text: str = Field(min_length=1, max_length=20000)


class ReflectionIn(BaseModel):
    """Reflect & Reform: structured, no free text, so feedback cannot identify the reporter."""
    fairness: int = Field(ge=1, le=5)
    felt_safe: bool
    would_report_again: bool


class WitnessResponseIn(BaseModel):
    response: Literal["accept", "decline"]


# ---- helpers ---------------------------------------------------------------------------------------------------

def _store(request: Request) -> StubStore:
    return request.app.state.store


def _chain(request: Request):
    return request.app.state.chain


def _bearer(authorization: str | None) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(401, {"reason": "missing_case_token"})
    return authorization.removeprefix("Bearer ").strip()


def case_access(request: Request, case_id: str, authorization: str | None = Header(default=None)) -> Case:
    """The anonymous reporter's only credential: the case token returned once by POST /reports."""
    case = _store(request).case_by_token(case_id, _bearer(authorization))
    if case is None:
        raise HTTPException(404, {"reason": "case_not_found"})
    return case


def _parse(model, raw: str):
    try:
        return model.model_validate(json.loads(raw))
    except (json.JSONDecodeError, ValidationError) as exc:
        raise HTTPException(422, {"reason": "bad_payload", "detail": str(exc)[:500]})


def _rejected(exc: ProofRejected) -> HTTPException:
    return HTTPException(400, {"reason": exc.reason})


def _explorer(request: Request, tx: str) -> str:
    return _chain(request).settings.explorer_tx_url.format(hash=tx)


def case_view(case: Case) -> dict:
    p = case.payload
    return {
        "case_id": case.case_id,
        "status": case.status,
        "category": p["category"],
        "categories": p.get("categories", []),
        "title": p["title"],
        "description": p["description"],
        "incident_date": p.get("incident_date"),
        "created_at": case.created_at,
        "committee": case.committee,
        "evidence": [{"evidence_id": e.evidence_id, "name": e.name, "mime": e.mime, "size": e.size,
                      "sha256": e.sha256} for e in case.evidence],
        "challenges": [{"challenge_id": c.challenge_id, "member_id": c.member_id, "reason": c.reason,
                        "status": c.status, "proof_tx": c.proof_tx, "at": c.at} for c in case.challenges],
        "resolution": ({k: case.resolution[k] for k in ("outcome", "actions", "at")} if case.resolution else None),
        "reflection_submitted": case.reflection is not None,
    }


def _message_view(m: Message) -> dict:
    return {"message_id": m.message_id, "sender": m.sender, "text": m.text, "at": m.at}


def _set_status(request: Request, case: Case, to: str) -> None:
    _chain(request).audit.record(case.case_id, "status_changed", {"from": case.status, "to": to})
    case.status = to


def _add_message(request: Request, case: Case, sender: str, text: str) -> Message:
    msg = Message(new_id("MSG"), sender, text, now())
    case.messages.append(msg)
    _chain(request).audit.record(case.case_id, "inbox_message", {
        "message_id": msg.message_id, "direction": "in" if sender == "you" else "out",
        "content_sha256": content_sha256(text.encode("utf-8"))})
    return msg


def add_message(request: Request, case: Case, sender: str, text: str) -> Message:
    return _add_message(request, case, sender, text)


def decide_challenge(request: Request, case: Case, ch: ChallengeRec, decision: str, reviewer_id: str,
                     rationale: str | None = None, replacement_id: str = DEFAULT_REPLACEMENT) -> None:
    """decision: upheld | rejected. Upheld revokes the challenged member's access and seats a replacement when an
    eligible one exists (not seated, not the challenged member, never someone removed from this case). Everything is
    checked before anything changes, so a failure leaves the challenge pending."""
    if ch.status != "pending_review":
        raise HTTPException(409, {"reason": "already_decided"})
    old = ch.member_id
    seated = {m["member_id"] for m in case.committee}

    def eligible(i: str) -> bool:
        return (STAFF.get(i, {}).get("role") == "committee_member" and i not in seated and i != old
                and i not in case.revoked_ids)

    replacement: str | None = None
    if decision == "upheld":
        replacement = replacement_id if eligible(replacement_id) else next((i for i in STAFF if eligible(i)), None)
    ch.status, ch.reviewer_id, ch.rationale, ch.decided_at = decision, reviewer_id, rationale, now()
    audit = _chain(request).audit
    audit.record(case.case_id, "challenge_decided",
                 {"challenge_id": ch.challenge_id, "decision": decision, "reviewer_id": reviewer_id})
    if decision == "upheld":
        case.committee = [m for m in case.committee if m["member_id"] != old]
        if replacement:
            case.committee.append(committee_entry(replacement))
        if old not in case.revoked_ids:
            case.revoked_ids.append(old)
        if replacement:
            audit.record(case.case_id, "member_replaced", {"old_member_id": old, "new_member_id": replacement})
        audit.record(case.case_id, "access_revoked", {"member_id": old})


def create_invitation(request: Request, case: Case, context: str, alias: str) -> tuple[Invitation, str]:
    store = _store(request)
    code = secrets.token_urlsafe(9)
    inv = Invitation(new_id("WIT"), case.case_id, token_hash(code), context, alias=alias, invited_at=now())
    first = not any(i.case_id == case.case_id for i in store.invitations.values())
    store.invitations[inv.invitation_id] = inv
    if first:
        _chain(request).audit.record(case.case_id, "witness_quorum_started",
                                     {"quorum_id": f"WQ-{case.case_id}", "invited_count": 1})
    return inv, code


# ---- routers ---------------------------------------------------------------------------------------------------

def build_api_router() -> APIRouter:
    r = APIRouter()

    @r.get("/health")
    def health(request: Request):
        s = _chain(request).settings
        return {"ok": True, "chain_mode": request.app.state.chain_mode, "group_id": s.group_id,
                "registry": s.registry_address or None}

    @r.get("/categories")
    def categories():
        return {"categories": CATEGORIES, "challenge_reasons": CHALLENGE_REASONS}

    @r.post("/classify")
    def classify(body: ClassifyIn):
        """M3's classifier (app/engines). Stateless: nothing is logged or stored."""
        return intelligence.classify(body.text)

    @r.post("/reports", status_code=201)
    def submit_report(request: Request, body: SubmitReportIn):
        payload = _parse(ReportPayload, body.payload)
        if payload.category not in CATEGORIES and payload.category != "Uncertain":
            raise HTTPException(422, {"reason": "unknown_category"})
        fingerprint = content_sha256(" ".join(f"{payload.title} {payload.description}".lower().split()).encode())
        store = _store(request)
        check = intelligence.integrity(payload.title, payload.description, payload.category,
                                       {c.fingerprint for c in store.cases.values()}, fingerprint)
        if not check["accepted_for_review"]:
            raise HTTPException(422, {"reason": "claim_integrity", "flags": check["flags"]})
        try:
            ok = _chain(request).zk.verify_submission(
                body.proof, body.payload, complaint_scope_texts(datetime.now(timezone.utc).date()), "complaint")
        except ProofRejected as exc:
            raise _rejected(exc)
        audit = _chain(request).audit
        token = secrets.token_urlsafe(32)
        sev = intelligence.severity(payload.title, payload.description, payload.category)
        with store.lock:
            case_id = new_id("INC")
            case = Case(case_id, token_hash(token), body.payload, "submitted", now(),
                        nullifier=str(ok.nullifier), proof_tx=ok.tx_hash, severity=sev,
                        subject_ref=payload.subject_ref, fingerprint=fingerprint)
            store.cases[case_id] = case
            audit.record(case_id, "complaint_submitted", {
                "content_sha256": content_sha256(body.payload.encode("utf-8")),
                "nullifier": str(ok.nullifier), "proof_tx": ok.tx_hash})
            audit.record(case_id, "case_classified", {"category": payload.category})
            audit.record(case_id, "severity_assessed", {"level": sev["level"]})
            audit.record(case_id, "committee_assigned", {
                "committee_id": "COM-DEMO", "member_ids": [m["member_id"] for m in COMMITTEE]})
            _set_status(request, case, "committee_assigned")
            store.save()
        return {"case_id": case_id, "case_token": token, "status": case.status, "proof_tx": ok.tx_hash,
                "explorer_url": _explorer(request, ok.tx_hash)}

    @r.get("/reports/{case_id}")
    def get_report(case: Case = Depends(case_access)):
        return case_view(case)

    @r.post("/reports/{case_id}/evidence", status_code=201)
    async def upload_evidence(request: Request, file: UploadFile = File(...), case: Case = Depends(case_access)):
        if len(case.evidence) >= MAX_EVIDENCE_FILES:
            raise HTTPException(413, {"reason": "too_many_files"})
        content = await file.read(MAX_EVIDENCE_BYTES + 1)
        if len(content) > MAX_EVIDENCE_BYTES:
            raise HTTPException(413, {"reason": "file_too_large"})
        store = _store(request)
        digest = lambda b: hashlib.sha256(b).hexdigest()
        with store.lock:
            others = [e for c in store.cases.values() if c.case_id != case.case_id for e in c.evidence]
            elsewhere = {h for e in others for h in (e.sha256, e.original_sha256) if h}
            incident = case.payload.get("incident_date")
            check = evidence_check.analyse(content, file.content_type or "", date.fromisoformat(incident)
                                           if incident else None, elsewhere, digest, (file.filename or "file")[:200],
                                           {e.phash for e in others if e.phash})
            # The cleaned copy (identifying metadata removed) is what is stored, sealed and later shown to staff.
            sha = digest(check.content)
            ev = Evidence(new_id("EVD"), check.name, check.mime, len(check.content), sha,
                          base64.b64encode(check.content).decode(), check.flags, digest(content), check.phash)
            case.evidence.append(ev)
            _chain(request).audit.record(case.case_id, "evidence_sealed", {
                "evidence_id": ev.evidence_id, "content_sha256": sha, "size": ev.size, "mime": ev.mime})
            store.save()
        return {"evidence_id": ev.evidence_id, "name": ev.name, "mime": ev.mime, "size": ev.size, "sha256": sha}

    @r.get("/reports/{case_id}/evidence/{evidence_id}")
    def evidence_file(evidence_id: str, case: Case = Depends(case_access)):
        """The reporter's own file, as stored (the cleaned copy staff see). Only this case's token opens it."""
        ev = next((e for e in case.evidence if e.evidence_id == evidence_id), None)
        if ev is None:
            raise HTTPException(404, {"reason": "evidence_not_found"})
        return Response(base64.b64decode(ev.content_b64), media_type=ev.mime,
                        headers={"X-Content-SHA256": ev.sha256, "Cache-Control": "no-store",
                                 "Content-Disposition": "inline"})

    @r.post("/reports/{case_id}/challenge", status_code=201)
    def challenge(request: Request, body: ChallengeIn, case: Case = Depends(case_access)):
        p = _parse(ChallengePayload, body.payload)
        if p.member_id not in {m["member_id"] for m in case.committee}:
            raise HTTPException(422, {"reason": "unknown_member"})
        if p.reason not in CHALLENGE_REASONS:
            raise HTTPException(422, {"reason": "unknown_reason"})
        try:
            ok = _chain(request).zk.verify_submission(
                body.proof, body.payload, [challenge_scope_text(case.case_id, p.member_id)], "challenge")
        except ProofRejected as exc:
            raise _rejected(exc)
        store = _store(request)
        with store.lock:
            rec = ChallengeRec(new_id("CHL"), p.member_id, p.reason, p.explanation, "pending_review", ok.tx_hash, now())
            case.challenges.append(rec)
            _chain(request).audit.record(case.case_id, "challenge_filed", {
                "challenge_id": rec.challenge_id, "member_id": p.member_id,
                "nullifier": str(ok.nullifier), "proof_tx": ok.tx_hash})
            store.save()
        return {"challenge_id": rec.challenge_id, "member_id": rec.member_id, "status": rec.status,
                "proof_tx": ok.tx_hash, "explorer_url": _explorer(request, ok.tx_hash)}

    @r.post("/reports/{case_id}/reflection", status_code=201)
    def reflection(request: Request, body: ReflectionIn, case: Case = Depends(case_access)):
        if case.resolution is None:
            raise HTTPException(409, {"reason": "not_resolved"})
        if case.reflection is not None:
            raise HTTPException(409, {"reason": "already_reflected"})
        store = _store(request)
        with store.lock:
            case.reflection = {**body.model_dump(), "at": now()}
            _chain(request).audit.record(case.case_id, "reflection_recorded", {"reflection_id": new_id("REF")})
            store.save()
        return {"recorded": True}

    @r.get("/reports/{case_id}/messages")
    def messages(case: Case = Depends(case_access)):
        return [_message_view(m) for m in case.messages]

    @r.post("/reports/{case_id}/messages", status_code=201)
    def send_message(request: Request, body: MessageIn, case: Case = Depends(case_access)):
        store = _store(request)
        with store.lock:
            msg = _add_message(request, case, "you", body.text)
            store.save()
        return _message_view(msg)

    def witness_code(x_witness_code: str | None = Header(default=None)) -> str:
        if not x_witness_code:
            raise HTTPException(401, {"reason": "missing_witness_code"})
        return x_witness_code

    @r.get("/witness-invitations")
    def invitations(request: Request, code: str = Depends(witness_code)):
        h = token_hash(code)
        return [{"invitation_id": i.invitation_id, "context": i.context, "response": i.response}
                for i in _store(request).invitations.values() if secrets.compare_digest(i.code_hash, h)]

    @r.post("/witness-invitations/{invitation_id}/respond")
    def respond(request: Request, invitation_id: str, body: WitnessResponseIn, code: str = Depends(witness_code)):
        store = _store(request)
        inv = store.invitations.get(invitation_id)
        if inv is None or not secrets.compare_digest(inv.code_hash, token_hash(code)):
            raise HTTPException(404, {"reason": "invitation_not_found"})
        if inv.response is not None:
            raise HTTPException(409, {"reason": "already_responded"})
        with store.lock:
            inv.response, inv.responded_at = body.response, now()
            same = [i for i in store.invitations.values() if i.case_id == inv.case_id]
            _chain(request).audit.record(inv.case_id, "witness_response_recorded", {
                "quorum_id": f"WQ-{inv.case_id}",
                "accepted_count": sum(i.response == "accept" for i in same),
                "declined_count": sum(i.response == "decline" for i in same)})
            store.save()
        return {"invitation_id": inv.invitation_id, "context": inv.context, "response": inv.response}

    return r


class InvestigatorMessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=5000)


class StatusIn(BaseModel):
    status: Literal["committee_assigned", "investigating", "resolved", "closed"]


class DecisionIn(BaseModel):
    decision: Literal["upheld", "rejected"]


class InviteIn(BaseModel):
    case_id: str
    context: str = Field(min_length=1, max_length=2000)


def build_admin_router() -> APIRouter:
    """Stand-ins for the HR dashboard (M2/M3) so the reporter journey can be demoed end to end.
    Mounted only when STUB_ADMIN_KEY is set; every call needs X-Stub-Admin: <key>."""

    def admin(request: Request, x_stub_admin: str | None = Header(default=None)):
        key = request.app.state.admin_key
        if not key or not x_stub_admin or not secrets.compare_digest(key, x_stub_admin):
            raise HTTPException(403, {"reason": "admin_only"})

    r = APIRouter(prefix="/_stub", dependencies=[Depends(admin)])

    def _case(request: Request, case_id: str) -> Case:
        case = _store(request).cases.get(case_id)
        if case is None:
            raise HTTPException(404, {"reason": "case_not_found"})
        return case

    @r.get("/cases")
    def cases(request: Request):
        return [{"case_id": c.case_id, "status": c.status, "created_at": c.created_at}
                for c in _store(request).cases.values()]

    @r.post("/reports/{case_id}/investigator-message", status_code=201)
    def investigator_message(request: Request, case_id: str, body: InvestigatorMessageIn):
        store = _store(request)
        with store.lock:
            msg = _add_message(request, _case(request, case_id), "investigator", body.text)
            store.save()
        return _message_view(msg)

    @r.post("/reports/{case_id}/status")
    def status(request: Request, case_id: str, body: StatusIn):
        store = _store(request)
        with store.lock:
            case = _case(request, case_id)
            _set_status(request, case, body.status)
            store.save()
        return {"case_id": case_id, "status": case.status}

    @r.post("/reports/{case_id}/challenges/{challenge_id}/decide")
    def decide(request: Request, case_id: str, challenge_id: str, body: DecisionIn):
        store = _store(request)
        with store.lock:
            case = _case(request, case_id)
            ch = next((c for c in case.challenges if c.challenge_id == challenge_id), None)
            if ch is None:
                raise HTTPException(404, {"reason": "challenge_not_found"})
            decide_challenge(request, case, ch, body.decision, "usr_aris")
            store.save()
        return case_view(case)

    @r.post("/witness-invitations", status_code=201)
    def invite(request: Request, body: InviteIn):
        store = _store(request)
        case = _case(request, body.case_id)
        with store.lock:
            inv, code = create_invitation(request, case, body.context, "Witness")
            store.save()
        return {"invitation_id": inv.invitation_id, "witness_code": code}

    return r
