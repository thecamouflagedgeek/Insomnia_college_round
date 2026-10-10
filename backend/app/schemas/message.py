from pydantic import BaseModel, Field

class MessageCreate(BaseModel):
    report_reference: str = Field(min_length=8, max_length=80)
    body: str = Field(min_length=1, max_length=5000)
    thread_token: str | None = Field(default=None, max_length=128)

class MessageResponse(BaseModel):
    message_id: str
    created_at: str
