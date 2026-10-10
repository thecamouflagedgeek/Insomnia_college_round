export type AuditVerificationStatus = 
  | 'verified_commitment'
  | 'verification_failed'
  | 'pending_verification'
  | 'unavailable_verification_service';

export interface AuditEvent {
  id: string;
  complaintId: string;
  eventType: 
    | 'complaint_sealed_zkp'
    | 'committee_assigned'
    | 'committee_challenged'
    | 'challenge_adjudicated_revoked'
    | 'reassignment_performed'
    | 'access_denied_attempt'
    | 'witness_invited'
    | 'witness_statement_recorded'
    | 'evidence_integrity_verified'
    | 'legal_export_compiled';
  timestamp: string;
  actorRef: string; // e.g. "Employee (ZK-Proof Verified)", "Independent Reviewer (Dr. Aris Thorne)", "Auth Daemon"
  details: string;
  sha256Proof: string;
  merkleRoot: string;
  blockNumber: number;
  txHash: string;
  verificationStatus: AuditVerificationStatus;
}
