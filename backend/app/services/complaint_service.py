from app.core.database import Database, IntegrationUnavailable
from app.core.config import get_settings
from app.schemas.complaint import ReportCreate

def create_report(payload: ReportCreate, public_reference: str) -> dict:
    # The reference is deliberately not persisted until exact columns and encryption policy are confirmed.
    Database.from_settings(get_settings()).require_schema()
    raise IntegrationUnavailable("Report persistence adapter has not been enabled")
