"""Seed a demo case with a complaint and a few anchored audit events (for rehearsing the tamper demo).

    set -a; source .env; set +a; PYTHONPATH=backend .venv/bin/python scripts/seed_demo_case.py INC-104
Creates a minimal `complaints` table if M3's schema isn't there yet.
"""
import sys

import psycopg

from app.chain.config import ChainSettings
from app.chain.hashing import content_sha256
from app.chain.services import build_services

case_id = sys.argv[1] if len(sys.argv) > 1 else "INC-104"
payload = '{"category":"harassment","description":"My manager continues to harass me in team meetings."}'
settings = ChainSettings.from_env()
with psycopg.connect(settings.database_url) as conn:
    conn.execute("create table if not exists complaints (case_id text primary key, raw_payload text not null)")
    conn.execute("insert into complaints (case_id, raw_payload) values (%s, %s) on conflict (case_id) do nothing",
                 (case_id, payload))
services = build_services(settings)
audit = services.audit
audit.record(case_id, "complaint_submitted", {"content_sha256": content_sha256(payload.encode())})
audit.record(case_id, "committee_assigned", {"committee_id": "cmt-1", "member_ids": ["m-7", "m-9"]})
audit.record(case_id, "challenge_filed", {"challenge_id": "ch-1", "member_id": "m-9"})
audit.record(case_id, "challenge_decided", {"challenge_id": "ch-1", "decision": "upheld", "reviewer_id": "r-2"})
for rec in services.anchorer.run_once():
    print(f"anchored {rec.case_id} seq={rec.seq} tx={rec.tx_hash}")
