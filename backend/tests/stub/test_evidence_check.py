import io

from PIL import Image

from tests.stub.test_hr_api import as_, client, case  # noqa: F401  (fixtures)
from tests.stub.test_stub_api import auth, submit


def photo(taken: str, software: str = "", gps: bool = True) -> bytes:
    img, exif = Image.new("RGB", (32, 24), (200, 30, 30)), Image.Exif()
    exif[0x8769] = {0x9003: taken}                # DateTimeOriginal
    exif[0x0110] = "SM-A356E"                     # device model
    exif[0x013B] = "Jane Reporter"                # artist / author
    if software:
        exif[0x0131] = software
    if gps:
        exif[0x8825] = {1: "N", 2: (12.0, 58.0, 10.0), 3: "E", 4: (77.0, 35.0, 40.0)}
    out = io.BytesIO()
    img.save(out, "JPEG", exif=exif)
    return out.getvalue()


def upload(client, case_id, token, name, data, mime):
    r = client.post(f"/reports/{case_id}/evidence", headers=auth(token), files={"file": (name, data, mime)})
    assert r.status_code == 201, r.text
    return r.json()


def staff_evidence(client, case_id):
    return client.get(f"/hr/cases/{case_id}", headers=as_("usr_sarah")).json()["evidence"]


def test_photo_metadata_is_stripped_and_inconsistencies_flagged(client, case):
    case_id, token = case  # incident date 2026-10-09
    raw = photo("2026:01:02 09:15:00", software="Adobe Photoshop 26.1")
    up = upload(client, case_id, token, "desk.jpg", raw, "image/jpeg")
    assert "flags" not in up  # the reporter is never shown how evidence is assessed

    store = client.app.state.store.cases[case_id].evidence[-1]
    import base64
    stored = base64.b64decode(store.content_b64)
    assert stored != raw and stored.startswith(b"\xff\xd8")
    for leak in (b"SM-A356E", b"Jane Reporter", b"Photoshop", b"2026:01:02"):
        assert leak not in stored
    assert not Image.open(io.BytesIO(stored)).getexif()  # no EXIF at all, GPS included
    assert up["sha256"] == store.sha256  # the cleaned copy is what is sealed

    codes = {f["code"] for f in staff_evidence(client, case_id)[-1]["integrityFlags"]}
    assert codes == {"edited", "date_gap"}


def test_plain_photo_without_metadata_raises_no_flags(client, case):
    case_id, token = case
    out = io.BytesIO()
    Image.new("RGB", (8, 8)).save(out, "PNG")  # e.g. a screenshot: no metadata is normal
    upload(client, case_id, token, "shot.png", out.getvalue(), "image/png")
    assert staff_evidence(client, case_id)[-1]["integrityFlags"] == []


def test_type_mismatch_and_reuse_across_cases(client, case):
    case_id, token = case
    upload(client, case_id, token, "invoice.pdf", b"%PDF-1.7 fake body", "image/jpeg")
    first = staff_evidence(client, case_id)[-1]["integrityFlags"]
    assert {f["code"] for f in first} == {"type_mismatch", "unreadable_pdf"}

    raw = photo("2026:10:08 10:00:00", gps=False)
    upload(client, case_id, token, "a.jpg", raw, "image/jpeg")
    other = submit(client).json()
    upload(client, other["case_id"], other["case_token"], "b.jpg", raw, "image/jpeg")
    codes = {f["code"] for f in staff_evidence(client, other["case_id"])[-1]["integrityFlags"]}
    assert codes == {"reused_file"}


def test_reporter_downloads_only_their_own_cleaned_file(client, case):
    case_id, token = case
    raw = photo("2026:10:08 10:00:00")
    up = upload(client, case_id, token, "desk.jpg", raw, "image/jpeg")
    r = client.get(f"/reports/{case_id}/evidence/{up['evidence_id']}", headers=auth(token))
    assert r.status_code == 200 and r.headers["content-type"] == "image/jpeg"
    assert r.headers["x-content-sha256"] == up["sha256"] and b"SM-A356E" not in r.content
    assert r.headers["cache-control"] == "no-store"

    other = submit(client).json()
    assert client.get(f"/reports/{case_id}/evidence/{up['evidence_id']}",
                      headers=auth(other["case_token"])).status_code == 404  # another case's token
    assert client.get(f"/reports/{case_id}/evidence/{up['evidence_id']}").status_code == 401
    assert client.get(f"/reports/{case_id}/evidence/EVD-NOPE", headers=auth(token)).status_code == 404


def pdf_with(meta: dict) -> bytes:
    import pypdf
    w = pypdf.PdfWriter()
    w.add_blank_page(100, 100)
    w.add_metadata(meta)
    out = io.BytesIO()
    w.write(out)
    return out.getvalue()


def stored_bytes(client, case_id):
    import base64
    return base64.b64decode(client.app.state.store.cases[case_id].evidence[-1].content_b64)


def test_pdf_metadata_removed_and_flagged(client, case):
    case_id, token = case
    raw = pdf_with({"/Author": "Jane Reporter", "/Producer": "Adobe Photoshop 26",
                    "/CreationDate": "D:20260101090000+00'00'", "/ModDate": "D:20260301090000+00'00'"})
    upload(client, case_id, token, "payslip.pdf", raw, "application/pdf")
    stored = stored_bytes(client, case_id)
    assert stored.startswith(b"%PDF") and b"Jane Reporter" not in stored and b"Photoshop" not in stored
    codes = {f["code"] for f in staff_evidence(client, case_id)[-1]["integrityFlags"]}
    assert codes == {"edited", "pdf_modified", "date_gap"}


def test_heic_photo_converted_without_metadata(client, case):
    import pillow_heif
    case_id, token = case
    img = Image.new("RGB", (32, 24), (10, 120, 200))
    exif = Image.Exif()
    exif[0x0110] = "iPhone 17 Pro"
    out = io.BytesIO()
    pillow_heif.from_pillow(img).save(out, format="HEIF", exif=exif.tobytes())
    up = upload(client, case_id, token, "IMG_0042.HEIC", out.getvalue(), "image/heic")
    assert up["mime"] == "image/jpeg" and up["name"] == "IMG_0042.jpg"
    assert b"iPhone" not in stored_bytes(client, case_id)
    assert staff_evidence(client, case_id)[-1]["integrityFlags"] == []


def test_resized_copy_on_another_case_is_a_near_duplicate(client, case):
    case_id, token = case
    import random
    rnd = random.Random(7)
    base = Image.new("RGB", (16, 12))
    base.putdata([(rnd.randrange(256), rnd.randrange(256), rnd.randrange(256)) for _ in range(16 * 12)])
    base = base.resize((200, 150), Image.Resampling.BILINEAR)  # a detailed picture with real structure
    a, b = io.BytesIO(), io.BytesIO()
    base.save(a, "JPEG", quality=95)
    base.resize((120, 90)).save(b, "JPEG", quality=70)
    upload(client, case_id, token, "a.jpg", a.getvalue(), "image/jpeg")
    other = submit(client).json()
    upload(client, other["case_id"], other["case_token"], "b.jpg", b.getvalue(), "image/jpeg")
    codes = {f["code"] for f in staff_evidence(client, other["case_id"])[-1]["integrityFlags"]}
    assert codes == {"similar_image"}

    different = io.BytesIO()
    rnd2 = random.Random(99)
    other_pic = Image.new("RGB", (16, 12))
    other_pic.putdata([(rnd2.randrange(256), rnd2.randrange(256), rnd2.randrange(256)) for _ in range(16 * 12)])
    other_pic.resize((120, 90), Image.Resampling.BILINEAR).save(different, "JPEG")
    upload(client, other["case_id"], other["case_token"], "c.jpg", different.getvalue(), "image/jpeg")
    assert staff_evidence(client, other["case_id"])[-1]["integrityFlags"] == []


def test_content_credentials_declaring_ai_are_flagged(client, case, monkeypatch):
    import json
    from app.stub import evidence_check

    class FakeReader:
        def __init__(self, mime, stream):
            pass

        def json(self):
            return json.dumps({"manifests": {"m": {"assertions": [{"label": "c2pa.actions", "data": {"actions": [{
                "action": "c2pa.created", "digitalSourceType":
                "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia"}]}}]}}})

    monkeypatch.setattr(evidence_check.c2pa, "Reader", FakeReader)
    case_id, token = case
    upload(client, case_id, token, "gen.jpg", photo("2026:10:08 10:00:00", gps=False), "image/jpeg")
    codes = {f["code"] for f in staff_evidence(client, case_id)[-1]["integrityFlags"]}
    assert codes == {"ai_generated_declared"}


def test_staff_open_evidence_with_case_access_and_it_is_audited(client, case):
    from tests.stub.test_stub_api import wait_verified
    case_id, token = case
    up = upload(client, case_id, token, "desk.jpg", photo("2026:10:08 10:00:00"), "image/jpeg")
    url = f"/hr/cases/{case_id}/evidence/{up['evidence_id']}/file"
    r = client.get(url, headers=as_("usr_elena"))
    assert r.status_code == 200 and r.headers["x-content-sha256"] == up["sha256"] and b"SM-A356E" not in r.content
    assert client.get(url, headers=as_("usr_priya")).status_code == 403  # not on this committee
    viewed = [e for e in wait_verified(client, case_id, token)["events"] if e["event_type"] == "evidence_viewed"]
    assert len(viewed) == 1
    audit = client.get(f"/hr/audit?case_id={case_id}", headers=as_("usr_sarah")).json()
    assert any("Elena Rostova" in e["actorRef"] and up["evidence_id"] in e["details"] for e in audit)


def test_blank_images_are_never_called_near_duplicates(client, case):
    case_id, token = case
    a, b = io.BytesIO(), io.BytesIO()
    Image.new("RGB", (300, 600), (255, 255, 255)).save(a, "PNG")
    Image.new("RGB", (300, 600), (250, 250, 250)).save(b, "PNG")
    upload(client, case_id, token, "blank1.png", a.getvalue(), "image/png")
    other = submit(client).json()
    upload(client, other["case_id"], other["case_token"], "blank2.png", b.getvalue(), "image/png")
    assert staff_evidence(client, other["case_id"])[-1]["integrityFlags"] == []
