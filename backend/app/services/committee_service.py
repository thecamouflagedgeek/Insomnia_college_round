"""Committee challenge validation workflow."""
from __future__ import annotations

from uuid import uuid4
from dataclasses import dataclass
from typing import Literal
import json
from datetime import datetime, timezone

from app.core.database import Database, IntegrationUnavailable, TestRecord, require_report_id, run
from app.services.encryption_service import EncryptedField, get_encryption_service
from app.core.config import get_settings
from app.schemas.challenge import ChallengeCreate, ChallengeDecision
from app.models.committee import CommitteeMembership


@dataclass(frozen=True)
class CreatedChallenge:
    challenge_id: str
    report_reference: str
    reason: str
    requested_action: Literal["reassign", "recusal"]
    status: str
    created_at: int


@dataclass(frozen=True)
class DecidedChallenge:
    challenge_id: str
    decision: Literal["accepted", "rejected"]
    rationale: str
    decided_at: int
    decided_by: str


def create_challenge(payload: ChallengeCreate, submitter_subject: str) -> CreatedChallenge:
    """Create a committee challenge.

    Args:
        payload: Validated challenge data
        submitter_subject: Auth subject of the person submitting the challenge

    Returns:
        CreatedChallenge with challenge details
    """
    settings = get_settings()
    db = Database.from_settings(settings)

    challenge_id = str(uuid4())
    created_at = int(__import__("time").time())

    if db._test_mode:
        test_record = TestRecord(
            id=uuid4(),
            data={
                "challenge_id": challenge_id,
                "report_reference": payload.report_reference,
                "reason": payload.reason,
                "requested_action": payload.requested_action,
                "status": "pending",
                "submitter_subject": submitter_subject,
                "created_at": created_at,
            },
        )
        db.test_insert("challenges", test_record)
    else:
        if not payload.committee_member_ref:
            raise ValueError("committee_member_ref is required: name the challenged committee member")
        client = db.require_schema()
        enc = get_encryption_service().encrypt_field(
            json.dumps({"reason": payload.reason, "requested_action": payload.requested_action}),
            "challenge", challenge_id, "reason")
        run(client.table("committee_challenges").insert({
            "id": challenge_id,
            "report_id": require_report_id(client, payload.report_reference),
            "committee_member_ref": payload.committee_member_ref,
            "reason_ciphertext": enc.ciphertext,
            "status": "pending",
        }), "save challenge")

    return CreatedChallenge(
        challenge_id=challenge_id,
        report_reference=payload.report_reference,
        reason=payload.reason,
        requested_action=payload.requested_action,
        status="pending",
        created_at=created_at,
    )


def decide_challenge(challenge_id: str, payload: ChallengeDecision, decider_subject: str) -> DecidedChallenge:
    """Record a challenge decision (admin only)."""
    settings = get_settings()
    db = Database.from_settings(settings)
    decided_at = int(__import__("time").time())

    if db._test_mode:
        # Find and update challenge
        found = False
        for record in db.test_list("challenges"):
            if record.data.get("challenge_id") == challenge_id:
                record.data["status"] = payload.decision
                record.data["decision_rationale"] = payload.rationale
                record.data["decided_by"] = decider_subject
                record.data["decided_at"] = decided_at
                found = True
                break
        if not found:
            raise ValueError("Challenge not found")
    else:
        client = db.require_schema()
        note = get_encryption_service().encrypt_field(
            json.dumps({"rationale": payload.rationale, "decided_by": decider_subject}),
            "challenge", challenge_id, "decision")
        updated = run(client.table("committee_challenges").update({
            "status": payload.decision,  # accepted | rejected: both allowed values
            "decision_note_ciphertext": note.ciphertext,
            "decided_at": datetime.fromtimestamp(decided_at, timezone.utc).isoformat(),
        }).eq("id", challenge_id).eq("status", "pending"), "record challenge decision")
        if not updated:
            raise ValueError("Challenge not found or already decided")

    return DecidedChallenge(
        challenge_id=challenge_id,
        decision=payload.decision,
        rationale=payload.rationale,
        decided_at=decided_at,
        decided_by=decider_subject,
    )


def get_challenge(challenge_id: str, db: Database | None = None) -> CreatedChallenge | None:
    """Retrieve a challenge by ID."""
    if db is None:
        settings = get_settings()
        db = Database.from_settings(settings)

    if db._test_mode:
        for record in db.test_list("challenges"):
            if record.data.get("challenge_id") == challenge_id:
                data = record.data
                return CreatedChallenge(
                    challenge_id=data["challenge_id"],
                    report_reference=data["report_reference"],
                    reason=data["reason"],
                    requested_action=data["requested_action"],
                    status=data["status"],
                    created_at=data["created_at"],
                )
        return None
    else:
        client = db.require_schema()
        rows = run(client.table("committee_challenges").select("id,report_id,reason_ciphertext,status,created_at")
                   .eq("id", challenge_id), "read challenge")
        if not rows:
            return None
        row = rows[0]
        reason = json.loads(get_encryption_service().decrypt_field(
            EncryptedField(row["reason_ciphertext"], f"challenge:{challenge_id}:reason"), "challenge", challenge_id,
            "reason"))
        report = run(client.table("reports").select("public_reference").eq("id", row["report_id"]),
                     "read report reference")
        return CreatedChallenge(
            challenge_id=row["id"],
            report_reference=report[0]["public_reference"] if report else "",
            reason=reason["reason"],
            requested_action=reason["requested_action"],
            status=row["status"],
            created_at=int(datetime.fromisoformat(str(row["created_at"]).replace("Z", "+00:00")).timestamp()),
        )


def list_committee_memberships(subject: str, db: Database | None = None) -> list[CommitteeMembership]:
    """List committee memberships for a subject (for authorization)."""
    if db is None:
        settings = get_settings()
        db = Database.from_settings(settings)

    if db._test_mode:
        memberships = []
        for record in db.test_list("committee_memberships"):
            if record.data.get("subject") == subject and record.data.get("active"):
                memberships.append(CommitteeMembership(
                    subject=record.data["subject"],
                    committee_ref=record.data["committee_ref"],
                    active=record.data["active"],
                ))
        return memberships
    else:
        client = db.require_schema()
        raise IntegrationUnavailable("Production retrieval not yet implemented")