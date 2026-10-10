"""Tests for PDF export."""
import pytest
from unittest.mock import patch
from app.utils.pdf_generator import investigation_pdf


def test_pdf_generation_basic():
    """Test basic PDF generation."""
    pdf_bytes = investigation_pdf(
        title="Test Report",
        sections=[("Section 1", "Content 1"), ("Section 2", "Content 2")],
        manifest=[{"file": "evidence1.txt", "sha256": "abc123"}],
    )

    assert pdf_bytes
    assert pdf_bytes.startswith(b"%PDF")  # PDF magic number
    assert len(pdf_bytes) > 100


def test_pdf_generation_with_long_content():
    """Test PDF generation with content that wraps pages."""
    long_text = "\n".join([f"Line {i}" for i in range(100)])

    pdf_bytes = investigation_pdf(
        title="Long Report",
        sections=[("Long Section", long_text)],
        manifest=[],
    )

    assert pdf_bytes.startswith(b"%PDF")
    assert len(pdf_bytes) > 1000


def test_pdf_generation_empty_sections():
    """Test PDF generation with empty sections."""
    pdf_bytes = investigation_pdf(
        title="Empty Report",
        sections=[],
        manifest=[],
    )

    assert pdf_bytes.startswith(b"%PDF")


def test_pdf_contains_manifest():
    """Test that evidence manifest is included."""
    pdf_bytes = investigation_pdf(
        title="Report with Evidence",
        sections=[("Title", "Content")],
        manifest=[{"file": "doc.pdf", "sha256": "hash123", "size": 1024}],
        compress=False,
    )

    # Manifest section should be present
    assert b"Evidence manifest" in pdf_bytes or b"manifest" in pdf_bytes.lower()