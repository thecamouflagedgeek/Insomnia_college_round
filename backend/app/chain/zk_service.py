from dataclasses import dataclass

from app.chain.semaphore import ProofIn
from app.chain.signals import bytes32_text, message_text
from app.chain.web3_client import revert_reason
from app.chain.zk_repo import Member, ZkRepository


class ProofRejected(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


class EnrollmentRejected(Exception):
    def __init__(self, reason: str):
        super().__init__(reason)
        self.reason = reason


@dataclass(frozen=True)
class ValidatedProof:
    nullifier: int
    scope_text: str
    tx_hash: str


@dataclass(frozen=True)
class GroupView:
    group_id: int
    members: list[int]
    root: int
    onchain_root: int


class ZkService:
    def __init__(self, semaphore, repo: ZkRepository, group_id: int):
        self._sem = semaphore
        self._repo = repo
        self._group_id = group_id

    def enroll(self, commitment: int) -> Member:
        if self._repo.has_commitment(commitment):
            raise EnrollmentRejected("already_enrolled")
        try:
            added = self._sem.add_member(self._group_id, commitment)
        except Exception as exc:
            raise EnrollmentRejected(revert_reason(exc)) from exc
        member = Member(index=added.index, commitment=added.commitment, root=added.root, tx_hash=added.tx_hash)
        self._repo.add_member(member)
        return member

    def group(self) -> GroupView:
        members = self._repo.members()
        return GroupView(
            group_id=self._group_id,
            members=[m.commitment for m in members],
            root=members[-1].root if members else 0,
            onchain_root=self._sem.root(self._group_id),
        )

    def verify_submission(self, proof: ProofIn, payload_text: str,
                          allowed_scope_texts: list[str], kind: str) -> ValidatedProof:
        if proof.message != bytes32_text(message_text(payload_text)):
            raise ProofRejected("message_mismatch")
        scope_text = next((s for s in allowed_scope_texts if bytes32_text(s) == proof.scope), None)
        if scope_text is None:
            raise ProofRejected("scope_mismatch")
        if self._repo.nullifier_used(proof.nullifier):
            raise ProofRejected("replay")
        try:
            if not self._sem.verify(self._group_id, proof):
                raise ProofRejected("invalid_proof")
            tx_hash = self._sem.validate(self._group_id, proof)
        except ProofRejected:
            raise
        except Exception as exc:
            raise ProofRejected(revert_reason(exc)) from exc
        self._repo.save_nullifier(proof.nullifier, proof.scope, proof.message, kind, tx_hash)
        return ValidatedProof(nullifier=proof.nullifier, scope_text=scope_text, tx_hash=tx_hash)
