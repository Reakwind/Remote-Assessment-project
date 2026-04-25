export interface ItemScore {
  taskId: string;
  score: number;
  max: number;
  needsReview: boolean;
  reviewReason?: 'drawing' | 'auto_score_failed';
  rawData?: unknown;
  aiConfidence?: never; // reserved — no AI scoring, see clinical priorities
}

export interface DomainScore {
  domain: string;
  raw: number;
  max: number;
  items: ItemScore[];
}

export interface ScoringReport {
  sessionId: string;
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
  sessionLocation?: { place: string; city: string };
}
