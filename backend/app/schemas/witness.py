from pydantic import BaseModel, Field

class WitnessInvitationCreate(BaseModel):
    report_reference: str = Field(min_length=8, max_length=80)
    contact: str = Field(min_length=5, max_length=320)

class WitnessTokenValidation(BaseModel):
    token: str = Field(min_length=32, max_length=128)

class WitnessResponse(BaseModel):
    status: str
    invitation_id: str
