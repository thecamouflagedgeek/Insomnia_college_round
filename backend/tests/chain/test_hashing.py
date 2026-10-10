import pytest

from app.chain.hashing import (
    ZERO_HASH, NonCanonicalValue, canonical_bytes, case_key, commitment,
    content_sha256, entry_hash, from_hex, new_salt,
)


def test_canonical_bytes_sorts_keys_and_is_compact():
    assert canonical_bytes({"b": 1, "a": [True, None, "x"]}) == b'{"a":[true,null,"x"],"b":1}'


def test_canonical_bytes_independent_of_insertion_order():
    assert canonical_bytes({"x": 1, "y": {"q": 2, "p": 3}}) == canonical_bytes({"y": {"p": 3, "q": 2}, "x": 1})


def test_canonical_bytes_keeps_unicode_as_utf8():
    assert canonical_bytes({"t": "é"}) == '{"t":"é"}'.encode("utf-8")


@pytest.mark.parametrize("bad", [{"f": 1.5}, {"s": {1, 2}}, {1: "non-str key"}, [b"bytes"]])
def test_canonical_bytes_rejects_non_canonical_values(bad):
    with pytest.raises(NonCanonicalValue):
        canonical_bytes(bad)


def test_salt_is_32_random_bytes():
    a, b = new_salt(), new_salt()
    assert len(from_hex(a)) == 32 and a != b


def test_commitment_depends_on_salt_and_content():
    env = {"type": "complaint_submitted", "data": {"k": "v"}, "at": "2026-10-10T10:00:00+00:00"}
    s = new_salt()
    assert commitment(s, env) == commitment(s, dict(env))
    assert commitment(s, env) != commitment(new_salt(), env)
    assert commitment(s, env) != commitment(s, {**env, "data": {"k": "w"}})
    assert len(from_hex(commitment(s, env))) == 32


def test_case_key_is_deterministic_and_distinct():
    assert case_key("INC-104") == case_key("INC-104")
    assert case_key("INC-104") != case_key("INC-105")


def test_entry_hash_binds_every_input():
    k, c = case_key("INC-1"), commitment(new_salt(), {"a": 1})
    base = entry_hash(k, ZERO_HASH, 1, c)
    assert base != entry_hash(case_key("INC-2"), ZERO_HASH, 1, c)
    assert base != entry_hash(k, "0x" + "11" * 32, 1, c)
    assert base != entry_hash(k, ZERO_HASH, 2, c)
    assert base != entry_hash(k, ZERO_HASH, 1, commitment(new_salt(), {"a": 1}))


def test_content_sha256_hex():
    assert content_sha256(b"abc") == "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"
