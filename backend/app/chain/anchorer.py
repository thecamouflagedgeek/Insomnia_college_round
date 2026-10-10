import logging
import threading

from app.chain.audit_repo import AnchorRecord, AuditRepository
from app.chain.hashing import case_key

log = logging.getLogger(__name__)


class Anchorer:
    """Anchors the latest head of every case that has new events. Anchoring only the latest head
    is enough: each head commits to the whole chain before it."""

    def __init__(self, repo: AuditRepository, registry):
        self._repo = repo
        self._registry = registry

    def run_once(self) -> list[AnchorRecord]:
        done = []
        for case_id, seq, head in self._repo.unanchored_heads():
            try:
                tx = self._registry.anchor(case_key(case_id), seq, head)
            except Exception:
                log.exception("anchoring %s seq=%s failed; will retry", case_id, seq)
                continue
            rec = AnchorRecord(case_id, seq, head, tx.tx_hash, tx.block_number)
            self._repo.save_anchor(rec)
            done.append(rec)
        return done

    def run_forever(self, stop: threading.Event, interval_s: float = 5.0) -> None:
        while not stop.is_set():
            try:
                self.run_once()
            except Exception:
                log.exception("anchor sweep failed")
            stop.wait(interval_s)
