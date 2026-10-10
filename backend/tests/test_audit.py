from app.services.audit_service import AuditChain, verify_chain
from app.utils.encryption import encrypt, decrypt
from app.services.witness_service import create_invitation_token, validate_invitation_token
from app.services.evidence_service import validate_evidence
from app.engines import claim_integrity, severity_assessment, complaint_classifier, incident_correlation, repeat_allegations

def test_audit_chain_verifies_and_detects_tampering():
    chain = AuditChain(); chain.append({"action":"created", "synthetic":True}); chain.append({"action":"viewed", "synthetic":True})
    assert verify_chain(chain.events)
    altered = [dict(row) for row in chain.events]; altered[0] = {**altered[0], "event":{"action":"changed"}}
    assert not verify_chain(altered)

def test_encryption_round_trip_and_authentication():
    key = b"x" * 32; token = encrypt(b"synthetic complaint", key, b"report-1")
    assert decrypt(token, key, b"report-1") == b"synthetic complaint"
    try: decrypt(token, key, b"wrong-report")
    except ValueError: pass
    else: assert False, "wrong AAD must fail"

def test_witness_token_is_hashed_and_expires():
    token, digest = create_invitation_token()
    assert token != digest and validate_invitation_token(token, digest, 200, now=100)
    assert not validate_invitation_token(token, digest, 100, now=100)
    assert not validate_invitation_token("wrong", digest, 200, now=100)

def test_evidence_validation_checks_mime_extension_and_signature():
    good = validate_evidence("note.txt", "text/plain", b"Synthetic only")
    assert good.size == 14
    try: validate_evidence("note.pdf", "application/pdf", b"not pdf")
    except ValueError: pass
    else: assert False, "mismatched PDF must fail"

def test_baseline_engines_are_advisory():
    assert claim_integrity.assess("Title", "Some report narrative", "safety").accepted_for_review
    assert severity_assessment.assess("I received a threat").level == "critical"
    assert severity_assessment.assess("A scheduling concern").human_review_required
    assert complaint_classifier.classify("harassment")["human_review_required"]
    assert incident_correlation.similarity("unsafe office", "unsafe office") ["score"] == 1.0
    assert repeat_allegations.possible_repeat("opaque-1", {"opaque-1"})["human_review_required"]
