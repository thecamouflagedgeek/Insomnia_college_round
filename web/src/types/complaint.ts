import { CaseResolution } from './intelligence';

export type ComplaintCategory =
  | 'sexual_harassment'
  | 'bullying_authority_abuse'
  | 'discrimination'
  | 'whistleblowing_bribery'
  | 'workplace_retaliation';

export type SeverityLevel = 'critical' | 'high' | 'medium' | 'low';

export type ComplaintStatus =
  | 'submitted'
  | 'committee_assigned'
  | 'under_challenge'
  | 'reassignment_pending'
  | 'investigation_active'
  | 'witness_quorum_active'
  | 'resolved'
  | 'archived';

export interface EvidenceFile {
  id: string;
  name: string;
  size: string;
  mimeType: string;
  sha256Hash: string;
  zkpCommitment: string;
  uploadTimestamp: string;
  verificationStatus: 'verified' | 'tampered' | 'pending';
  storagePath: string;
  /** Review cues from evidence intake (live backend only); never a verdict on authenticity. */
  integrityFlags?: { code: string; message: string }[];
}

export interface Complaint {
  id: string;
  anonymousToken: string; // e.g. "ZK-ANON-9014-X8"
  category: ComplaintCategory;
  severity: SeverityLevel;
  status: ComplaintStatus;
  title: string;
  summary: string;
  submittedAt: string;
  departmentScope: string;
  assignedInvestigatorId?: string;
  committeeMemberIds: string[];
  revokedMemberIds: string[];
  activeChallengeId?: string;
  evidence: EvidenceFile[];
  blockchainSealTx: string;
  zkpNullifierHash: string;
  witnessQuorumActive: boolean;
  requiredNextAction: string;
  // Integrated backend (M3 engines); absent in mock data
  categoryLabel?: string;
  severitySignals?: string[];
  integrityFlags?: string[];
  resolution?: CaseResolution | null;
  hasSubjectRef?: boolean;
}
