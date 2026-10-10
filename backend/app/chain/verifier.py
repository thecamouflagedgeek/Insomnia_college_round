from dataclasses import dataclass
from typing import Callable

from app.chain.audit_repo import AuditEvent, AuditRepository
from app.chain.hashing import ZERO_HASH, case_key, commitment, content_sha256, entry_hash

# (case_id, event data) -> the stored bytes whose sha256 the event committed to, or None if missing
ContentLoader = Callable[[str, dict], "bytes | None"]


@dataclass(frozen=True)
class EventCheck:
    seq: int
    event_type: str
    at: str
    commitment_ok: bool
    chain_ok: bool
    content_ok: bool | None
    anchored_by: int | None
    status: str  # verified | pending_anchor | tampered | chain_broken | anchor_mismatch


@dataclass(frozen=True)
class AnchorCheck:
    seq: int
    onchain_head: str
    recomputed_head: str | None
    ok: bool
    tx_hash: str | None


@dataclass(frozen=True)
class CaseVerification:
    case_id: str
    ok: bool
    first_bad_seq: int | None
    events: list[EventCheck]
    anchors: list[AnchorCheck]


@dataclass(frozen=True)
class Receipt:
    seq: int
    event_type: str
    at: str
    commitment: str
    entry_hash: str
    anchor_seq: int | None
    anchor_tx: str | None
    explorer_url: str | None


class CaseVerifier:
    """Recomputes every commitment and chain link from storage and compares the result against
    heads read from the chain itself. Nothing stored in the DB is trusted."""

    def __init__(self, repo: AuditRepository, registry, content_loaders: dict[str, ContentLoader],
                 explorer_tx_url: str):
        self._repo = repo
        self._registry = registry
        self._loaders = content_loaders
        self._explorer = explorer_tx_url

    def verify(self, case_id: str) -> CaseVerification:
        key = case_key(case_id)
        events = self._repo.events(case_id)
        onchain = self._registry.anchors(key)
        tx_by_seq = {a.seq: a.tx_hash for a in self._repo.anchors(case_id)}

        prev, heads, partial = ZERO_HASH, {}, []
        for expected_seq, ev in enumerate(events, start=1):
            recomputed = commitment(ev.salt, ev.payload)
            head = entry_hash(key, prev, ev.seq, recomputed)
            chain_ok = ev.seq == expected_seq and ev.prev_hash == prev and head == ev.entry_hash
            partial.append((ev, recomputed == ev.commitment, chain_ok, self._content_ok(case_id, ev)))
            heads[ev.seq] = head
            prev = head

        anchor_checks = [AnchorCheck(a.seq, a.head, heads.get(a.seq), heads.get(a.seq) == a.head,
                                     tx_by_seq.get(a.seq)) for a in onchain]

        checks = []
        for ev, commitment_ok, chain_ok, content_ok in partial:
            covering = next((a for a in anchor_checks if a.seq >= ev.seq), None)
            if not commitment_ok or content_ok is False:
                status = "tampered"         # this event's own data was edited
            elif not chain_ok:
                status = "chain_broken"     # intact itself, but an earlier link changed or went missing
            elif covering is not None and not covering.ok:
                status = "anchor_mismatch"  # intact, but the on-chain head covering it no longer matches
            elif covering is None:
                status = "pending_anchor"
            else:
                status = "verified"
            checks.append(EventCheck(ev.seq, ev.event_type, ev.payload.get("at", ""), commitment_ok, chain_ok,
                                     content_ok, covering.seq if covering else None, status))

        bad = [c.seq for c in checks if c.status in ("tampered", "chain_broken")]
        ok = not bad and all(c.status != "anchor_mismatch" for c in checks) and all(a.ok for a in anchor_checks)
        return CaseVerification(case_id, ok, bad[0] if bad else None, checks, anchor_checks)

    def receipts(self, case_id: str) -> list[Receipt]:
        anchors = self._repo.anchors(case_id)
        out = []
        for ev in self._repo.events(case_id):
            a = next((x for x in anchors if x.seq >= ev.seq), None)
            out.append(Receipt(ev.seq, ev.event_type, ev.payload.get("at", ""), ev.commitment, ev.entry_hash,
                               a.seq if a else None, a.tx_hash if a else None,
                               self._explorer.format(hash=a.tx_hash) if a else None))
        return out

    def _content_ok(self, case_id: str, ev: AuditEvent) -> bool | None:
        loader = self._loaders.get(ev.event_type)
        data = ev.payload.get("data", {})
        expected = data.get("content_sha256") if isinstance(data, dict) else None
        if loader is None or expected is None:
            return None
        content = loader(case_id, data)
        return content is not None and content_sha256(content) == expected
