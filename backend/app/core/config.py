from functools import lru_cache
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
import base64

class Settings(BaseSettings):
    app_name: str = "INCOGNITO API"
    app_env: str = "development"
    app_host: str = "127.0.0.1"
    app_port: int = 8000
    log_level: str = "INFO"
    cors_origins: str = "http://localhost:5173"
    supabase_url: str | None = None
    supabase_publishable_key: str | None = None
    supabase_secret_key: str | None = None
    supabase_jwt_secret: str | None = None
    supabase_storage_bucket: str = "incognito-evidence"
    encryption_key: str | None = None
    max_upload_bytes: int = 10 * 1024 * 1024
    witness_token_ttl_seconds: int = 604800
    auth_required_for_private_endpoints: bool = True
    model_name: str = "sentence-transformers/all-MiniLM-L6-v2"
    model_cache_dir: str = "models-cache"
    model_enabled: bool = False
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    @field_validator("app_env")
    @classmethod
    def valid_env(cls, value: str) -> str:
        if value not in {"development", "test", "production"}:
            raise ValueError("APP_ENV must be development, test, or production")
        return value

    @property
    def allowed_origins(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def encryption_key_bytes(self) -> bytes:
        if not self.encryption_key:
            raise ValueError("ENCRYPTION_KEY is not configured")
        if self.encryption_key == "replace_with_32_byte_urlsafe_base64_key":
            raise ValueError("ENCRYPTION_KEY is still the placeholder value")
        try:
            decoded = base64.urlsafe_b64decode(self.encryption_key)
        except Exception as exc:
            raise ValueError("ENCRYPTION_KEY must be valid URL-safe Base64") from exc
        if len(decoded) != 32:
            raise ValueError("ENCRYPTION_KEY must decode to exactly 32 bytes (256 bits)")
        return decoded

@lru_cache
def get_settings() -> Settings:
    return Settings()
