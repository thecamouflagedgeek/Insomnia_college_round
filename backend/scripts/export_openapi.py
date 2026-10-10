"""Write the checked-in shared OpenAPI contract from FastAPI's actual route schema."""
import json
from pathlib import Path
import sys
import yaml

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app.main import app

destination = Path(__file__).resolve().parents[2] / "shared" / "api-contract.yaml"
destination.parent.mkdir(parents=True, exist_ok=True)
destination.write_text(yaml.safe_dump(json.loads(app.openapi_json) if hasattr(app, "openapi_json") else app.openapi(), sort_keys=False, allow_unicode=True), encoding="utf-8")
print(f"Wrote {destination}")
