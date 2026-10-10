import os
import sys
from unittest.mock import patch

import pytest
from app.core.config import Settings, get_settings
from app.core.database import Database


os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("ENCRYPTION_KEY", "MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=")  # 32 bytes urlsafe b64
os.environ.setdefault("SUPABASE_URL", "")
os.environ.setdefault("SUPABASE_PUBLISHABLE_KEY", "")
os.environ.setdefault("SUPABASE_SECRET_KEY", "")
os.environ.setdefault("SUPABASE_JWT_SECRET", "")

TEST_SETTINGS = Settings(
    _env_file=None,
    app_env="test",
    encryption_key="MDEyMzQ1Njc4OWFiY2RlZjAxMjM0NTY3ODlhYmNkZWY=",
    supabase_url=None,
    supabase_publishable_key=None,
    supabase_secret_key=None,
    supabase_jwt_secret=None,
)


@pytest.fixture(autouse=True)
def clear_test_database():
    """Clear the shared test database adapter before each test."""
    Database.clear_test_adapter()
    yield
    Database.clear_test_adapter()


def pytest_configure(config):
    get_settings.cache_clear()
    patch("app.core.config.get_settings", return_value=TEST_SETTINGS).start()
    patch("app.main.get_settings", return_value=TEST_SETTINGS).start()
    patch("app.services.complaint_service.get_settings", return_value=TEST_SETTINGS).start()
    patch("app.services.witness_service.get_settings", return_value=TEST_SETTINGS).start()
    patch("app.services.messaging_service.get_settings", return_value=TEST_SETTINGS).start()
    patch("app.services.committee_service.get_settings", return_value=TEST_SETTINGS).start()


def pytest_unconfigure(config):
    get_settings.cache_clear()