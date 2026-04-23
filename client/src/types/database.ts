/* eslint-disable @typescript-eslint/no-explicit-any */
export type SessionStatus = 'pending' | 'in_progress' | 'completed' | 'awaiting_review';

export interface Session {
  id: string;
  clinician_id: string;
  case_id: string;
  patient_id?: string | null;
  age_band: '60-64' | '65-69' | '70-74' | '75-79' | '80+';
  education_years: number | null;
  access_code?: string | null;
  assessment_type?: string;
  patient_phone?: string | null;
  sms_sent_at?: string | null;
  sms_delivery_error?: string | null;
  link_token: string;
  used?: boolean;
  status: SessionStatus;
  created_at: string;
  completed_at: string | null;
}

export interface TaskResult {
  id: string;
  session_id: string;
  task_name: string;
  raw_data: any;
  submitted_at: string;
}

export interface DBScoringReport {
  id: string;
  session_id: string;
  total_score: number | null;
  percentile: number | null;
  needs_review: boolean;
  subscores: any;
  auto_score_errors: any;
  computed_at: string;
}

export interface DrawingReview {
  id: string;
  session_id: string;
  task_name: 'cube' | 'clock' | 'trailMaking';
  storage_path: string | null;
  clinician_score: number | null;
  clinician_notes: string | null;
  reviewed_at: string | null;
  strokes_data: any;
}
