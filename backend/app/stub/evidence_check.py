"""Evidence intake checks: strip identifying metadata, and flag inconsistencies for a human reviewer.

Runs on the server, on the original upload, in memory. Only coarse findings are kept: never the exact capture time,
GPS position, device model, serial number or author. The stored (and sealed) file is the cleaned copy.

A flag is a review cue, never a verdict: missing metadata is normal (messaging apps and screenshots strip it), and
nothing here decides that evidence is fake or genuine.
"""
import io
from dataclasses import dataclass, field
from datetime import date, datetime

from PIL import Image, ImageOps, UnidentifiedImageError

DATE_GAP_DAYS = 14
_EDITORS = ("photoshop", "lightroom", "gimp", "snapseed", "picsart", "canva", "affinity", "pixelmator", "facetune",
            "photopea", "paint.net", "fotor", "remini", "meitu", "airbrush")
_EXIF_SOFTWARE, _EXIF_IFD, _EXIF_DATETIME_ORIGINAL, _EXIF_DATETIME = 0x0131, 0x8769, 0x9003, 0x0132
_STRIPPABLE = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}


@dataclass
class EvidenceCheck:
    content: bytes                 # what gets stored and sealed (metadata removed where possible)
    mime: str                      # detected type when known, else the declared one
    flags: list[dict] = field(default_factory=list)  # [{"code", "message"}], shown to reviewers only


def sniff(head: bytes) -> str | None:
    """File type from its leading bytes, independent of the name or the declared type."""
    if head.startswith(b"\xff\xd8\xff"):
        return "image/jpeg"
    if head.startswith(b"\x89PNG\r\n\x1a\n"):
        return "image/png"
    if head[:6] in (b"GIF87a", b"GIF89a"):
        return "image/gif"
    if head[:4] == b"RIFF" and head[8:12] == b"WEBP":
        return "image/webp"
    if head.startswith(b"%PDF-"):
        return "application/pdf"
    if head[4:8] == b"ftyp":
        brand = head[8:12]
        if brand in (b"heic", b"heix", b"mif1", b"msf1"):
            return "image/heic"
        return "video/mp4"
    if head.startswith(b"PK\x03\x04"):
        return "application/zip"  # also docx/xlsx containers
    try:
        head.decode("utf-8")
        return "text/plain"
    except UnicodeDecodeError:
        return None


def _family(mime: str) -> str:
    if mime in ("application/zip",) or "officedocument" in mime or mime.endswith("+zip"):
        return "zip"
    return mime.split("/")[0] if mime.startswith(("image/", "video/", "text/")) else mime


def _exif_date(exif) -> date | None:
    raw = exif.get_ifd(_EXIF_IFD).get(_EXIF_DATETIME_ORIGINAL) or exif.get(_EXIF_DATETIME)
    try:
        return datetime.strptime(str(raw).strip("\x00 ")[:19], "%Y:%m:%d %H:%M:%S").date() if raw else None
    except ValueError:
        return None


def analyse(content: bytes, declared_mime: str, incident: date | None, seen_elsewhere: set[str],
            sha256) -> EvidenceCheck:
    """`seen_elsewhere`: content hashes of evidence already filed on other cases. `sha256`: bytes -> hex digest."""
    flags: list[dict] = []
    actual = sniff(content[:32])
    declared = (declared_mime or "application/octet-stream").lower()
    if actual and declared != "application/octet-stream" and _family(actual) != _family(declared):
        flags.append({"code": "type_mismatch",
                      "message": f"File content is {actual}, but it was uploaded as {declared}."})
    mime = actual or declared

    if sha256(content) in seen_elsewhere:
        flags.append({"code": "reused_file", "message": "The identical file was already submitted on another case."})

    cleaned = content
    if mime in _STRIPPABLE:
        try:
            img = Image.open(io.BytesIO(content))
            exif = img.getexif()
            software = str(exif.get(_EXIF_SOFTWARE) or "").lower()
            if any(e in software for e in _EDITORS):
                flags.append({"code": "edited", "message": "Image metadata names photo-editing software."})
            taken = _exif_date(exif)
            if taken and incident and abs((taken - incident).days) > DATE_GAP_DAYS:
                when = "before" if taken < incident else "after"
                flags.append({"code": "date_gap", "message": f"Photo capture date is more than {DATE_GAP_DAYS} days "
                                                            f"{when} the reported incident date."})
            # Re-encode without metadata. Apply the orientation first, so stripping it does not rotate the image.
            img = ImageOps.exif_transpose(img)
            if mime == "image/jpeg" and img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            out = io.BytesIO()
            img.save(out, _STRIPPABLE[mime], **({"quality": 95} if mime != "image/png" else {}))
            cleaned = out.getvalue()
            if sha256(cleaned) in seen_elsewhere and not any(f["code"] == "reused_file" for f in flags):
                flags.append({"code": "reused_file",
                              "message": "The identical image was already submitted on another case."})
        except (UnidentifiedImageError, OSError, ValueError):
            flags.append({"code": "unreadable_image", "message": "The image could not be read; metadata was not removed."})
    elif mime.startswith("image/") or mime.startswith("video/") or mime == "application/pdf":
        flags.append({"code": "metadata_kept",
                      "message": f"Metadata in {mime} files is not removed yet; it may identify the reporter."})
    return EvidenceCheck(cleaned, mime, flags)
