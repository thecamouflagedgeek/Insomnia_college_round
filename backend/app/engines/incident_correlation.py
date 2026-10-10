"""Local-only similarity baseline; optional sentence-transformers is never downloaded at startup."""
from functools import lru_cache
import re

def _tokens(text: str) -> set[str]: return set(re.findall(r"[a-z0-9]{3,}", text.casefold()))

@lru_cache(maxsize=1)
def _encoder(model_name: str, cache_dir: str):
    from sentence_transformers import SentenceTransformer
    return SentenceTransformer(model_name, cache_folder=cache_dir, local_files_only=True)

def similarity(left: str, right: str, use_model: bool = False, model_name: str = "sentence-transformers/all-MiniLM-L6-v2", cache_dir: str = "models-cache") -> dict:
    method = "token_jaccard_degraded"
    score = None
    if use_model:
        try:
            import numpy as np
            vectors = _encoder(model_name, cache_dir).encode([left, right], normalize_embeddings=True)
            score = float(np.dot(vectors[0], vectors[1])); method = "local_sentence_transformer"
        except Exception:
            score = None
    if score is None:
        a, b = _tokens(left), _tokens(right)
        score = len(a & b) / len(a | b) if a | b else 0.0
    return {"score": round(score, 4), "method": method, "human_review_required": True,
            "limitation": "Similarity indicates possible relationship only; reports remain separate."}
