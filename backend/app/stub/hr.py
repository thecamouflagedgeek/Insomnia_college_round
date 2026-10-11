"""HR dashboard API (M2's web app). Returns the shapes in web/src/types/*.ts and enforces, on the server, the
access rules the dashboard used to check in the browser:

- hr_reviewer, independent_reviewer, administrator: every case.
- assigned_investigator: cases they are assigned to. committee_member: cases they sit on.
- A member removed by an upheld challenge loses access to that case immediately (403, and the denial is audited).
- A challenged member never sees challenges against themselves.
- Only independent_reviewer / administrator decide challenges; only the assigned investigator / administrator
  invites witnesses; witness responses are masked for everyone else.

Stand-in auth: X-Stub-Admin (the stub's shared key) + X-Staff-Id (who is acting). M2's real auth replaces both."""
import hashlib
import secrets
from typing import Literal

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response
from pydantic import BaseModel, Field

from app.chain.hashing import content_sha256
from app.stub.api import (_chain, _store, add_message, create_invitation, decide_challenge)
from app.stub import intelligence, persist
from app.stub.store import DEFAULT_REPLACEMENT, STAFF, Case, ChallengeRec, committee_entry, new_id, now
from app.utils.pdf_generator import investigation_pdf

SUPERVISORY = {"hr_reviewer", "independent_reviewer", "administrator"}

_CATEGORY = {"Sexual Harassment": "sexual_harassment", "Discrimination": "discrimination",
             "Fraud": "whistleblowing_bribery", "Retaliation": "workplace_retaliation"}
_POOL = {"sexual_harassment": "posh_harassment", "discrimination": "discrimination_inclusion",
         "whistleblowing_bribery": "whistleblowing_ethics", "workplace_retaliation": "whistleblowing_ethics",
         "bullying_authority_abuse": "workplace_conduct"}
_CONFLICT = {"Professional relationship": "hierarchy_direct", "Personal relationship": "personal_relationship",
             "Prior involvement": "prior_retaliation_involvement", "Other": "departmental_bias"}
_CHALLENGE_STATUS = {"pending_review": "pending_independent_review", "upheld": "approved_access_revoked",
                     "rejected": "rejected_assignment_maintained"}
_AUDIT_TYPE = {"complaint_submitted": "complaint_sealed_zkp", "committee_assigned": "committee_assigned",
               "challenge_filed": "committee_challenged", "challenge_decided": "challenge_adjudicated_revoked",
               "member_replaced": "reassignment_performed", "access_revoked": "access_denied_attempt",
               "witness_quorum_started": "witness_invited", "witness_response_recorded": "witness_statement_recorded",
               "evidence_sealed": "evidence_integrity_verified", "export_generated": "legal_export_compiled"}
_VERIFY = {"verified": "verified_commitment", "pending_anchor": "pending_verification",
           "tampered": "verification_failed", "chain_broken": "verification_failed",
           "anchor_mismatch": "verification_failed"}


class Staff(BaseModel):
    id: str
    name: str
    role: str
    title: str


def staff(request: Request, x_stub_admin: str | None = Header(default=None),
          x_staff_id: str | None = Header(default=None)) -> Staff:
    key = request.app.state.admin_key
    if not key or not x_stub_admin or not secrets.compare_digest(key, x_stub_admin):
        raise HTTPException(401, {"reason": "staff_auth_required"})
    s = STAFF.get(x_staff_id or "")
    if s is None:
        raise HTTPException(401, {"reason": "unknown_staff"})
    return Staff(id=x_staff_id, name=s["name"], role=s["role"], title=s["title"])


def _forbidden(message: str) -> HTTPException:
    return HTTPException(403, {"reason": "forbidden", "message": message})


def can_access(user: Staff, case: Case) -> bool:
    if user.id in case.revoked_ids:
        return False
    if user.role in SUPERVISORY:
        return True
    if user.role == "assigned_investigator":
        return case.investigator_id == user.id
    if user.role == "committee_member":
        return user.id in {m["member_id"] for m in case.committee}
    return False


def _case_for(request: Request, user: Staff, case_id: str) -> Case:
    case = _store(request).cases.get(case_id)
    if case is None:
        raise HTTPException(404, {"reason": "case_not_found"})
    if user.id in case.revoked_ids:
        _chain(request).audit.record(case.case_id, "access_revoked", {"member_id": user.id})
        _store(request).save()
        raise _forbidden(f"403: Forbidden - Access Revoked. {user.name} was removed from Case {case_id} "
                         "following independent challenge adjudication.")
    if not can_access(user, case):
        raise _forbidden(f"403: Forbidden - {user.name} ({user.role}) is not assigned to Case {case_id}.")
    return case


def _category(case: Case) -> str:
    return _CATEGORY.get(case.payload["category"], "bullying_authority_abuse")


def _status(request: Request, case: Case) -> str:
    if any(c.status == "pending_review" for c in case.challenges):
        return "under_challenge"
    if case.status == "investigating":
        return "investigation_active"
    if case.status == "resolved":
        return "resolved"
    if case.status == "closed":
        return "archived"
    if any(i.case_id == case.case_id for i in _store(request).invitations.values()):
        return "witness_quorum_active"
    return case.status


def _next_action(status: str) -> str:
    return {"under_challenge": "Independent reviewer must adjudicate the pending committee challenge.",
            "committee_assigned": "Committee assigned. Investigator to open the inquiry.",
            "witness_quorum_active": "Awaiting voluntary witness responses.",
            "investigation_active": "Investigation in progress.",
            "resolved": "Resolution recorded.", "archived": "Case archived."}.get(status, "Review the report.")


def _evidence_status(request: Request, case: Case, verification) -> dict[str, str]:
    """evidence_id -> status of its evidence_sealed audit event."""
    if verification is None:
        return {}
    by_seq = {e.seq: e for e in _chain(request).verifier.events(case.case_id)}
    return {by_seq[c.seq].payload["data"].get("evidence_id"): c.status
            for c in verification.events if c.event_type == "evidence_sealed"}


def complaint_dto(request: Request, case: Case, verification=None) -> dict:
    p = case.payload
    cat = _category(case)
    sev = case.severity or intelligence.severity(p["title"], p["description"], p["category"])
    ev_status = _evidence_status(request, case, verification)
    evidence = [{
        "id": e.evidence_id, "name": e.name, "size": f"{e.size / 1024:.1f} KB", "mimeType": e.mime,
        "sha256Hash": e.sha256, "zkpCommitment": case.nullifier, "uploadTimestamp": case.created_at,
        "verificationStatus": {"verified": "verified", "pending_anchor": "pending"}.get(
            ev_status.get(e.evidence_id, "verified"), "tampered"),
        "storagePath": f"stub://{case.case_id}/{e.evidence_id}"} for e in case.evidence]
    status = _status(request, case)
    pending = next((c for c in case.challenges if c.status == "pending_review"), None)
    return {
        "id": case.case_id, "anonymousToken": f"ZK-ANON-{case.nullifier[:4]}-{case.nullifier[-4:]}",
        "category": cat, "categoryLabel": p["category"], "severity": sev["level"],
        "severitySignals": sev.get("signals", []), "integrityFlags": list(case.integrity_flags), "status": status,
        "title": p["title"], "summary": p["description"], "submittedAt": case.created_at,
        "departmentScope": "Organisation-wide", "assignedInvestigatorId": case.investigator_id,
        "committeeMemberIds": [m["member_id"] for m in case.committee], "revokedMemberIds": list(case.revoked_ids),
        "activeChallengeId": pending.challenge_id if pending else None, "evidence": evidence,
        "blockchainSealTx": case.proof_tx, "zkpNullifierHash": case.nullifier,
        "witnessQuorumActive": status == "witness_quorum_active", "requiredNextAction": _next_action(status),
        "resolution": case.resolution, "hasSubjectRef": case.subject_ref is not None}


def challenge_dto(case: Case, ch: ChallengeRec) -> dict:
    member = STAFF.get(ch.member_id, {"name": ch.member_id, "title": ""})
    return {
        "id": ch.challenge_id, "complaintId": case.case_id, "complaintTitle": case.payload["title"],
        "poolId": _POOL[_category(case)], "challengedMemberId": ch.member_id,
        "challengedMemberName": member["name"], "challengedMemberRole": member["title"],
        "conflictCategory": _CONFLICT.get(ch.reason, "departmental_bias"), "conflictDetails": ch.explanation,
        "submittedAt": ch.at, "status": _CHALLENGE_STATUS[ch.status], "independentReviewerId": ch.reviewer_id,
        "decisionRationale": ch.rationale, "decidedAt": ch.decided_at, "blockchainVerificationTx": ch.proof_tx}


def _audit_details(event_type: str, data: dict) -> tuple[str, str]:
    name = lambda i: STAFF.get(i, {}).get("name", i)  # noqa: E731
    return {
        "complaint_submitted": ("Employee (ZK proof verified)", "Anonymous report sealed; Semaphore proof validated "
                                "on-chain."),
        "case_classified": ("Classification engine", f"Classified as {data.get('category')}."),
        "committee_assigned": ("Case assignment", "Committee assigned: "
                               + ", ".join(name(i) for i in data.get("member_ids", [])) + "."),
        "status_changed": ("Workflow", f"Status changed from {data.get('from')} to {data.get('to')}."),
        "challenge_filed": ("Employee (ZK proof verified)", f"Committee challenge filed against "
                            f"{name(data.get('member_id'))}."),
        "challenge_decided": (name(data.get("reviewer_id")), f"Challenge {data.get('challenge_id')} "
                              f"{data.get('decision')}."),
        "member_replaced": ("Access control", f"{name(data.get('old_member_id'))} replaced by "
                            f"{name(data.get('new_member_id'))}."),
        "access_revoked": ("Access control", f"Case access revoked or denied for {name(data.get('member_id'))}."),
        "inbox_message": ("Secure inbox", f"Message {data.get('direction')} sealed."),
        "evidence_sealed": ("Evidence vault", f"Evidence {data.get('evidence_id')} sealed "
                            f"({data.get('size')} bytes)."),
        "witness_quorum_started": ("Investigator", "Witness quorum opened."),
        "severity_assessed": ("Severity engine", f"Triage level {data.get('level')} (human review required)."),
        "resolution_recorded": ("Investigation team", "Resolution and reform actions recorded."),
        "reflection_recorded": ("Employee (anonymous)", "Reflect & Reform feedback received."),
        "export_generated": ("Legal export", f"Evidence package {data.get('export_id')} generated."),
        "witness_response_recorded": ("Witness (anonymous)", f"Responses: {data.get('accepted_count')} accepted, "
                                      f"{data.get('declined_count')} declined."),
    }.get(event_type, ("System", event_type.replace("_", " ")))


def audit_dtos(request: Request, case: Case) -> list[dict]:
    chain = _chain(request)
    stored = {e.seq: e for e in chain.verifier.events(case.case_id)}
    receipts = {r.seq: r for r in chain.verifier.receipts(case.case_id)}
    out = []
    for e in chain.verifier.verify(case.case_id).events:
        r = receipts.get(e.seq)
        actor, details = _audit_details(e.event_type, stored[e.seq].payload.get("data", {}))
        out.append({
            "id": f"{case.case_id}-{e.seq}", "complaintId": case.case_id,
            "eventType": _AUDIT_TYPE.get(e.event_type, e.event_type), "timestamp": e.at, "actorRef": actor,
            "details": details, "sha256Proof": r.commitment.removeprefix("0x") if r else "",
            "merkleRoot": r.entry_hash if r else "", "blockNumber": (r.anchor_block or 0) if r else 0,
            "txHash": (r.anchor_tx or "") if r else "", "verificationStatus": _VERIFY[e.status]})
    return out


class ResolveIn(BaseModel):
    outcome: Literal["substantiated", "partially_substantiated", "not_substantiated", "resolved_informally"]
    summary: str = Field(min_length=15, max_length=5000)  # HR-only; encrypted at rest; reporter sees outcome + actions
    actions: list[str] = Field(default_factory=list, max_length=10)


REFLECTION_MIN_K = 3  # Reflect & Reform insights stay hidden until at least this many reporters responded


def _case_text(case: Case) -> str:
    return f"{case.payload['title']} {case.payload['description']}"


class DecideIn(BaseModel):
    decision: Literal["approve", "reject"]
    rationale: str = Field(min_length=15, max_length=5000)
    replacement_member_id: str = DEFAULT_REPLACEMENT


class HrMessageIn(BaseModel):
    text: str = Field(min_length=1, max_length=5000)


class WitnessInviteIn(BaseModel):
    alias: str = Field(default="", max_length=80)
    context: str = Field(default="You are invited to voluntarily assist with an authorized workplace investigation.",
                         max_length=2000)


class CommitteeAssignIn(BaseModel):
    member_ids: list[str] = Field(min_length=1, max_length=5)


def build_hr_router() -> APIRouter:
    r = APIRouter(prefix="/hr", tags=["hr"])

    @r.get("/me")
    def me(user: Staff = Depends(staff)):
        return user

    @r.get("/cases")
    def cases(request: Request, user: Staff = Depends(staff)):
        visible = [c for c in _store(request).cases.values() if can_access(user, c)]
        return [complaint_dto(request, c) for c in sorted(visible, key=lambda c: c.created_at, reverse=True)]

    @r.get("/cases/{case_id}")
    def case(request: Request, case_id: str, user: Staff = Depends(staff)):
        c = _case_for(request, user, case_id)
        return complaint_dto(request, c, _chain(request).verifier.verify(case_id))

    @r.post("/cases/{case_id}/committee")
    def assign_committee(request: Request, case_id: str, body: CommitteeAssignIn, user: Staff = Depends(staff)):
        if user.role not in ("hr_reviewer", "administrator"):
            raise _forbidden("403: Forbidden - Only HR Reviewers or Administrators can assign committee members.")
        c = _case_for(request, user, case_id)
        if c.status in ("resolved", "closed"):
            raise HTTPException(409, {"reason": "case_closed", "message": f"Case {case_id} is closed; its committee can no longer change."})
        pending = [ch for ch in c.challenges if ch.status == "pending_review"]
        if pending:
            raise HTTPException(409, {"reason": "challenge_pending", "message": "A committee challenge is pending review. The committee cannot change until it is decided."})
        if len(set(body.member_ids)) != len(body.member_ids):
            raise HTTPException(422, {"reason": "duplicate_committee_members", "message": "All committee members must be distinct individuals."})
        if any(STAFF.get(mid, {}).get("role") != "committee_member" for mid in body.member_ids):
            raise HTTPException(422, {"reason": "unknown_committee_member", "message": "One or more committee members are not valid staff members."})
        if any(mid in c.revoked_ids for mid in body.member_ids):
            raise HTTPException(403, {"reason": "revoked_member_ineligible", "message": "A recused or revoked member cannot be assigned to this committee."})
        store = _store(request)
        with store.lock, persist.write(request, c):
            c.committee = [committee_entry(mid) for mid in body.member_ids]
            if c.status == "submitted":
                c.status = "committee_assigned"
            _chain(request).audit.record(c.case_id, "committee_assigned", {"member_ids": body.member_ids})
            store.save()
        return complaint_dto(request, c)

    @r.get("/cases/{case_id}/messages")
    def messages(request: Request, case_id: str, user: Staff = Depends(staff)):
        c = _case_for(request, user, case_id)
        inv = STAFF[c.investigator_id]["name"]
        return [{"id": m.message_id, "text": m.text, "timestamp": m.at, "isEncrypted": True,
                 "sender": "Anonymous Reporter" if m.sender == "you" else f"Investigation team ({inv})"}
                for m in c.messages]

    @r.post("/cases/{case_id}/messages", status_code=201)
    def send(request: Request, case_id: str, body: HrMessageIn, user: Staff = Depends(staff)):
        c = _case_for(request, user, case_id)
        if user.role not in ("assigned_investigator", "hr_reviewer", "administrator"):
            raise _forbidden("403: Forbidden - Only the investigation team can message the reporter.")
        store = _store(request)
        with store.lock, persist.write(request, c) as w:
            m = add_message(request, c, "investigator", body.text)
            if store.supabase:
                w.add(lambda: store.supabase.insert_message(c.case_id, m))
            store.save()
        return {"id": m.message_id, "sender": f"{user.name} ({user.title})", "text": m.text, "timestamp": m.at,
                "isEncrypted": True}

    @r.get("/challenges")
    def challenges(request: Request, pool_id: str | None = None, user: Staff = Depends(staff)):
        out = []
        for c in _store(request).cases.values():
            if not can_access(user, c):
                continue
            for ch in c.challenges:
                dto = challenge_dto(c, ch)
                if ch.member_id != user.id and (pool_id is None or dto["poolId"] == pool_id):
                    out.append(dto)
        return sorted(out, key=lambda d: d["submittedAt"], reverse=True)

    def _find_challenge(request: Request, challenge_id: str) -> tuple[Case, ChallengeRec]:
        for c in _store(request).cases.values():
            for ch in c.challenges:
                if ch.challenge_id == challenge_id:
                    return c, ch
        raise HTTPException(404, {"reason": "challenge_not_found"})

    @r.get("/challenges/{challenge_id}")
    def challenge(request: Request, challenge_id: str, user: Staff = Depends(staff)):
        c, ch = _find_challenge(request, challenge_id)
        if ch.member_id == user.id:
            raise _forbidden("403: Forbidden - Confidentiality Protection: Challenged committee members cannot "
                             "view the particulars of a challenge filed against their appointment.")
        _case_for(request, user, c.case_id)
        return challenge_dto(c, ch)

    @r.post("/challenges/{challenge_id}/decide")
    def decide(request: Request, challenge_id: str, body: DecideIn, user: Staff = Depends(staff)):
        if user.role not in ("independent_reviewer", "administrator"):
            raise _forbidden("403: Forbidden - Only an authorized Independent Reviewer may adjudicate committee "
                             f"challenges. Current user role: {user.role}")
        c, ch = _find_challenge(request, challenge_id)
        store = _store(request)
        with store.lock, persist.write(request, c) as w:
            replaced = decide_challenge(request, c, ch, "upheld" if body.decision == "approve" else "rejected",
                                        user.id, body.rationale, body.replacement_member_id)
            # Filing a challenge put the case under challenge; once decided (and none other pending) it moves on.
            if c.status in ("committee_assigned", "under_challenge") and not any(
                    x.status == "pending_review" for x in c.challenges):
                _chain(request).audit.record(c.case_id, "status_changed", {"from": c.status, "to": "investigating"})
                c.status = "investigating"
            if store.supabase:
                w.add(lambda: store.supabase.save_challenge(c.case_id, ch, replaced))
            store.save()
        return {"challenge": challenge_dto(c, ch), "updatedComplaint": complaint_dto(request, c)}

    def _witness_dtos(request: Request, user: Staff, c: Case) -> list[dict]:
        full = user.role in ("assigned_investigator", "administrator")
        out = []
        for i in _store(request).invitations.values():
            if i.case_id != c.case_id:
                continue
            status = {"accept": "accepted", "decline": "declined"}.get(i.response or "", "pending")
            out.append({"id": i.invitation_id, "complaintId": c.case_id, "invitedAt": i.invited_at,
                        "anonymousAlias": i.alias if full else "Witness (Identity Masked for Investigator Privilege)",
                        "status": status if full else "pending", "respondedAt": i.responded_at if full else None,
                        "statementProvided": False})
        return out

    @r.get("/cases/{case_id}/witnesses")
    def witnesses(request: Request, case_id: str, user: Staff = Depends(staff)):
        return _witness_dtos(request, user, _case_for(request, user, case_id))

    @r.get("/cases/{case_id}/witness-summary")
    def witness_summary(request: Request, case_id: str, user: Staff = Depends(staff)):
        c = _case_for(request, user, case_id)
        invs = [i for i in _store(request).invitations.values() if i.case_id == c.case_id]
        accepted = sum(i.response == "accept" for i in invs)
        declined = sum(i.response == "decline" for i in invs)
        return {"complaintId": case_id, "totalInvited": len(invs), "accepted": accepted, "declined": declined,
                "pending": len(invs) - accepted - declined, "statementsSubmitted": 0, "quorumMet": accepted >= 2}

    @r.post("/cases/{case_id}/witnesses", status_code=201)
    def invite(request: Request, case_id: str, body: WitnessInviteIn, user: Staff = Depends(staff)):
        c = _case_for(request, user, case_id)
        if user.role not in ("assigned_investigator", "administrator"):
            raise _forbidden("403: Forbidden - Only the assigned investigator can issue Witness Quorum invitations.")
        store = _store(request)
        with store.lock, persist.write(request, c) as w:
            n = sum(i.case_id == case_id for i in store.invitations.values())
            inv, code = create_invitation(request, c, body.context, body.alias or f"Witness {chr(65 + n)}")
            if store.supabase:
                w.add(lambda: store.supabase.save_invitation(inv))
            store.save()
        dto = next(d for d in _witness_dtos(request, user, c) if d["id"] == inv.invitation_id)
        return {**dto, "witnessCode": code}

    @r.get("/audit")
    def audit(request: Request, case_id: str | None = None, user: Staff = Depends(staff)):
        if case_id:
            return audit_dtos(request, _case_for(request, user, case_id))
        out = []
        for c in _store(request).cases.values():
            if can_access(user, c):
                out.extend(audit_dtos(request, c))
        return sorted(out, key=lambda d: d["timestamp"], reverse=True)

    @r.get("/cases/{case_id}/evidence/{evidence_id}/verify")
    def verify_evidence(request: Request, case_id: str, evidence_id: str, user: Staff = Depends(staff)):
        c = _case_for(request, user, case_id)
        ev = next((e for e in c.evidence if e.evidence_id == evidence_id), None)
        if ev is None:
            raise HTTPException(404, {"reason": "evidence_not_found"})
        verification = _chain(request).verifier.verify(case_id)
        status = _evidence_status(request, c, verification).get(evidence_id, "missing")
        content = _store(request).evidence_bytes(case_id, {"evidence_id": evidence_id})
        sha_ok = content is not None and content_sha256(content).removeprefix("0x") == ev.sha256
        at = next((e.at for e in verification.events if e.event_type == "evidence_sealed"), None)
        return {"verified": status == "verified" and sha_ok, "sha256Matches": sha_ok,
                "zkpVerified": bool(c.nullifier), "anchorStatus": status, "blockTimestamp": at}

    @r.get("/cases/{case_id}/related")
    def related_cases(request: Request, case_id: str, user: Staff = Depends(staff)):
        """Incident Correlation + Repeat Allegation Intelligence for one case, over cases this user may access."""
        c = _case_for(request, user, case_id)
        others = [o for o in _store(request).cases.values() if o.case_id != case_id and can_access(user, o)]
        prior_refs = {o.subject_ref for o in others if o.subject_ref}
        repeat = intelligence.repeat(c.subject_ref, prior_refs)
        same_subject = [o.case_id for o in others if c.subject_ref and o.subject_ref == c.subject_ref]
        return {"case_id": case_id,
                "similar": intelligence.related(_case_text(c), [(o.case_id, _case_text(o)) for o in others]),
                "repeat": {**repeat, "case_ids": same_subject}}

    @r.get("/patterns")
    def patterns(request: Request, user: Staff = Depends(staff)):
        """Pattern Intelligence: repeat-subject clusters (structured reference) and correlated case pairs."""
        cases = [c for c in _store(request).cases.values() if can_access(user, c)]
        by_subject: dict[str, list[Case]] = {}
        for c in cases:
            if c.subject_ref:
                by_subject.setdefault(c.subject_ref, []).append(c)
        repeats = [{"subjectRef": "SUBJ-" + hashlib.sha256(ref.encode()).hexdigest()[:8],  # opaque even to HR UI
                    "caseIds": [c.case_id for c in group], "count": len(group),
                    "categories": sorted({c.payload["category"] for c in group}),
                    "basis": "structured_reference", "human_review_required": True}
                   for ref, group in by_subject.items() if len(group) >= 2]
        pairs = []
        for i, a in enumerate(cases):
            for m in intelligence.related(_case_text(a), [(b.case_id, _case_text(b)) for b in cases[i + 1:]]):
                pairs.append({"caseIds": [a.case_id, m["case_id"]], "score": m["score"], "method": m["method"]})
        return {"repeatSubjects": sorted(repeats, key=lambda d: -d["count"]),
                "correlatedPairs": sorted(pairs, key=lambda d: -d["score"]),
                "limitation": "Patterns are review cues, not findings. Reports remain separate cases."}

    @r.post("/cases/{case_id}/resolve")
    def resolve(request: Request, case_id: str, body: ResolveIn, user: Staff = Depends(staff)):
        c = _case_for(request, user, case_id)
        if user.role not in ("assigned_investigator", "hr_reviewer", "administrator"):
            raise _forbidden("403: Forbidden - Only the investigation team can record a resolution.")
        if any(ch.status == "pending_review" for ch in c.challenges):
            raise HTTPException(409, {"reason": "challenge_pending"})
        if c.resolution is not None:
            raise HTTPException(409, {"reason": "already_resolved"})
        store = _store(request)
        with store.lock, persist.write(request, c):
            rid = new_id("RES")
            c.resolution = {"resolution_id": rid, "outcome": body.outcome, "summary": body.summary,
                            "actions": body.actions, "by": user.id, "at": now()}
            digest = content_sha256(f"{body.outcome}\n{body.summary}\n{chr(10).join(body.actions)}".encode())
            _chain(request).audit.record(case_id, "resolution_recorded", {"resolution_id": rid, "content_sha256": digest})
            _chain(request).audit.record(case_id, "status_changed", {"from": c.status, "to": "resolved"})
            c.status = "resolved"
            store.save()
        return complaint_dto(request, c)

    @r.get("/insights")
    def insights(request: Request, user: Staff = Depends(staff)):
        """Reflect & Reform: aggregate reporter feedback. Suppressed below k responses so no rating is attributable."""
        if user.role not in SUPERVISORY:
            raise _forbidden("403: Forbidden - Reflect & Reform insights are for HR and oversight roles.")
        cases = list(_store(request).cases.values())
        refl = [c.reflection for c in cases if c.reflection]
        resolved = [c for c in cases if c.resolution]
        outcomes: dict[str, int] = {}
        actions: dict[str, int] = {}
        for c in resolved:
            outcomes[c.resolution["outcome"]] = outcomes.get(c.resolution["outcome"], 0) + 1
            for a in c.resolution["actions"]:
                actions[a] = actions.get(a, 0) + 1
        base = {"resolvedCases": len(resolved), "outcomes": outcomes,
                "reformActions": sorted(({"action": a, "count": n} for a, n in actions.items()),
                                        key=lambda d: -d["count"]),
                "minimumResponses": REFLECTION_MIN_K}
        if len(refl) < REFLECTION_MIN_K:
            return {**base, "suppressed": True, "responses": None}
        n = len(refl)
        return {**base, "suppressed": False, "responses": n,
                "averageFairness": round(sum(r["fairness"] for r in refl) / n, 2),
                "feltSafePct": round(100 * sum(r["felt_safe"] for r in refl) / n),
                "wouldReportAgainPct": round(100 * sum(r["would_report_again"] for r in refl) / n)}

    @r.get("/cases/{case_id}/export.pdf")
    def export_pdf(request: Request, case_id: str, user: Staff = Depends(staff)):
        """Legal Evidence Package (M3's PDF generator): case record, challenge history, evidence manifest with hashes,
        and the Silent Audit trail with Polygon anchors, so a third party can re-verify it. The export is audited."""
        c = _case_for(request, user, case_id)
        if user.role not in ("assigned_investigator", "hr_reviewer", "independent_reviewer", "administrator"):
            raise _forbidden("403: Forbidden - Exports are limited to the investigation team and oversight.")
        chain = _chain(request)
        verification = chain.verifier.verify(case_id)
        receipts = chain.verifier.receipts(case_id)
        p = c.payload
        name = lambda i: STAFF.get(i, {}).get("name", i)  # noqa: E731
        sections = [
            ("Case", f"Reference: {c.case_id}\nCategory: {p['category']}\nSeverity (triage): "
                     f"{(c.severity or {}).get('level', 'n/a')}\nStatus: {c.status}\nSubmitted: {c.created_at}\n"
                     f"Reporter: anonymous (Semaphore proof, nullifier {c.nullifier[:16]}...)\n"
                     f"Proof transaction: {c.proof_tx}"),
            ("Report", f"Title: {p['title']}\nIncident date: {p.get('incident_date') or 'not given'}\n\n"
                       f"{p['description']}"),
            ("Committee", "\n".join(f"{m['name']} ({m['role']})" for m in c.committee)
                          + ("\nRemoved after challenge: " + ", ".join(name(i) for i in c.revoked_ids)
                             if c.revoked_ids else "")),
            ("Committee challenges", "\n".join(
                f"{ch.challenge_id}: {name(ch.member_id)}, {ch.reason}, {ch.status}"
                + (f" by {name(ch.reviewer_id)} on {ch.decided_at}: {ch.rationale}" if ch.decided_at else "")
                for ch in c.challenges) or "None"),
            ("Resolution", (f"Outcome: {c.resolution['outcome']}\n{c.resolution['summary']}\nActions: "
                            + "; ".join(c.resolution["actions"])) if c.resolution else "Open"),
            ("Silent Audit verification", f"Overall: {'VERIFIED' if verification.ok else 'FAILED'}"
                                          f" (first bad event: {verification.first_bad_seq})\n" + "\n".join(
                f"#{r.seq} {r.event_type} {r.at} entry {r.entry_hash[:18]}... anchor tx "
                f"{(r.anchor_tx or 'pending')[:20]}" for r in receipts)),
        ]
        manifest = [{"evidence_id": e.evidence_id, "name": e.name, "mime": e.mime, "bytes": e.size,
                     "sha256": e.sha256} for e in c.evidence]
        pdf = investigation_pdf(f"INCOGNITO Legal Evidence Package - {c.case_id}", sections, manifest)
        store = _store(request)
        with store.lock:
            export_id = new_id("EXP")
            chain.audit.record(case_id, "export_generated", {"export_id": export_id,
                                                              "content_sha256": content_sha256(pdf)})
            store.save()
        return Response(pdf, media_type="application/pdf", headers={
            "Content-Disposition": f'attachment; filename="{c.case_id}-evidence-package.pdf"',
            "X-Export-Id": export_id, "X-Content-SHA256": content_sha256(pdf)})

    @r.get("/committee-pool")
    def pool(request: Request, pool_id: str | None = None, user: Staff = Depends(staff)):
        cases_ = list(_store(request).cases.values())
        out = []
        for sid, s in STAFF.items():
            if s["role"] != "committee_member":
                continue
            assigned = [c.case_id for c in cases_ if sid in {m["member_id"] for m in c.committee}]
            revoked = [c.case_id for c in cases_ if sid in c.revoked_ids]
            out.append({"id": sid, "name": s["name"], "email": f"{sid.removeprefix('usr_')}@incognito.org",
                        "roleTitle": s["title"], "department": s["department"], "poolId": pool_id or "workplace_conduct",
                        "currentWorkload": len(assigned), "conflictRiskLevel": "high" if revoked else "none",
                        "isEligible": not revoked, "assignedCaseIds": assigned,
                        "assignmentStatus": "recused_conflict" if revoked else
                        ("active_assigned" if assigned else "available")})
        return out

    return r
