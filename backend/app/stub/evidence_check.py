"""Evidence intake checks: strip identifying metadata, and flag inconsistencies for a human reviewer.

Runs on the server, on the original upload, in memory. Only coarse findings are kept: never the exact capture time,
GPS position, device model, serial number or author. The stored (and sealed) file is the cleaned copy.

A flag is a review cue, never a verdict: missing metadata is normal (messaging apps and screenshots strip it), and
nothing here decides that evidence is fake or genuine.
"""
import io
import json
from dataclasses import dataclass, field
from datetime import date, datetime

import pypdf
from PIL import Image, ImageOps, UnidentifiedImageError

try:  # iPhone photos (HEIC); optional so a missing wheel never blocks intake
    import pillow_heif
    pillow_heif.register_heif_opener()
except ImportError:  # pragma: no cover
    pillow_heif = None

try:  # Content Credentials (C2PA); optional for the same reason
    import c2pa
except ImportError:  # pragma: no cover
    c2pa = None

DATE_GAP_DAYS = 14
_EDITORS = ("photoshop", "lightroom", "gimp", "snapseed", "picsart", "canva", "affinity", "pixelmator", "facetune",
            "photopea", "paint.net", "fotor", "remini", "meitu", "airbrush")
_EXIF_SOFTWARE, _EXIF_IFD, _EXIF_DATETIME_ORIGINAL, _EXIF_DATETIME = 0x0131, 0x8769, 0x9003, 0x0132
_STRIPPABLE = {"image/jpeg": "JPEG", "image/png": "PNG", "image/webp": "WEBP"}
# IPTC digital source types that a C2PA manifest uses to declare generative-AI content.
_AI_SOURCES = ("trainedAlgorithmicMedia", "compositeWithTrainedAlgorithmicMedia", "algorithmicMedia")
NEAR_DUPLICATE_BITS = 6  # of 64 in the difference hash


@dataclass
class EvidenceCheck:
    content: bytes                 # what gets stored and sealed (metadata removed where possible)
    mime: str                      # detected type when known, else the declared one
    flags: list[dict] = field(default_factory=list)  # [{"code", "message"}], shown to reviewers only
    name: str = ""                 # stored file name (an iPhone photo converted to JPEG gets a .jpg name)
    phash: str = ""                # 64-bit difference hash of an image, for near-duplicate search


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


def dhash(img: Image.Image) -> str:
    """64-bit difference hash: survives resizing, recompression and small edits; differs for different pictures."""
    g = img.convert("L").resize((9, 8), Image.Resampling.LANCZOS)
    px = list(g.get_flattened_data())
    bits = 0
    for row in range(8):
        for col in range(8):
            bits = (bits << 1) | (px[row * 9 + col] > px[row * 9 + col + 1])
    return f"{bits:016x}"


def _informative(h: str) -> bool:
    """Flat or nearly blank images (solid colours, mostly white screenshots) all hash to almost the same value, so
    matching them would flag unrelated files. Only hashes with enough structure take part."""
    ones = bin(int(h, 16)).count("1")
    return 8 <= ones <= 56


def _hamming(a: str, b: str) -> int:
    return bin(int(a, 16) ^ int(b, 16)).count("1")


def _c2pa_flags(content: bytes, mime: str) -> list[dict]:
    """Content Credentials: a declared AI source, or a manifest that no longer matches the file. No manifest is normal
    and says nothing either way."""
    if c2pa is None:
        return []
    try:
        data = json.loads(c2pa.Reader(mime, io.BytesIO(content)).json())
    except Exception:  # no manifest, or a type the reader does not handle
        return []
    flags = []
    if any(src in json.dumps(data) for src in _AI_SOURCES):
        flags.append({"code": "ai_generated_declared",
                      "message": "The file's Content Credentials declare it was made or altered with generative AI."})
    statuses = data.get("validation_status") or []
    if data.get("validation_state") == "Invalid" or any(
            str(v.get("code", "")).endswith((".mismatch", ".invalid", ".missing")) for v in statuses):
        flags.append({"code": "credentials_broken",
                      "message": "The file carries Content Credentials that no longer match its content."})
    return flags


def _pdf(content: bytes, incident: date | None, flags: list[dict]) -> bytes:
    try:
        reader = pypdf.PdfReader(io.BytesIO(content))
        if reader.is_encrypted:
            flags.append({"code": "unreadable_pdf",
                          "message": "The PDF is password-protected; metadata could not be checked or removed."})
            return content
        meta = reader.metadata
        made = meta.creation_date if meta else None
        changed = meta.modification_date if meta else None
        tool = " ".join(str(x or "") for x in ((meta.producer, meta.creator) if meta else ())).lower()
        if any(e in tool for e in _EDITORS):
            flags.append({"code": "edited", "message": "PDF metadata names image-editing software."})
        if made and changed and (changed - made).days > 1:
            flags.append({"code": "pdf_modified",
                          "message": "The PDF was modified more than a day after it was created."})
        if made and incident and abs((made.date() - incident).days) > DATE_GAP_DAYS:
            when = "before" if made.date() < incident else "after"
            flags.append({"code": "date_gap", "message": f"PDF creation date is more than {DATE_GAP_DAYS} days {when} "
                                                        "the reported incident date."})
        writer = pypdf.PdfWriter(clone_from=reader)
        writer.metadata = None
        writer.xmp_metadata = None
        out = io.BytesIO()
        writer.write(out)
        return out.getvalue()
    except Exception:
        flags.append({"code": "unreadable_pdf", "message": "The PDF could not be read; metadata was not removed."})
        return content


def analyse(content: bytes, declared_mime: str, incident: date | None, seen_elsewhere: set[str],
            sha256, name: str = "file", phashes_elsewhere: set[str] = frozenset()) -> EvidenceCheck:
    """`seen_elsewhere`: content hashes of evidence already filed on other cases; `phashes_elsewhere`: their image
    hashes. `sha256`: bytes -> hex digest."""
    flags: list[dict] = []
    actual = sniff(content[:32])
    declared = (declared_mime or "application/octet-stream").lower()
    if actual and declared != "application/octet-stream" and _family(actual) != _family(declared):
        flags.append({"code": "type_mismatch",
                      "message": f"File content is {actual}, but it was uploaded as {declared}."})
    mime = actual or declared

    if sha256(content) in seen_elsewhere:
        flags.append({"code": "reused_file", "message": "The identical file was already submitted on another case."})
    flags += _c2pa_flags(content, mime)  # before stripping: the manifest is metadata too

    cleaned, phash = content, ""
    if mime == "image/heic" and pillow_heif is not None:
        mime, name = "image/jpeg", (name.rsplit(".", 1)[0] if "." in name else name) + ".jpg"
        convert_from_heic = True
    else:
        convert_from_heic = False
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
            phash = dhash(img)
            if mime == "image/jpeg" and img.mode not in ("RGB", "L"):
                img = img.convert("RGB")
            out = io.BytesIO()
            img.save(out, _STRIPPABLE[mime], **({"quality": 95} if mime != "image/png" else {}))
            cleaned = out.getvalue()
            if sha256(cleaned) in seen_elsewhere and not any(f["code"] == "reused_file" for f in flags):
                flags.append({"code": "reused_file",
                              "message": "The identical image was already submitted on another case."})
            elif not any(f["code"] == "reused_file" for f in flags) and _informative(phash) and any(
                    _informative(other) and _hamming(phash, other) <= NEAR_DUPLICATE_BITS
                    for other in phashes_elsewhere):
                flags.append({"code": "similar_image",
                              "message": "A near-identical image (resized, recompressed or lightly edited) was "
                                         "already submitted on another case."})
        except (UnidentifiedImageError, OSError, ValueError):
            if convert_from_heic:
                mime = "image/heic"
            flags.append({"code": "unreadable_image", "message": "The image could not be read; metadata was not removed."})
    elif mime == "application/pdf":
        cleaned = _pdf(content, incident, flags)
    elif mime.startswith("image/") or mime.startswith("video/"):
        flags.append({"code": "metadata_kept",
                      "message": f"Metadata in {mime} files is not removed yet; it may identify the reporter."})
    return EvidenceCheck(cleaned, mime, flags, name, phash)
