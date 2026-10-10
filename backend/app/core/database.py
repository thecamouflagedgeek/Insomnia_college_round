"""Fail-closed Supabase adapter. No table writes occur until schema is verified."""
from dataclasses import dataclass
from typing import Any
from supabase import Client, create_client
from .config import Settings

class IntegrationUnavailable(RuntimeError):
    pass

@dataclass
class Database:
    client: Client | None = None
    schema_verified: bool = False

    @classmethod
    def from_settings(cls, settings: Settings) -> "Database":
        if settings.supabase_url and settings.supabase_secret_key:
            return cls(create_client(settings.supabase_url, settings.supabase_secret_key), False)
        return cls()

    def require_schema(self) -> Client:
        if not self.client:
            raise IntegrationUnavailable("Supabase service credentials are not configured")
        if not self.schema_verified:
            raise IntegrationUnavailable("Database schema is unverified; data operations are disabled")
        return self.client

    def health(self) -> dict[str, Any]:
        return {"configured": self.client is not None, "schema_verified": self.schema_verified,
                "writes_enabled": self.client is not None and self.schema_verified}
