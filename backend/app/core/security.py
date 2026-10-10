import hashlib, hmac, secrets
from functools import lru_cache
from typing import Any
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from .config import get_settings

bearer = HTTPBearer(auto_error=False)

@lru_cache(maxsize=4)
def _jwks_client(url: str):
    return jwt.PyJWKClient(url, cache_keys=True)

def new_public_reference() -> str:
    return "INC-" + secrets.token_urlsafe(12)

def token_digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()

def issue_token() -> str:
    return secrets.token_urlsafe(32)

def verify_access_token(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> dict[str, Any]:
    settings = get_settings()
    if credentials is None or not settings.supabase_url:
        raise HTTPException(status_code=401, detail={"code":"unauthorized","message":"Valid authentication is required"})
    try:
        token = credentials.credentials
        if settings.supabase_jwt_secret:
            # Explicit legacy-only configuration. New Supabase signing keys should use JWKS.
            key, algorithms = settings.supabase_jwt_secret, ["HS256"]
        else:
            header = jwt.get_unverified_header(token)
            if header.get("alg") not in {"ES256", "RS256"}:
                raise jwt.InvalidTokenError("unsupported signing algorithm")
            jwks_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
            key, algorithms = _jwks_client(jwks_url).get_signing_key_from_jwt(token).key, [header["alg"]]
        claims = jwt.decode(token, key, algorithms=algorithms,
                            options={"require":["exp","sub","iss","aud"]},
                            issuer=f"{settings.supabase_url.rstrip('/')}/auth/v1", audience="authenticated")
        if not isinstance(claims.get("sub"), str):
            raise jwt.InvalidTokenError("invalid subject")
        return claims
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail={"code":"unauthorized","message":"Valid authentication is required"}) from None

def digest_matches(token: str, expected: str) -> bool:
    return hmac.compare_digest(token_digest(token), expected)
