import threading
from dataclasses import dataclass
from typing import Callable, Protocol

import psycopg
from psycopg.types.json import Jsonb

from app.chain.hashing import ZERO_HASH


@dataclass(frozen=True)
class AuditEvent:
    case_id: str
    seq: int
    event_type: str
    payload: dict
    salt: str
    commitment: str
    prev_hash: str
    entry_hash: str


@dataclass(frozen=True)
class AnchorRecord:
    case_id: str
    seq: int
    head: str
    tx_hash: str
    block_number: int


Builder = Callable[[int, str], AuditEvent]


class AuditRepository(Protocol):
    def append(self, case_id: str, build: Builder) -> AuditEvent: ...
    def events(self, case_id: str) -> list[AuditEvent]: ...
    def unanchored_heads(self) -> list[tuple[str, int, str]]: ...
    def save_anchor(self, rec: AnchorRecord) -> None: ...
    def anchors(self, case_id: str) -> list[AnchorRecord]: ...


class InMemoryAuditRepository:
    def __init__(self):
        self._events: dict[str, list[AuditEvent]] = {}
        self._anchors: dict[str, list[AnchorRecord]] = {}
        self._lock = threading.Lock()

    def append(self, case_id: str, build: Builder) -> AuditEvent:
        with self._lock:
            chain = self._events.setdefault(case_id, [])
            seq, prev = (chain[-1].seq + 1, chain[-1].entry_hash) if chain else (1, ZERO_HASH)
            event = build(seq, prev)
            chain.append(event)
            return event

    def events(self, case_id: str) -> list[AuditEvent]:
        return list(self._events.get(case_id, []))

    def unanchored_heads(self) -> list[tuple[str, int, str]]:
        out = []
        for case_id, chain in self._events.items():
            anchored = max((a.seq for a in self._anchors.get(case_id, [])), default=0)
            if chain and chain[-1].seq > anchored:
                out.append((case_id, chain[-1].seq, chain[-1].entry_hash))
        return out

    def save_anchor(self, rec: AnchorRecord) -> None:
        with self._lock:
            self._anchors.setdefault(rec.case_id, []).append(rec)

    def anchors(self, case_id: str) -> list[AnchorRecord]:
        return list(self._anchors.get(case_id, []))


_EVENT_COLS = "case_id, seq, event_type, payload, salt, commitment, prev_hash, entry_hash"


class PostgresAuditRepository:
    def __init__(self, dsn: str):
        self._dsn = dsn

    def append(self, case_id: str, build: Builder) -> AuditEvent:
        with psycopg.connect(self._dsn) as conn, conn.transaction():
            conn.execute("select pg_advisory_xact_lock(hashtext(%s))", (case_id,))
            row = conn.execute("select seq, entry_hash from audit_events where case_id = %s "
                               "order by seq desc limit 1", (case_id,)).fetchone()
            seq, prev = (row[0] + 1, row[1]) if row else (1, ZERO_HASH)
            ev = build(seq, prev)
            conn.execute(f"insert into audit_events ({_EVENT_COLS}) values (%s, %s, %s, %s, %s, %s, %s, %s)",
                         (ev.case_id, ev.seq, ev.event_type, Jsonb(ev.payload), ev.salt,
                          ev.commitment, ev.prev_hash, ev.entry_hash))
            return ev

    def events(self, case_id: str) -> list[AuditEvent]:
        with psycopg.connect(self._dsn) as conn:
            rows = conn.execute(f"select {_EVENT_COLS} from audit_events where case_id = %s order by seq",
                                (case_id,)).fetchall()
        return [AuditEvent(*r) for r in rows]

    def unanchored_heads(self) -> list[tuple[str, int, str]]:
        with psycopg.connect(self._dsn) as conn:
            return [tuple(r) for r in conn.execute("""
                select e.case_id, e.seq, e.entry_hash
                from audit_events e
                join (select case_id, max(seq) seq from audit_events group by case_id) m
                  on m.case_id = e.case_id and m.seq = e.seq
                left join (select case_id, max(seq) seq from audit_anchors group by case_id) a
                  on a.case_id = e.case_id
                where a.seq is null or a.seq < e.seq
            """).fetchall()]

    def save_anchor(self, rec: AnchorRecord) -> None:
        with psycopg.connect(self._dsn) as conn:
            conn.execute("insert into audit_anchors (case_id, seq, head, tx_hash, block_number) "
                         "values (%s, %s, %s, %s, %s)",
                         (rec.case_id, rec.seq, rec.head, rec.tx_hash, rec.block_number))

    def anchors(self, case_id: str) -> list[AnchorRecord]:
        with psycopg.connect(self._dsn) as conn:
            rows = conn.execute("select case_id, seq, head, tx_hash, block_number from audit_anchors "
                                "where case_id = %s order by seq", (case_id,)).fetchall()
        return [AnchorRecord(*r) for r in rows]
