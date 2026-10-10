from dataclasses import dataclass
@dataclass(frozen=True)
class WitnessInvitation:
    invitation_id: str
    token_digest: str
    expires_at: int
