from datetime import date

import pytest

from app.chain.signals import (
    SNARK_SCALAR_FIELD, bytes32_text, challenge_scope_text, complaint_scope_text,
    message_text, sdk_argument,
)


def test_bytes32_text_matches_ethers_encodeBytes32String():
    # ethers.encodeBytes32String("a") == 0x61 followed by 31 zero bytes
    assert bytes32_text("a") == 0x61 << 248


def test_bytes32_text_rejects_more_than_31_bytes():
    bytes32_text("x" * 31)
    with pytest.raises(ValueError):
        bytes32_text("x" * 32)


def test_message_text_is_short_prefixed_and_content_bound():
    m = message_text('{"description":"hello"}')
    assert m.startswith("m:") and len(m.encode()) == 30
    assert m != message_text('{"description":"hello!"}')


def test_scope_texts_fit_and_are_stable():
    assert complaint_scope_text(date(2026, 10, 10)) == "cmp:2026-10-10"
    s = challenge_scope_text("7b1c-uuid-case", "member-42")
    assert s.startswith("chl:") and len(s.encode()) == 30
    assert s == challenge_scope_text("7b1c-uuid-case", "member-42")
    assert s != challenge_scope_text("7b1c-uuid-case", "member-43")


def test_sdk_argument_modes():
    assert sdk_argument("cmp:2026-10-10", "text") == "cmp:2026-10-10"
    assert sdk_argument("cmp:2026-10-10", "numeric") == str(bytes32_text("cmp:2026-10-10"))
    with pytest.raises(ValueError):
        sdk_argument("x", "other")


def test_field_constant():
    assert SNARK_SCALAR_FIELD == 21888242871839275222246405745257275088548364400416034343698204186575808495617
