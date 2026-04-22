/* eslint-disable @typescript-eslint/no-explicit-any */
export type SessionStatus = 'pending' | 'in_progress' | 'completed' | 'awaiting_review';

export interface Session {
  id: string;
  clinician_id: string;
  case_id: string;
  age_band: '60-69' | '70-79' | '80+';
  education_years: number;
  location_place: string;
  location_city: string;
  link_token: string;
  link_used_at: string | null;
  status: SessionStatus;
  created_at: string;
  completed_at: string | null;
}

export interface TaskResult {
  id: string;
  session_id: string;
  task_type: string;
  raw_data: any;
  created_at: string;
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
}

export interface DrawingReview {
  id: string;
  session_id: string;
  task_id: 'moca-cube' | 'moca-clock' | 'moca-visuospatial';
  drawing_url: string;
  clinician_score: number | null;
  clinician_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
}
