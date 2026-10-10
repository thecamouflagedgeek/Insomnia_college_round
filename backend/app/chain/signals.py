"""Semaphore message/scope encoding.

Every signal is a short text (<= 31 UTF-8 bytes). Its field value is the text right-padded to
32 bytes and read big-endian, which is what @semaphore-protocol/core does with non-numeric
strings (ethers encodeBytes32String). The Semaphore contract then hashes it (keccak >> 8).
"""
import hashlib
from datetime import date

SNARK_SCALAR_FIELD = 21888242871839275222246405745257275088548364400416034343698204186575808495617


def bytes32_text(text: str) -> int:
    raw = text.encode("utf-8")
    if len(raw) > 31:
        raise ValueError(f"signal text must be <= 31 bytes, got {len(raw)}")
    return int.from_bytes(raw.ljust(32, b"\x00"), "big")


def message_text(payload_text: str) -> str:
    return "m:" + hashlib.sha256(payload_text.encode("utf-8")).hexdigest()[:28]


def complaint_scope_text(day: date) -> str:
    return f"cmp:{day.isoformat()}"


def challenge_scope_text(case_id: str, member_id: str) -> str:
    return "chl:" + hashlib.sha256(f"{case_id}|{member_id}".encode("utf-8")).hexdigest()[:26]


def sdk_argument(text: str, mode: str) -> str:
    """The string the Flutter app passes to generateSemaphoreProof (mode fixed in the interop spike)."""
    if mode == "text":
        return text
    if mode == "numeric":
        return str(bytes32_text(text))
    raise ValueError(f"unknown signal mode {mode!r}")
