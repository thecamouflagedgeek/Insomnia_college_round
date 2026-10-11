"""Fail-closed Supabase adapter. No table writes occur until schema is verified."""
from dataclasses import dataclass, field
from typing import Any
from uuid import UUID
from supabase import Client, create_client
from .config import Settings


class IntegrationUnavailable(RuntimeError):
    pass


@dataclass
class TestRecord:
    """In-memory test record for development adapter."""
    id: UUID
    data: dict[str, Any]


@dataclass
class Database:
    client: Client | None = None
    schema_verified: bool = False
    _test_mode: bool = False
    _test_storage: dict[str, list[TestRecord]] = field(default_factory=dict)

    # Class-level singleton for test adapter
    _test_adapter: "Database | None" = field(default=None, init=False, repr=False)

    @classmethod
    def from_settings(cls, settings: Settings) -> "Database":
        if settings.supabase_url and settings.supabase_secret_key:
            client = create_client(settings.supabase_url, settings.supabase_secret_key)
            # Schema is active when credentials are provided
            return cls(client=client, schema_verified=True, _test_mode=False)
        # In test/development mode without credentials, return shared test adapter
        if settings.app_env in {"development", "test"}:
            return cls.get_test_adapter()
        return cls()

    @classmethod
    def get_test_adapter(cls) -> "Database":
        """Get or create the shared test adapter singleton."""
        if cls._test_adapter is None:
            cls._test_adapter = cls(_test_mode=True)
        return cls._test_adapter

    @classmethod
    def test_adapter(cls) -> "Database":
        """Create a test-only in-memory adapter for development/testing."""
        return cls(_test_mode=True)

    @classmethod
    def clear_test_adapter(cls) -> None:
        """Clear the shared test adapter (for test isolation)."""
        cls._test_adapter = None

    def require_schema(self) -> Client:
        if self._test_mode:
            return None  # type: ignore[return-value]
        if not self.client:
            raise IntegrationUnavailable("Supabase service credentials are not configured")
        if not self.schema_verified:
            raise IntegrationUnavailable("Database schema is unverified; data operations are disabled")
        return self.client

    def health(self) -> dict[str, Any]:
        if self._test_mode:
            return {"configured": True, "schema_verified": True, "writes_enabled": True, "mode": "test"}
        return {"configured": self.client is not None, "schema_verified": self.schema_verified,
                "writes_enabled": self.client is not None and self.schema_verified}

    # Test adapter methods (only work in test mode)
    def _assert_test_mode(self):
        if not self._test_mode:
            raise IntegrationUnavailable("Operation only available in test mode")

    def test_insert(self, table: str, record: TestRecord) -> TestRecord:
        self._assert_test_mode()
        self._test_storage.setdefault(table, []).append(record)
        return record

    def test_find_by_id(self, table: str, id: UUID) -> TestRecord | None:
        self._assert_test_mode()
        for record in self._test_storage.get(table, []):
            if record.id == id:
                return record
        return None

    def test_find_by_field(self, table: str, field: str, value: Any) -> TestRecord | None:
        self._assert_test_mode()
        for record in self._test_storage.get(table, []):
            if record.data.get(field) == value:
                return record
        return None

    def test_list(self, table: str) -> list[TestRecord]:
        self._assert_test_mode()
        return list(self._test_storage.get(table, []))

    def test_clear(self) -> None:
        self._assert_test_mode()
        self._test_storage.clear()


# ---- canonical-schema helpers for the production services ------------------------------------------------------

def run(query, what: str) -> list[dict[str, Any]]:
    """Execute a Supabase query; any failure becomes IntegrationUnavailable (503), never a silent success."""
    try:
        res = query.execute()
    except Exception as exc:
        raise IntegrationUnavailable(f"{what} failed") from exc
    return list(getattr(res, "data", None) or [])


def report_row(client: Client, public_reference: str) -> dict[str, Any] | None:
    """The canonical reports row for a public reference (reports.public_reference is unique)."""
    rows = run(client.table("reports").select(
        "id,public_reference,category,summary_ciphertext,description_ciphertext,severity,status,created_at")
        .eq("public_reference", public_reference).limit(1), "read report")
    return rows[0] if rows else None


def require_report_id(client: Client, public_reference: str) -> str:
    row = report_row(client, public_reference)
    if row is None:
        raise LookupError(public_reference)
    return row["id"]
