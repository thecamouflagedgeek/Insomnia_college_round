"""Requires an approved opaque accused-person reference; no free-text name matching."""
def possible_repeat(reference: str | None, prior_references: set[str]) -> dict:
    matched = bool(reference and reference in prior_references)
    return {"possible_repeat": matched, "basis": "structured_reference" if reference else "unavailable",
            "human_review_required": True, "limitation": "A match is a review cue, not proof of repeated misconduct."}
