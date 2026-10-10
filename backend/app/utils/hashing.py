import hashlib, json
from typing import Any

def canonical_json(value: Any) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")

def sha256_hex(value: bytes) -> str:
    return hashlib.sha256(value).hexdigest()
