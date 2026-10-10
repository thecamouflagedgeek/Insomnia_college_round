"""Hashing primitives for the Silent Audit. Everything here is deterministic except new_salt."""
import hashlib
import json
import secrets
from typing import Any

from eth_utils import keccak

ZERO_HASH = "0x" + "00" * 32


class NonCanonicalValue(TypeError):
    pass


def _check(value: Any, path: str = "$") -> None:
    if value is None or isinstance(value, (str, bool, int)):
        return
    if isinstance(value, float):
        raise NonCanonicalValue(f"float at {path}; store numbers as int or str")
    if isinstance(value, list):
        for i, item in enumerate(value):
            _check(item, f"{path}[{i}]")
        return
    if isinstance(value, dict):
        for key, item in value.items():
            if not isinstance(key, str):
                raise NonCanonicalValue(f"non-string key {key!r} at {path}")
            _check(item, f"{path}.{key}")
        return
    raise NonCanonicalValue(f"unsupported {type(value).__name__} at {path}")


def canonical_bytes(value: Any) -> bytes:
    _check(value)
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def to_hex(data: bytes) -> str:
    return "0x" + data.hex()


def from_hex(value: str) -> bytes:
    return bytes.fromhex(value.removeprefix("0x"))


def new_salt() -> str:
    return to_hex(secrets.token_bytes(32))


def case_key(case_id: str) -> str:
    return to_hex(keccak(b"incognito:case:" + case_id.encode("utf-8")))


def commitment(salt: str, envelope: dict) -> str:
    return to_hex(keccak(from_hex(salt) + canonical_bytes(envelope)))


def entry_hash(case_key_hex: str, prev_hex: str, seq: int, commitment_hex: str) -> str:
    return to_hex(keccak(
        from_hex(case_key_hex) + from_hex(prev_hex) + seq.to_bytes(8, "big") + from_hex(commitment_hex)
    ))


def content_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()
