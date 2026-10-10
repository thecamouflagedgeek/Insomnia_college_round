"""Small transparent routing aid. Never predicts whether an allegation is true."""
KEYWORDS = {"harassment": {"harassment", "unwelcome conduct"}, "retaliation": {"retaliation", "retaliated"},
            "discrimination": {"discrimination", "protected class"}, "safety": {"threat", "assault", "unsafe"}}
def classify(text: str) -> dict:
    lowered = text.casefold()
    scores = {label: sum(term in lowered for term in terms) for label, terms in KEYWORDS.items()}
    score = max(scores.values(), default=0)
    labels = [label for label, value in scores.items() if value == score and value > 0]
    return {"suggested_categories": labels, "signals": scores, "human_review_required": True,
            "limitation": "Keyword overlap only; not a finding, credibility assessment, or automated disposition."}
