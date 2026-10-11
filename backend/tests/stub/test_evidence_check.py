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
    assert {f["code"] for f in first} == {"type_mismatch", "metadata_kept"}

    raw = photo("2026:10:08 10:00:00", gps=False)
    upload(client, case_id, token, "a.jpg", raw, "image/jpeg")
    other = submit(client).json()
    upload(client, other["case_id"], other["case_token"], "b.jpg", raw, "image/jpeg")
    codes = {f["code"] for f in staff_evidence(client, other["case_id"])[-1]["integrityFlags"]}
    assert codes == {"reused_file"}
