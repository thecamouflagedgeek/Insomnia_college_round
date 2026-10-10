from fastapi import APIRouter, Depends
from app.core.security import verify_access_token
from app.core.permissions import require_role, Role
from app.services.blockchain_service import BlockchainAdapter

router = APIRouter(prefix="/integrations/blockchain", tags=["blockchain (development stub)"])
adapter = BlockchainAdapter()

@router.get("/status/{operation_id}", summary="Poll blockchain status (development stub always remains pending)")
def operation_status(operation_id: str, claims: dict = Depends(verify_access_token)):
    require_role(claims, Role.INVESTIGATOR, Role.ADMIN)
    result = adapter.get_status(operation_id)
    return {"status":result.status.value, "mode":result.mode, "evidence":result.evidence}
