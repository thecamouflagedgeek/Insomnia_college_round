"""Print exactly what the phone must pass to generateSemaphoreProof, for both signal modes.

    PYTHONPATH=backend .venv/bin/python scripts/spike_params.py '{"t":"spike"}' 'cmp:2026-10-10'
"""
import json
import sys

from app.chain.signals import bytes32_text, message_text, sdk_argument

payload_text, scope_text = sys.argv[1], sys.argv[2]
msg = message_text(payload_text)
print(json.dumps({
    "message_text": msg, "scope_text": scope_text,
    "expected_message_value": str(bytes32_text(msg)), "expected_scope_value": str(bytes32_text(scope_text)),
    "sdk_args_text_mode": {"message": sdk_argument(msg, "text"), "scope": sdk_argument(scope_text, "text")},
    "sdk_args_numeric_mode": {"message": sdk_argument(msg, "numeric"), "scope": sdk_argument(scope_text, "numeric")},
}, indent=2))
