import threading
from dataclasses import dataclass
from typing import Protocol

import psycopg


@dataclass(frozen=True)
class Member:
    index: int
    commitment: int
    root: int
    tx_hash: str


class ZkRepository(Protocol):
    def add_member(self, m: Member) -> None: ...
    def members(self) -> list[Member]: ...
    def has_commitment(self, commitment: int) -> bool: ...
    def nullifier_used(self, nullifier: int) -> bool: ...
    def save_nullifier(self, nullifier: int, scope: int, message: int, kind: str, tx_hash: str) -> None: ...


class InMemoryZkRepository:
    def __init__(self):
        self._members: dict[int, Member] = {}
        self._nullifiers: dict[int, tuple] = {}
        self._lock = threading.Lock()

    def add_member(self, m: Member) -> None:
        with self._lock:
            self._members[m.index] = m

    def members(self) -> list[Member]:
        return [self._members[i] for i in sorted(self._members)]

    def has_commitment(self, commitment: int) -> bool:
        return any(m.commitment == commitment for m in self._members.values())

    def nullifier_used(self, nullifier: int) -> bool:
        return nullifier in self._nullifiers

    def save_nullifier(self, nullifier, scope, message, kind, tx_hash) -> None:
        with self._lock:
            self._nullifiers[nullifier] = (scope, message, kind, tx_hash)


class PostgresZkRepository:
    def __init__(self, dsn: str):
        self._dsn = dsn

    def add_member(self, m: Member) -> None:
        with psycopg.connect(self._dsn) as conn:
            conn.execute(
                "insert into zk_members (member_index, identity_commitment, merkle_root, tx_hash) "
                "values (%s, %s, %s, %s)", (m.index, m.commitment, m.root, m.tx_hash))

    def members(self) -> list[Member]:
        with psycopg.connect(self._dsn) as conn:
            rows = conn.execute("select member_index, identity_commitment, merkle_root, tx_hash "
                                "from zk_members order by member_index").fetchall()
        return [Member(int(r[0]), int(r[1]), int(r[2]), r[3]) for r in rows]

    def has_commitment(self, commitment: int) -> bool:
        with psycopg.connect(self._dsn) as conn:
            return conn.execute("select 1 from zk_members where identity_commitment = %s",
                                (commitment,)).fetchone() is not None

    def nullifier_used(self, nullifier: int) -> bool:
        with psycopg.connect(self._dsn) as conn:
            return conn.execute("select 1 from zk_nullifiers where nullifier = %s",
                                (nullifier,)).fetchone() is not None

    def save_nullifier(self, nullifier, scope, message, kind, tx_hash) -> None:
        with psycopg.connect(self._dsn) as conn:
            conn.execute("insert into zk_nullifiers (nullifier, scope, message, kind, tx_hash) "
                         "values (%s, %s, %s, %s, %s)", (nullifier, scope, message, kind, tx_hash))
