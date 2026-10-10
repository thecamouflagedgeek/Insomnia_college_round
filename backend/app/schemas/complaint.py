from pydantic import BaseModel, Field, ConfigDict
from uuid import UUID
from datetime import datetime

class ReportCreate(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)
    title: str = Field(min_length=5, max_length=160)
    narrative: str = Field(min_length=20, max_length=20000)
    category: str = Field(min_length=2, max_length=80)
    anonymous: bool = True

class ReportReceipt(BaseModel):
    reference: str
    status: str
    blockchain_status: str = "pending"

class ReportStatus(BaseModel):
    reference: str
    status: str
    created_at: datetime | None = None

class ReportDetail(BaseModel):
    id: UUID
    reference: str
    status: str
    title: str
    narrative: str
    category: str
