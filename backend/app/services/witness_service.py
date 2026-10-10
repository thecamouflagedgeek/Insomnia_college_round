from app.core.security import issue_token, token_digest, digest_matches

def create_invitation_token() -> tuple[str, str]:
    token = issue_token()
    return token, token_digest(token)

def validate_invitation_token(token: str, stored_digest: str, expires_at: int, now: int | None = None) -> bool:
    import time
    return (now if now is not None else int(time.time())) < expires_at and digest_matches(token, stored_digest)
