import os
import sys
from unittest.mock import patch

import pytest
from app.core.config import Settings, get_settings

os.environ.setdefault("APP_ENV", "test")
os.environ.setdefault("ENCRYPTION_KEY", "dGVzdC1rZXktdGhhdC1pcy1leGFjdGx5LTMyLWJ5dGVzLQ==")  # 32 bytes urlsafe b64
os.environ.setdefault("SUPABASE_URL", "")
os.environ.setdefault("SUPABASE_PUBLISHABLE_KEY", "")
os.environ.setdefault("SUPABASE_SECRET_KEY", "")
os.environ.setdefault("SUPABASE_JWT_SECRET", "")

TEST_SETTINGS = Settings(
    _env_file=None,
    app_env="test",
    encryption_key="dGVzdC1rZXktdGhhdC1pcy1leGFjdGx5LTMyLWJ5dGVzLQ==",
    supabase_url=None,
    supabase_publishable_key=None,
    supabase_secret_key=None,
    supabase_jwt_secret=None,
)

def pytest_configure(config):
    get_settings.cache_clear()
    patch("app.core.config.get_settings", return_value=TEST_SETTINGS).start()
    patch("app.main.get_settings", return_value=TEST_SETTINGS).start()
    patch("app.services.complaint_service.get_settings", return_value=TEST_SETTINGS).start()

def pytest_unconfigure(config):
    get_settings.cache_clear()