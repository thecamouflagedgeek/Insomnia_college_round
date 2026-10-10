import base64, os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

def _key(key: bytes) -> bytes:
    if len(key) != 32: raise ValueError("AES-256-GCM key must be exactly 32 bytes")
    return key

def encrypt(plaintext: bytes, key: bytes, associated_data: bytes = b"") -> str:
    nonce = os.urandom(12)
    ciphertext = AESGCM(_key(key)).encrypt(nonce, plaintext, associated_data)
    return base64.urlsafe_b64encode(nonce + ciphertext).decode("ascii")

def decrypt(token: str, key: bytes, associated_data: bytes = b"") -> bytes:
    try:
        raw = base64.urlsafe_b64decode(token.encode("ascii"))
        if len(raw) < 29: raise ValueError
        return AESGCM(_key(key)).decrypt(raw[:12], raw[12:], associated_data)
    except Exception as exc:
        raise ValueError("Invalid ciphertext or authentication tag") from exc
