from dataclasses import dataclass
@dataclass(frozen=True)
class InvestigationMessage:
    message_id: str
    report_reference: str
    encrypted_body: str
