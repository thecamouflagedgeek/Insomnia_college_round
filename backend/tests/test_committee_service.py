"""Tests for committee service."""
import pytest
from unittest.mock import patch
from app.services.committee_service import (
    create_challenge,
    decide_challenge,
    get_challenge,
    list_committee_memberships,
)
from app.core.config import Settings, get_settings
from app.schemas.challenge import ChallengeCreate, ChallengeDecision
from app.core.database import Database


def test_create_challenge():
    """Test creating a challenge."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.committee_service.get_settings", return_value=settings):
            payload = ChallengeCreate(
                report_reference="INC-test123",
                reason="Conflict of interest",
                requested_action="recusal"
            )

            challenge = create_challenge(payload, "investigator-1")

            assert challenge.challenge_id
            assert challenge.report_reference == "INC-test123"
            assert challenge.reason == "Conflict of interest"
            assert challenge.requested_action == "recusal"
            assert challenge.status == "pending"
            assert challenge.created_at > 0


def test_decide_challenge():
    """Test deciding a challenge."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.committee_service.get_settings", return_value=settings):
            # Create challenge
            payload = ChallengeCreate(
                report_reference="INC-test123",
                reason="Conflict of interest",
                requested_action="recusal"
            )
            challenge = create_challenge(payload, "investigator-1")

            # Decide challenge
            decision = ChallengeDecision(decision="accepted", rationale="Valid conflict")
            decided = decide_challenge(challenge.challenge_id, decision, "admin-1")

            assert decided.challenge_id == challenge.challenge_id
            assert decided.decision == "accepted"
            assert decided.rationale == "Valid conflict"
            assert decided.decided_by == "admin-1"
            assert decided.decided_at > 0


def test_decide_nonexistent_challenge_fails():
    """Test deciding non-existent challenge fails."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.committee_service.get_settings", return_value=settings):
            decision = ChallengeDecision(decision="accepted", rationale="Test rationale")

            with pytest.raises(ValueError) as exc:
                decide_challenge("nonexistent-id", decision, "admin-1")
            assert "Challenge not found" in str(exc.value)


def test_get_challenge():
    """Test retrieving a challenge."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.committee_service.get_settings", return_value=settings):
            payload = ChallengeCreate(
                report_reference="INC-test123",
                reason="Conflict of interest",
                requested_action="recusal"
            )
            challenge = create_challenge(payload, "investigator-1")

            retrieved = get_challenge(challenge.challenge_id)

            assert retrieved is not None
            assert retrieved.challenge_id == challenge.challenge_id
            assert retrieved.report_reference == "INC-test123"


def test_get_nonexistent_challenge():
    """Test retrieving non-existent challenge returns None."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.committee_service.get_settings", return_value=settings):
            retrieved = get_challenge("nonexistent-id")
            assert retrieved is None


def test_list_committee_memberships():
    """Test listing committee memberships."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        with patch("app.services.committee_service.get_settings", return_value=settings):
            memberships = list_committee_memberships("investigator-1")
            # Empty in test adapter by default
            assert memberships == []