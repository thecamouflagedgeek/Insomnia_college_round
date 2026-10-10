"""Committee workflows await verified membership and challenge schema."""
from app.core.database import IntegrationUnavailable
def unavailable(): raise IntegrationUnavailable("Committee persistence is disabled until schema and membership policy are verified")
