"""Silent Audit tamper demo. Plays a rogue DB admin who bypasses the append-only trigger.

    set -a; source .env; set +a; export PYTHONPATH=backend
    .venv/bin/python scripts/tamper_demo.py verify    --case INC-104
    .venv/bin/python scripts/tamper_demo.py audit     --case INC-104 --seq 2   # rewrite an audit event's data
    .venv/bin/python scripts/tamper_demo.py complaint --case INC-104           # soften the complaint text
    .venv/bin/python scripts/tamper_demo.py restore   --case INC-104
"""
import argparse
import json
from pathlib import Path

import psycopg
from psycopg.types.json import Jsonb

from app.chain.config import ChainSettings
from app.chain.services import build_services

BACKUP = Path(".tamper_backup.json")


def show(case_id: str) -> None:
    result = build_services(ChainSettings.from_env()).verifier.verify(case_id)
    print(f"\nCase {case_id}: {'VERIFIED ✅' if result.ok else 'TAMPERING DETECTED ❌'}")
    if result.first_bad_seq is not None:
        print(f"  first altered record: #{result.first_bad_seq}")
    for e in result.events:
        print(f"  #{e.seq:<3} {e.event_type:<26} {e.status:<15} commitment={e.commitment_ok} "
              f"chain={e.chain_ok} content={e.content_ok}")
    for a in result.anchors:
        print(f"  anchor seq={a.seq} ok={a.ok} onchain={a.onchain_head[:18]}… tx={a.tx_hash}")


def _set_audit_payload(conn, case_id: str, seq: int, payload: dict) -> None:
    conn.execute("alter table audit_events disable trigger audit_events_append_only")
    conn.execute("update audit_events set payload=%s where case_id=%s and seq=%s", (Jsonb(payload), case_id, seq))
    conn.execute("alter table audit_events enable trigger audit_events_append_only")


def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("action", choices=["verify", "audit", "complaint", "restore"])
    p.add_argument("--case", required=True)
    p.add_argument("--seq", type=int, default=2)
    args = p.parse_args()
    dsn = ChainSettings.from_env().database_url

    if args.action == "verify":
        return show(args.case)

    with psycopg.connect(dsn) as conn:
        if args.action == "audit":
            row = conn.execute("select payload from audit_events where case_id=%s and seq=%s",
                               (args.case, args.seq)).fetchone()
            BACKUP.write_text(json.dumps({"kind": "audit", "seq": args.seq, "payload": row[0]}))
            forged = {**row[0], "data": {**row[0]["data"], "tampered": "quietly changed by admin"}}
            _set_audit_payload(conn, args.case, args.seq, forged)
        elif args.action == "complaint":
            row = conn.execute("select raw_payload from complaints where case_id=%s", (args.case,)).fetchone()
            BACKUP.write_text(json.dumps({"kind": "complaint", "raw_payload": row[0]}))
            conn.execute("update complaints set raw_payload=%s where case_id=%s",
                         (row[0].replace("harass", "disagree"), args.case))
        elif args.action == "restore":
            b = json.loads(BACKUP.read_text())
            if b["kind"] == "audit":
                _set_audit_payload(conn, args.case, b["seq"], b["payload"])
            else:
                conn.execute("update complaints set raw_payload=%s where case_id=%s", (b["raw_payload"], args.case))
            BACKUP.unlink()
    show(args.case)


if __name__ == "__main__":
    main()
