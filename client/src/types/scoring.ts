export interface ItemScore {
  taskId: string;
  score: number;
  max: number;
  needsReview: boolean;
  reviewReason?: 'drawing' | 'rule_score_unavailable';
  rawData?: unknown;
  aiConfidence?: never;
}

export interface DomainScore {
  domain: string;
  raw: number;
  max: number;
  items: ItemScore[];
}

export interface ScoringReport {
  sessionId: string;
  mocaVersion: string;
  totalRaw: number;
  totalAdjusted: number;
  totalProvisional: boolean;
  educationYears: number;
  normPercentile: number | null;
  normSd: number | null;
  domains: DomainScore[];
  pendingReviewCount: number;
  completedAt: string;
}

export interface ScoringContext {
  sessionId: string;
  sessionDate: Date;
  educationYears: number;
  patientAge: number;
  mocaVersion?: string;
  sessionLocation?: { place?: string | null; city?: string | null };
}
