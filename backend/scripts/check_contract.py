"""Fail when shared contract differs from the FastAPI route/schema source."""
import json, sys
from pathlib import Path
import yaml
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.main import app
contract = yaml.safe_load((Path(__file__).resolve().parents[2] / "shared" / "api-contract.yaml").read_text(encoding="utf-8"))
if contract != app.openapi():
    raise SystemExit("Contract drift: run python scripts/export_openapi.py")
print("OpenAPI contract matches FastAPI")
