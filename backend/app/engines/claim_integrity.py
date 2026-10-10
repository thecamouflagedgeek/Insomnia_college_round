"""Deterministic content/metadata checks; never a truth or credibility assessment."""
from dataclasses import dataclass

@dataclass(frozen=True)
class IntegrityResult:
    accepted_for_review: bool
    flags: tuple[str, ...]

def assess(title: str, narrative: str, category: str) -> IntegrityResult:
    flags = []
    if not title.strip() or not narrative.strip(): flags.append("missing_required_text")
    if len(narrative) > 20_000: flags.append("narrative_too_long")
    if len(category) > 80: flags.append("category_too_long")
    return IntegrityResult(not flags, tuple(flags))
