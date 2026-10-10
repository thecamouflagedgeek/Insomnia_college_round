// Shapes returned by the integrated backend's M3-engine endpoints (backend/app/stub/hr.py).

export interface RepeatSubjectCluster {
  subjectRef: string; // opaque hash; the directory reference never leaves the server
  caseIds: string[];
  count: number;
  categories: string[];
  basis: 'structured_reference';
  human_review_required: boolean;
}

export interface CorrelatedPair {
  caseIds: [string, string];
  score: number;
  method: string;
}

export interface PatternReport {
  repeatSubjects: RepeatSubjectCluster[];
  correlatedPairs: CorrelatedPair[];
  limitation: string;
}

export interface RelatedCases {
  case_id: string;
  similar: Array<{ case_id: string; score: number; method: string; limitation: string }>;
  repeat: { possible_repeat: boolean; basis: string; case_ids: string[]; limitation: string };
}

export type ResolutionOutcome =
  | 'substantiated'
  | 'partially_substantiated'
  | 'not_substantiated'
  | 'resolved_informally';

export interface CaseResolution {
  resolution_id: string;
  outcome: ResolutionOutcome;
  summary: string;
  actions: string[];
  by: string;
  at: string;
}

export interface ReflectReformInsights {
  resolvedCases: number;
  outcomes: Record<string, number>;
  reformActions: Array<{ action: string; count: number }>;
  minimumResponses: number;
  suppressed: boolean;
  responses: number | null;
  averageFairness?: number;
  feltSafePct?: number;
  wouldReportAgainPct?: number;
}
