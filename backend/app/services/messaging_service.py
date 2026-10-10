"""Messaging workflows await verified thread and participant authorization schema."""
from app.core.database import IntegrationUnavailable
def unavailable(): raise IntegrationUnavailable("Messaging persistence is disabled until thread authorization is verified")
