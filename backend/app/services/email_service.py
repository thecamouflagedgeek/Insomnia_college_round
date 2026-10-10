"""No delivery provider configured; never silently claim that mail was sent."""
def send_invitation(*args, **kwargs) -> dict:
    return {"sent": False, "mode": "development_stub", "reason": "email provider is not configured"}
