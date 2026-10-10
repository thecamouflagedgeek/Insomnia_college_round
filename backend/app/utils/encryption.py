import base64, os
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from app.core.config import get_settings

class EncryptionError(ValueError):
    pass

def _validate_key_bytes(key: bytes) -> bytes:
    if len(key) != 32:
        raise EncryptionError("AES-256-GCM key must be exactly 32 bytes")
    return key

def _decode_key(key_b64: str) -> bytes:
    try:
        decoded = base64.urlsafe_b64decode(key_b64)
    except Exception as exc:
        raise EncryptionError("ENCRYPTION_KEY must be valid URL-safe Base64") from exc
    return _validate_key_bytes(decoded)

def get_encryption_key() -> bytes:
    settings = get_settings()
    key_b64 = settings.encryption_key
    if not key_b64:
        raise EncryptionError("ENCRYPTION_KEY is not configured")
    if key_b64 == "replace_with_32_byte_urlsafe_base64_key":
        raise EncryptionError("ENCRYPTION_KEY is still the placeholder value")
    return _decode_key(key_b64)

def encrypt(plaintext: bytes, key: bytes, associated_data: bytes = b"") -> str:
    _validate_key_bytes(key)
    nonce = os.urandom(12)
    ciphertext = AESGCM(key).encrypt(nonce, plaintext, associated_data)
    return base64.urlsafe_b64encode(nonce + ciphertext).decode("ascii")

def decrypt(token: str, key: bytes, associated_data: bytes = b"") -> bytes:
    _validate_key_bytes(key)
    try:
        raw = base64.urlsafe_b64decode(token.encode("ascii"))
        if len(raw) < 29:
            raise ValueError
        return AESGCM(key).decrypt(raw[:12], raw[12:], associated_data)
    except Exception as exc:
        raise EncryptionError("Invalid ciphertext or authentication tag") from exc
