"""Escalation-only lexical triage. It does not assess truth or guilt."""
from dataclasses import dataclass

@dataclass(frozen=True)
class SeverityResult:
    level: str
    human_review_required: bool
    signals: tuple[str, ...]
    limitation: str = "Keyword rules can miss context and require human review."

CRITICAL = {"threat", "threatened", "assault", "hit me", "self-harm", "suicide", "weapon"}
HIGH = {"retaliation", "stalking", "sexual harassment", "physical harm"}

def assess(text: str) -> SeverityResult:
    lowered = text.casefold()
    critical = tuple(sorted(term for term in CRITICAL if term in lowered))
    signals = critical or tuple(sorted(term for term in HIGH if term in lowered))
    level = "critical" if critical else "high" if signals else "review"
    return SeverityResult(level, True, signals)
