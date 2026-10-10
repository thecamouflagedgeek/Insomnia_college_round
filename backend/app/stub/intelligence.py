"""M3's engines (app/engines) applied to the integrated workflow. Every output is a review cue for humans: nothing
here decides truth, credibility or outcome, and the engines' own `limitation` text travels with each result."""
from app.engines import claim_integrity, complaint_classifier, incident_correlation, repeat_allegations, \
    severity_assessment

# M3 classifier labels -> report categories (GET /categories)
_M3_LABELS = {"harassment": "Harassment", "retaliation": "Retaliation", "discrimination": "Discrimination",
              "safety": "Safety"}
# Extra routing keywords for categories M3's classifier does not cover yet.
_KEYWORDS = {
    "Sexual Harassment": ["sexual", "touch", "inappropriate comment", "advances"],
    "Bullying": ["bully", "humiliat", "yell", "shout", "belittl", "intimidat"],
    "Abuse of Authority": ["manager", "boss", "power", "authority", "forced", "promotion"],
    "Fraud": ["fraud", "brib", "embezzl", "kickback", "fake invoice"],
}
CORRELATION_THRESHOLD = 0.2
MIN_NARRATIVE_CHARS = 10


def classify(text: str) -> dict:
    m3 = complaint_classifier.classify(text)
    scores: dict[str, float] = {}
    for label, n in m3["signals"].items():
        if n:
            scores[_M3_LABELS[label]] = scores.get(_M3_LABELS[label], 0) + n
    lowered = text.lower()
    for cat, kws in _KEYWORDS.items():
        n = sum(k in lowered for k in kws)
        if n:
            scores[cat] = scores.get(cat, 0) + n
    top = sorted(scores.items(), key=lambda kv: -kv[1])[:3]
    total = sum(n for _, n in top) or 1
    return {"suggestions": [{"category": c, "score": round(n / total, 2)} for c, n in top],
            "model": "m3-keywords", "retained": False, "human_review_required": True,
            "limitation": m3["limitation"]}


# Category floor so a report with no alarming words still gets a sensible queue position.
_CATEGORY_FLOOR = {"Sexual Harassment": "high", "Retaliation": "high", "Fraud": "high", "Safety": "high"}
_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}


def severity(title: str, description: str, category: str) -> dict:
    """M3's lexical severity (critical/high/review) combined with a category floor -> critical|high|medium|low."""
    m3 = severity_assessment.assess(f"{title}\n{description}")
    level = {"critical": "critical", "high": "high"}.get(m3.level, "medium")
    floor = _CATEGORY_FLOOR.get(category, "medium")
    if _RANK[floor] > _RANK[level]:
        level = floor
    return {"level": level, "signals": list(m3.signals), "human_review_required": True,
            "limitation": m3.limitation}


def integrity(title: str, description: str, category: str, content_hashes_seen: set[str],
              content_hash: str) -> dict:
    """M3's deterministic checks plus duplicate-content and minimum-detail checks. Runs before the ZK proof is
    validated, so a rejected report does not consume the reporter's daily nullifier."""
    r = claim_integrity.assess(title, description, category)
    flags = list(r.flags)
    if len(description.strip()) < MIN_NARRATIVE_CHARS:
        flags.append("too_little_detail")
    if content_hash in content_hashes_seen:
        flags.append("duplicate_content")
    return {"accepted_for_review": not flags, "flags": flags}


def related(case_text: str, others: list[tuple[str, str]]) -> list[dict]:
    """[(case_id, text)] -> similar cases above the threshold, most similar first."""
    out = []
    for case_id, text in others:
        s = incident_correlation.similarity(case_text, text)
        if s["score"] >= CORRELATION_THRESHOLD:
            out.append({"case_id": case_id, "score": s["score"], "method": s["method"],
                        "limitation": s["limitation"]})
    return sorted(out, key=lambda d: -d["score"])


def repeat(subject_ref: str | None, prior_refs: set[str]) -> dict:
    return repeat_allegations.possible_repeat(subject_ref, prior_refs)
