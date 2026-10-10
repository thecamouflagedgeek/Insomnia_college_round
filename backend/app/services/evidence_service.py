from dataclasses import dataclass
from pathlib import PurePosixPath

ALLOWED = {"image/jpeg": {".jpg", ".jpeg"}, "image/png": {".png"}, "application/pdf": {".pdf"}, "text/plain": {".txt"}}

@dataclass(frozen=True)
class ValidatedEvidence:
    filename: str
    content_type: str
    size: int
    sha256: str

def validate_evidence(filename: str, content_type: str, content: bytes, max_bytes: int = 10*1024*1024) -> ValidatedEvidence:
    import hashlib
    normalized_name = filename.replace("\\", "/")
    ext = PurePosixPath(normalized_name).suffix.lower()
    if content_type not in ALLOWED or ext not in ALLOWED[content_type]:
        raise ValueError("Unsupported file type or extension")
    if not content or len(content) > max_bytes:
        raise ValueError("File must be non-empty and within size limit")
    signatures = {"image/jpeg": content.startswith(b"\xff\xd8\xff"), "image/png": content.startswith(b"\x89PNG\r\n\x1a\n"), "application/pdf": content.startswith(b"%PDF-")}
    if content_type in signatures and not signatures[content_type]:
        raise ValueError("File content does not match declared type")
    if content_type == "text/plain":
        try: content.decode("utf-8")
        except UnicodeDecodeError: raise ValueError("Text file must be UTF-8") from None
    return ValidatedEvidence(filename=PurePosixPath(normalized_name).name, content_type=content_type, size=len(content), sha256=hashlib.sha256(content).hexdigest())
