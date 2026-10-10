from fastapi import APIRouter, Depends
from app.core.security import verify_access_token
router = APIRouter(prefix="/credentials", tags=["credentials"])

@router.get("/me", summary="Validate Supabase access token and return minimal identity claims")
def me(claims: dict = Depends(verify_access_token)):
    return {"subject": claims["sub"], "role": claims.get("user_role") or claims.get("app_metadata", {}).get("role")}
