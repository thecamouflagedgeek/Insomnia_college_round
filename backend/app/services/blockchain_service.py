"""Development-only boundary. No proof or transaction is generated or verified here."""
from enum import StrEnum
from dataclasses import dataclass

class ChainStatus(StrEnum):
    PENDING="pending"; VERIFIED="verified"; ANCHORED="anchored"; FAILED="failed"

@dataclass(frozen=True)
class ChainResult:
    status: ChainStatus
    evidence: str | None = None
    mode: str = "development_stub"

class BlockchainAdapter:
    def submit_commitment(self, commitment: str, idempotency_key: str) -> ChainResult:
        return ChainResult(ChainStatus.PENDING)
    def get_status(self, operation_id: str) -> ChainResult:
        return ChainResult(ChainStatus.PENDING)
