export type SessionStatus = 'pending' | 'in_progress' | 'completed' | 'awaiting_review';
export type MocaVersion = '8.1' | '8.2' | '8.3';

export interface Session {
  id: string;
  clinician_id: string;
  case_id: string;
  moca_version: MocaVersion;
  age_band: '60-69' | '70-79' | '80+';
  education_years: number;
  location_place: string;
  location_city: string;
  link_token: string;
  link_used_at: string | null;
  status: SessionStatus;
  created_at: string;
  started_at: string | null;
  completed_at: string | null;
}

export interface TaskResult {
  id: string;
  session_id: string;
  task_type: string;
  raw_data: any;
  created_at: string;
  updated_at: string;
}

export interface DBScoringReport {
  id: string;
  session_id: string;
  total_raw: number;
  total_adjusted: number;
  total_provisional: boolean;
  norm_percentile: number | null;
  norm_sd: number | null;
  pending_review_count: number;
  domains: any;
  completed_at: string;
  finalized_at?: string | null;
  finalized_by?: string | null;
}

export interface DrawingReview {
  id: string;
  session_id: string;
  task_id: 'moca-cube' | 'moca-clock' | 'moca-visuospatial';
  storage_path: string | null;
  signedUrl?: string | null;
  strokes_data: any[];
  clinician_score: number | null;
  clinician_notes: string | null;
  rubric_items: any;
  reviewed_at: string | null;
  created_at: string;
}

export interface ScoringItemReview {
  id: string;
  session_id: string;
  item_id: string;
  task_type: string;
  max_score: number;
  raw_data: any;
  clinician_score: number | null;
  clinician_notes: string | null;
  reviewed_at: string | null;
  reviewed_by: string | null;
  created_at: string;
  updated_at: string;
}
