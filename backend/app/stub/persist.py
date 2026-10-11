"""One write path for every state-changing endpoint when Supabase is configured.

    with store.lock, persist.write(request, case) as w:
        ...mutate the in-memory case, record audit events...
        w.add(lambda: store.supabase.insert_message(case.case_id, msg))

On exit the queued row writes run, then each listed case's report + workflow rows are saved, and only then are the
audit events (held back during the block) appended. If any database write fails, the in-memory changes are rolled
back and the request fails with 503: the API never reports success for something that was not stored. Audit events
of a rolled-back change are dropped, so the Silent Audit never records an action that did not happen.

Without Supabase (local/offline development) this is a pass-through and behaviour is unchanged.
"""
from __future__ import annotations

import copy
import logging
from contextlib import contextmanager
from typing import Callable

from fastapi import HTTPException, Request

from app.core.supabase_repo import PersistenceError

logger = logging.getLogger("incognito.persistence")


class _DeferredAudit:
    """Stands in for AuditLog during a write: records what to append once the domain writes have succeeded."""

    def __init__(self):
        self.pending: list[tuple[str, str, dict]] = []

    def record(self, case_id: str, event_type: str, data: dict) -> None:
        self.pending.append((case_id, event_type, copy.deepcopy(data)))


class Writes:
    def __init__(self):
        self.ops: list[Callable[[], None]] = []

    def add(self, op: Callable[[], None]) -> None:
        self.ops.append(op)


def unavailable(what: str = "The change could not be saved") -> HTTPException:
    return HTTPException(503, {"reason": "persistence_failed", "message": f"{what}. Nothing was changed; try again."})


@contextmanager
def write(request: Request, *cases, new_case_id: str | None = None):
    """`cases`: existing cases whose report rows must be saved; `new_case_id`: a case created inside the block."""
    store = request.app.state.store
    if store.persistence_down:
        # Only writes stop: reading, enrolment, proofs and health keep working while the database is unavailable.
        raise HTTPException(503, {"reason": "persistence_unavailable",
                                  "message": "Saving is unavailable right now; nothing was changed. Try again later."})
    repo = store.supabase
    w = Writes()
    if repo is None:
        yield w
        for op in w.ops:  # nothing is queued without Supabase, but keep the contract
            op()
        return

    chain = request.app.state.chain
    real_audit = chain.audit
    deferred = _DeferredAudit()
    snapshots = [(c, copy.deepcopy(vars(c))) for c in cases]
    invitations = copy.deepcopy(store.invitations)
    object.__setattr__(chain, "audit", deferred)  # ChainServices is frozen; restored in every path below

    def rollback():
        for c, snap in snapshots:
            vars(c).clear()
            vars(c).update(snap)
        store.invitations.clear()
        store.invitations.update(invitations)
        if new_case_id:
            store.cases.pop(new_case_id, None)

    try:
        yield w
        object.__setattr__(chain, "audit", real_audit)
        for op in w.ops:
            op()
        saved = list(cases) + ([store.cases[new_case_id]] if new_case_id in store.cases else [])
        for c in saved:
            repo.save_report(c)
    except PersistenceError as exc:
        object.__setattr__(chain, "audit", real_audit)
        rollback()
        logger.error("write rolled back: %s", exc)
        raise unavailable() from exc
    except BaseException:
        object.__setattr__(chain, "audit", real_audit)
        rollback()
        raise

    for case_id, event_type, data in deferred.pending:
        try:
            real_audit.record(case_id, event_type, data)
        except PersistenceError as exc:
            # The change itself is stored; say plainly that its audit entry is not.
            logger.error("audit append failed after a committed write: %s", exc)
            raise HTTPException(500, {"reason": "audit_write_failed",
                                      "message": "The change was saved, but its Silent Audit entry could not be "
                                                 "recorded. Contact an administrator."}) from exc
