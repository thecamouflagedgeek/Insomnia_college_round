export type CommitteePoolId =
  | 'whistleblowing_ethics'
  | 'posh_harassment'
  | 'discrimination_inclusion'
  | 'workplace_conduct'
  | 'independent_review';

export interface CommitteePoolInfo {
  id: CommitteePoolId;
  name: string;
  description: string;
  statutoryMandate: string;
}

export const COMMITTEE_POOLS: CommitteePoolInfo[] = [
  {
    id: 'whistleblowing_ethics',
    name: 'Whistleblowing & Ethics',
    description: 'Adjudicates corporate integrity disclosures, financial improprieties, and retaliation grievances.',
    statutoryMandate: 'Sarbanes-Oxley & Whistleblower Protection Act § 4.2'
  },
  {
    id: 'posh_harassment',
    name: 'POSH / Sexual Harassment',
    description: 'Specialized Internal Complaints Committee for gender-based harassment and hostile workplace allegations.',
    statutoryMandate: 'POSH Act Internal Committee Statutory Mandate'
  },
  {
    id: 'discrimination_inclusion',
    name: 'Discrimination & Inclusion',
    description: 'Investigates systemic inequities in hiring, promotion velocity, compensation tiers, and bias claims.',
    statutoryMandate: 'Equal Employment Opportunity Commission (EEOC) Compliance'
  },
  {
    id: 'workplace_conduct',
    name: 'General Workplace Conduct',
    description: 'Handles interpersonal disputes, bullying, managerial misconduct, and standard policy breaches.',
    statutoryMandate: 'Organizational Code of Conduct Oversight'
  },
  {
    id: 'independent_review',
    name: 'Independent Review Panel',
    description: 'External Ombudspersons and legal counsel designated solely for conflict adjudication and procedural appeals.',
    statutoryMandate: 'Independent Procedural Separation Guarantee'
  }
];

export type ConflictCategory =
  | 'hierarchy_direct'
  | 'personal_relationship'
  | 'prior_retaliation_involvement'
  | 'departmental_bias';

export type ChallengeStatus =
  | 'pending_independent_review'
  | 'approved_access_revoked'
  | 'rejected_assignment_maintained';

export interface CommitteeChallenge {
  id: string;
  complaintId: string;
  complaintTitle: string;
  poolId: CommitteePoolId;
  challengedMemberId: string;
  challengedMemberName: string;
  challengedMemberRole: string;
  conflictCategory: ConflictCategory;
  conflictDetails: string;
  submittedAt: string;
  status: ChallengeStatus;
  independentReviewerId?: string;
  decisionRationale?: string;
  decidedAt?: string;
  blockchainVerificationTx?: string;
}

export interface CommitteeMemberRecord {
  id: string;
  name: string;
  email: string;
  roleTitle: string;
  department: string;
  poolId: CommitteePoolId;
  currentWorkload: number;
  conflictRiskLevel: 'none' | 'low' | 'moderate' | 'high';
  isEligible: boolean;
  assignedCaseIds: string[];
  assignmentStatus: 'active_assigned' | 'available' | 'challenged' | 'recused_conflict';
}
