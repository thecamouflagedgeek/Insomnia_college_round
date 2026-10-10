from enum import StrEnum
from fastapi import HTTPException

class Role(StrEnum):
    REPORTER = "reporter"
    INVESTIGATOR = "investigator"
    COMMITTEE = "committee"
    ADMIN = "admin"

def require_role(claims: dict, *allowed: Role) -> str:
    role = claims.get("user_role") or claims.get("app_metadata", {}).get("role")
    if role not in {r.value for r in allowed}:
        raise HTTPException(403, detail={"code":"forbidden","message":"Insufficient permissions"})
    return role

def can_access_report(claims: dict, report: dict) -> bool:
    role = claims.get("user_role") or claims.get("app_metadata", {}).get("role")
    return role in {Role.ADMIN.value, Role.INVESTIGATOR.value} and claims.get("sub") in report.get("authorized_investigators", [])
