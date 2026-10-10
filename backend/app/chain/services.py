import threading
from dataclasses import dataclass
from typing import Callable

import psycopg

from app.chain.anchorer import Anchorer
from app.chain.audit_log import AuditLog
from app.chain.audit_repo import PostgresAuditRepository
from app.chain.config import ChainSettings
from app.chain.registry import RegistryClient
from app.chain.semaphore import SemaphoreClient
from app.chain.verifier import CaseVerifier, ContentLoader
from app.chain.web3_client import TxSender, make_w3
from app.chain.zk_repo import PostgresZkRepository
from app.chain.zk_service import ZkService


@dataclass(frozen=True)
class ChainServices:
    zk: ZkService
    audit: AuditLog
    verifier: CaseVerifier
    anchorer: Anchorer
    settings: ChainSettings


def _complaint_loader(dsn: str) -> ContentLoader:
    """complaint_submitted commits to sha256(complaints.raw_payload) — the exact string the phone sent."""
    def load(case_id: str, data: dict) -> bytes | None:
        with psycopg.connect(dsn) as conn:
            row = conn.execute("select raw_payload from complaints where case_id = %s", (case_id,)).fetchone()
        return row[0].encode("utf-8") if row else None
    return load


def build_services(settings: ChainSettings, evidence_loader: ContentLoader | None = None) -> ChainServices:
    w3 = make_w3(settings.rpc_url)
    sender = TxSender(w3, settings.relayer_private_key, settings.min_priority_gwei)
    registry = RegistryClient(w3, sender, settings.registry_address)
    audit_repo = PostgresAuditRepository(settings.database_url)
    loaders: dict[str, ContentLoader] = {"complaint_submitted": _complaint_loader(settings.database_url)}
    if evidence_loader:
        loaders["evidence_sealed"] = evidence_loader
    return ChainServices(
        zk=ZkService(SemaphoreClient(w3, sender, settings.semaphore_address),
                     PostgresZkRepository(settings.database_url), settings.group_id),
        audit=AuditLog(audit_repo),
        verifier=CaseVerifier(audit_repo, registry, loaders, settings.explorer_tx_url),
        anchorer=Anchorer(audit_repo, registry),
        settings=settings,
    )


def start_anchorer(services: ChainServices) -> Callable[[], None]:
    stop = threading.Event()
    thread = threading.Thread(target=services.anchorer.run_forever,
                              args=(stop, services.settings.anchor_interval_s), daemon=True, name="anchorer")
    thread.start()

    def shutdown() -> None:
        stop.set()
        thread.join(timeout=10)
    return shutdown
