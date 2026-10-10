export type WitnessResponseStatus = 'pending' | 'accepted' | 'declined';

export interface WitnessInvitation {
  id: string;
  complaintId: string;
  anonymousAlias: string; // e.g. "Witness Alpha", "Witness Beta"
  invitedAt: string;
  status: WitnessResponseStatus;
  respondedAt?: string;
  statementProvided: boolean;
  statementLengthWords?: number;
  encryptedStatementRef?: string;
  witnessCode?: string; // returned once on invite; share with the witness out of band
}

export interface WitnessQuorumSummary {
  complaintId: string;
  totalInvited: number;
  accepted: number;
  declined: number;
  pending: number;
  statementsSubmitted: number;
  quorumMet: boolean; // Voluntary quorum milestone: 2 or more corroborated statements
}
