import secrets

from web3 import Web3

from app.chain.anchorer import Anchorer
from app.chain.audit_log import AuditLog
from app.chain.audit_repo import InMemoryAuditRepository, PostgresAuditRepository
from app.chain.config import ChainSettings
from app.chain.registry import AnchorTx, OnchainAnchor, RegistryClient
from app.chain.semaphore import AddedMember, SemaphoreClient
from app.chain.services import ChainServices
from app.chain.verifier import CaseVerifier
from app.chain.web3_client import TxSender, make_w3
from app.chain.zk_repo import InMemoryZkRepository, PostgresZkRepository
from app.chain.zk_service import ZkService
from app.stub.store import StubStore


class _Revert(Exception):
    """Carries a custom-error selector the way web3 does, so revert_reason() maps it."""
    def __init__(self, signature: str):
        super().__init__(signature)
        self.data = Web3.to_hex(Web3.keccak(text=signature)[:4])


class OfflineSemaphore:
    """CHAIN_MODE=offline: accepts any well-formed proof (no cryptography) but keeps nullifier and duplicate-member
    semantics, so the app's UI flows and error handling can be built without the Flutter SDK or a chain."""

    def __init__(self):
        self.members: list[int] = []
        self.used: set[int] = set()

    def add_member(self, group_id, commitment):
        if commitment in self.members:
            raise _Revert("LeafAlreadyExists()")
        self.members.append(commitment)
        return AddedMember(index=len(self.members) - 1, commitment=commitment,
                           root=self.root(group_id), tx_hash="0x" + secrets.token_hex(32))

    def root(self, group_id):
        return len(self.members)

    def verify(self, group_id, proof):
        return True

    def validate(self, group_id, proof):
        if proof.nullifier in self.used:
            raise _Revert("Semaphore__YouAreUsingTheSameNullifierTwice()")
        self.used.add(proof.nullifier)
        return "0x" + secrets.token_hex(32)


class OfflineRegistry:
    def __init__(self):
        self.store: dict[str, list[OnchainAnchor]] = {}

    def anchor(self, case_key_hex, seq, head_hex):
        self.store.setdefault(case_key_hex, []).append(OnchainAnchor(seq=seq, head=head_hex, timestamp=0))
        return AnchorTx(tx_hash="0x" + secrets.token_hex(32), block_number=0)

    def anchors(self, case_key_hex):
        return list(self.store.get(case_key_hex, []))


def build_stub_services(settings: ChainSettings, store: StubStore, offline: bool) -> ChainServices:
    """live: real Semaphore group + CaseAuditRegistry, Postgres for nullifiers/audit (DATABASE_URL required, because
    the on-chain group outlives the process). offline: everything in memory."""
    if offline:
        semaphore, registry = OfflineSemaphore(), OfflineRegistry()
        zk_repo, audit_repo = InMemoryZkRepository(), InMemoryAuditRepository()
        group_id = settings.group_id or 0
    else:
        if not settings.database_url or settings.group_id is None:
            raise RuntimeError("CHAIN_MODE=live needs DATABASE_URL and SEMAPHORE_GROUP_ID")
        w3 = make_w3(settings.rpc_url)
        sender = TxSender(w3, settings.relayer_private_key, settings.min_priority_gwei)
        semaphore = SemaphoreClient(w3, sender, settings.semaphore_address)
        registry = RegistryClient(w3, sender, settings.registry_address)
        zk_repo, audit_repo = PostgresZkRepository(settings.database_url), PostgresAuditRepository(settings.database_url)
        group_id = settings.group_id
    loaders = {"complaint_submitted": store.complaint_bytes, "evidence_sealed": store.evidence_bytes,
               "inbox_message": store.message_bytes}
    return ChainServices(
        zk=ZkService(semaphore, zk_repo, group_id),
        audit=AuditLog(audit_repo),
        verifier=CaseVerifier(audit_repo, registry, loaders, settings.explorer_tx_url),
        anchorer=Anchorer(audit_repo, registry),
        settings=settings,
    )
