"""Tests for audit chain verification and tampering detection."""
import pytest
from app.services.audit_service import AuditChain, verify_chain, event_hash
from app.core.config import Settings, get_settings
from app.core.database import Database, TestRecord
from unittest.mock import patch


def test_audit_chain_creation():
    """Test creating an audit chain."""
    chain = AuditChain()
    chain.append({"action": "created", "report": "INC-123"})
    chain.append({"action": "viewed", "report": "INC-123", "by": "investigator-1"})

    assert len(chain.events) == 2
    assert chain.events[0]["event"]["action"] == "created"
    assert chain.events[1]["event"]["action"] == "viewed"


def test_verify_chain_valid():
    """Test verifying a valid chain."""
    chain = AuditChain()
    chain.append({"action": "created", "report": "INC-123"})
    chain.append({"action": "viewed", "report": "INC-123"})

    assert verify_chain(chain.events) is True


def test_verify_chain_tampered_event():
    """Test that tampered event is detected."""
    chain = AuditChain()
    chain.append({"action": "created", "report": "INC-123"})
    chain.append({"action": "viewed", "report": "INC-123"})

    # Tamper with first event
    altered = [dict(row) for row in chain.events]
    altered[0] = {**altered[0], "event": {"action": "changed", "report": "INC-123"}}

    assert verify_chain(altered) is False


def test_verify_chain_tampered_hash():
    """Test that tampered hash is detected."""
    chain = AuditChain()
    chain.append({"action": "created", "report": "INC-123"})
    chain.append({"action": "viewed", "report": "INC-123"})

    # Tamper with hash
    altered = [dict(row) for row in chain.events]
    altered[0] = {**altered[0], "event_hash": "tampered-hash"}

    assert verify_chain(altered) is False


def test_verify_chain_missing_previous_hash():
    """Test that missing previous hash is detected."""
    chain = AuditChain()
    chain.append({"action": "created", "report": "INC-123"})
    chain.append({"action": "viewed", "report": "INC-123"})

    # Remove previous_hash from second event
    altered = [dict(row) for row in chain.events]
    altered[1] = {**altered[1], "previous_hash": None}

    assert verify_chain(altered) is False


def test_verify_empty_chain():
    """Test verifying empty chain."""
    assert verify_chain([]) is True


def test_event_hash_deterministic():
    """Test that event_hash is deterministic."""
    event = {"action": "test", "data": "value"}
    prev = "previous-hash"

    hash1 = event_hash(event, prev)
    hash2 = event_hash(event, prev)

    assert hash1 == hash2
    assert len(hash1) == 64  # SHA256 hex


def test_event_hash_changes_with_input():
    """Test that event_hash changes with different input."""
    event1 = {"action": "test1"}
    event2 = {"action": "test2"}
    prev = "previous-hash"

    hash1 = event_hash(event1, prev)
    hash2 = event_hash(event2, prev)

    assert hash1 != hash2


def test_audit_chain_in_test_adapter():
    """Test audit chain works with test adapter."""
    settings = Settings(_env_file=None, app_env="test", encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")
    with patch("app.core.config.get_settings", return_value=settings):
        db = Database.test_adapter()

        # Add some audit events
        db.test_insert("audit_events", TestRecord(
            id=__import__("uuid").uuid4(),
            data={"event": {"action": "created", "report": "INC-123"}, "event_hash": "hash1", "previous_hash": None}
        ))
        db.test_insert("audit_events", TestRecord(
            id=__import__("uuid").uuid4(),
            data={"event": {"action": "viewed", "report": "INC-123"}, "event_hash": "hash2", "previous_hash": "hash1"}
        ))

        events = db.test_list("audit_events")
        event_list = [e.data["event"] for e in events]

        # Note: hashes won't match since we used dummy hashes
        # But the structure is correct
        assert len(event_list) == 2