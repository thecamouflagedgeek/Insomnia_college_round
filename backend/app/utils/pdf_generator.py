from io import BytesIO
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas

def investigation_pdf(title: str, sections: list[tuple[str, str]], manifest: list[dict]) -> bytes:
    out = BytesIO(); pdf = canvas.Canvas(out, pagesize=letter); width, height = letter
    y = height - 54
    pdf.setTitle("Redacted Investigation Export")
    pdf.drawString(48, y, title[:140]); y -= 28
    for heading, text in sections:
        pdf.setFont("Helvetica-Bold", 11); pdf.drawString(48, y, heading[:100]); y -= 16
        pdf.setFont("Helvetica", 9)
        for line in text.splitlines():
            if y < 60: pdf.showPage(); y = height - 54
            pdf.drawString(48, y, line[:110]); y -= 12
    pdf.setFont("Helvetica-Bold", 11); pdf.drawString(48, y-8, "Evidence manifest"); y -= 24
    pdf.setFont("Helvetica", 8)
    for item in manifest:
        if y < 50: pdf.showPage(); y = height - 54
        # manifest must be redacted by caller; no signed URLs or personal data here.
        pdf.drawString(48, y, str(item)[:115]); y -= 11
    pdf.save(); return out.getvalue()
