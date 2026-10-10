import pytest
import base64
import os
from app.utils.encryption import (
    encrypt, decrypt, get_encryption_key, EncryptionError, _decode_key, _validate_key_bytes
)
from app.core.config import Settings, get_settings
from unittest.mock import patch


def test_validate_key_bytes_accepts_32_bytes():
    key = os.urandom(32)
    assert _validate_key_bytes(key) == key


def test_validate_key_bytes_rejects_wrong_length():
    for length in [16, 24, 31, 33, 48, 64]:
        key = os.urandom(length)
        with pytest.raises(EncryptionError) as exc:
            _validate_key_bytes(key)
        assert "32 bytes" in str(exc.value)


def test_decode_key_accepts_valid_urlsafe_b64():
    key = os.urandom(32)
    key_b64 = base64.urlsafe_b64encode(key).decode("ascii")
    assert _decode_key(key_b64) == key


def test_decode_key_rejects_invalid_base64():
    with pytest.raises(EncryptionError) as exc:
        _decode_key("not valid base64!")
    assert "URL-safe Base64" in str(exc.value)


def test_decode_key_rejects_wrong_length_after_decode():
    key_16 = base64.urlsafe_b64encode(os.urandom(16)).decode("ascii")
    with pytest.raises(EncryptionError) as exc:
        _decode_key(key_16)
    assert "32 bytes" in str(exc.value)

    key_64 = base64.urlsafe_b64encode(os.urandom(64)).decode("ascii")
    with pytest.raises(EncryptionError) as exc:
        _decode_key(key_64)
    assert "32 bytes" in str(exc.value)


def test_encrypt_decrypt_round_trip():
    key = os.urandom(32)
    plaintext = b"Sensitive report narrative with witness contact details"
    associated_data = b"report-123"
    token = encrypt(plaintext, key, associated_data)
    decrypted = decrypt(token, key, associated_data)
    assert decrypted == plaintext


def test_encrypt_decrypt_without_associated_data():
    key = os.urandom(32)
    plaintext = b"Message body only"
    token = encrypt(plaintext, key)
    decrypted = decrypt(token, key)
    assert decrypted == plaintext


def test_encrypt_produces_different_ciphertext_each_time():
    key = os.urandom(32)
    plaintext = b"Same plaintext"
    token1 = encrypt(plaintext, key)
    token2 = encrypt(plaintext, key)
    assert token1 != token2
    assert decrypt(token1, key) == plaintext
    assert decrypt(token2, key) == plaintext


def test_decrypt_fails_with_wrong_key():
    key1 = os.urandom(32)
    key2 = os.urandom(32)
    plaintext = b"Test data"
    token = encrypt(plaintext, key1)
    with pytest.raises(EncryptionError) as exc:
        decrypt(token, key2)
    assert "Invalid ciphertext or authentication tag" in str(exc.value)


def test_decrypt_fails_with_wrong_associated_data():
    key = os.urandom(32)
    plaintext = b"Test data"
    token = encrypt(plaintext, key, b"correct-aad")
    with pytest.raises(EncryptionError) as exc:
        decrypt(token, key, b"wrong-aad")
    assert "Invalid ciphertext or authentication tag" in str(exc.value)


def test_decrypt_fails_with_tampered_ciphertext():
    key = os.urandom(32)
    plaintext = b"Test data"
    token = encrypt(plaintext, key)
    raw = base64.urlsafe_b64decode(token.encode("ascii"))
    tampered = bytearray(raw)
    tampered[15] ^= 0xFF
    tampered_token = base64.urlsafe_b64encode(tampered).decode("ascii")
    with pytest.raises(EncryptionError) as exc:
        decrypt(tampered_token, key)
    assert "Invalid ciphertext or authentication tag" in str(exc.value)


def test_decrypt_fails_with_truncated_token():
    key = os.urandom(32)
    plaintext = b"Test data"
    token = encrypt(plaintext, key)
    raw = base64.urlsafe_b64decode(token.encode("ascii"))
    truncated = raw[:10]
    truncated_token = base64.urlsafe_b64encode(truncated).decode("ascii")
    with pytest.raises(EncryptionError) as exc:
        decrypt(truncated_token, key)
    assert "Invalid ciphertext or authentication tag" in str(exc.value)


def test_decrypt_fails_with_corrupted_nonce():
    key = os.urandom(32)
    plaintext = b"Test data"
    token = encrypt(plaintext, key)
    raw = base64.urlsafe_b64decode(token.encode("ascii"))
    corrupted = bytearray(raw)
    for i in range(12):
        corrupted[i] ^= 0x01
    corrupted_token = base64.urlsafe_b64encode(corrupted).decode("ascii")
    with pytest.raises(EncryptionError) as exc:
        decrypt(corrupted_token, key)
    assert "Invalid ciphertext or authentication tag" in str(exc.value)


def _clear_settings_cache():
    get_settings.cache_clear()


def test_get_encryption_key_missing_raises():
    _clear_settings_cache()
    settings = Settings(_env_file=None, encryption_key=None)
    with patch("app.utils.encryption.get_settings", return_value=settings):
        with pytest.raises(EncryptionError) as exc:
            get_encryption_key()
        assert "not configured" in str(exc.value)


def test_get_encryption_key_placeholder_raises():
    _clear_settings_cache()
    settings = Settings(_env_file=None, encryption_key="replace_with_32_byte_urlsafe_base64_key")
    with patch("app.utils.encryption.get_settings", return_value=settings):
        with pytest.raises(EncryptionError) as exc:
            get_encryption_key()
        assert "placeholder" in str(exc.value)


def test_get_encryption_key_malformed_b64_raises():
    _clear_settings_cache()
    # Use a string that will fail base64 decoding (contains invalid chars that aren't ignored)
    settings = Settings(_env_file=None, encryption_key="!!!invalid!!!")
    with patch("app.utils.encryption.get_settings", return_value=settings):
        with pytest.raises(EncryptionError) as exc:
            get_encryption_key()
        assert "URL-safe Base64" in str(exc.value)


def test_get_encryption_key_wrong_length_raises():
    _clear_settings_cache()
    key_16 = base64.urlsafe_b64encode(os.urandom(16)).decode("ascii")
    settings = Settings(_env_file=None, encryption_key=key_16)
    with patch("app.utils.encryption.get_settings", return_value=settings):
        with pytest.raises(EncryptionError) as exc:
            get_encryption_key()
        assert "32 bytes" in str(exc.value)


def test_get_encryption_key_success():
    _clear_settings_cache()
    key = os.urandom(32)
    key_b64 = base64.urlsafe_b64encode(key).decode("ascii")
    settings = Settings(_env_file=None, encryption_key=key_b64)
    with patch("app.utils.encryption.get_settings", return_value=settings):
        assert get_encryption_key() == key


def test_settings_encryption_key_bytes_property():
    key = os.urandom(32)
    key_b64 = base64.urlsafe_b64encode(key).decode("ascii")
    settings = Settings(_env_file=None, encryption_key=key_b64)
    assert settings.encryption_key_bytes == key


def test_settings_encryption_key_bytes_missing_raises():
    settings = Settings(_env_file=None, encryption_key=None)
    with pytest.raises(ValueError) as exc:
        _ = settings.encryption_key_bytes
    assert "not configured" in str(exc.value)


def test_settings_encryption_key_bytes_placeholder_raises():
    settings = Settings(_env_file=None, encryption_key="replace_with_32_byte_urlsafe_base64_key")
    with pytest.raises(ValueError) as exc:
        _ = settings.encryption_key_bytes
    assert "placeholder" in str(exc.value)


def test_settings_encryption_key_bytes_malformed_raises():
    settings = Settings(_env_file=None, encryption_key="!!!invalid!!!")
    with pytest.raises(ValueError) as exc:
        _ = settings.encryption_key_bytes
    assert "URL-safe Base64" in str(exc.value)


def test_settings_encryption_key_bytes_wrong_length_raises():
    key_16 = base64.urlsafe_b64encode(os.urandom(16)).decode("ascii")
    settings = Settings(_env_file=None, encryption_key=key_16)
    with pytest.raises(ValueError) as exc:
        _ = settings.encryption_key_bytes
    assert "32 bytes" in str(exc.value)


def test_encrypt_raises_on_invalid_key_length():
    key_16 = os.urandom(16)
    with pytest.raises(EncryptionError) as exc:
        encrypt(b"data", key_16)
    assert "32 bytes" in str(exc.value)


def test_decrypt_raises_on_invalid_key_length():
    key_16 = os.urandom(16)
    with pytest.raises(EncryptionError) as exc:
        decrypt("token", key_16)
    assert "32 bytes" in str(exc.value)


def test_encryption_error_is_valueerror_subclass():
    assert issubclass(EncryptionError, ValueError)