-- Remote Check MoCA Platform - Database Schema
-- Target: Supabase PostgreSQL
-- Region: il-central-1 (Israel)
-- Last Updated: April 21, 2026

-- ============================================================================
-- EXTENSIONS
-- ============================================================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- TABLES
-- ============================================================================

-- Sessions: Core assessment session tracking
CREATE TABLE sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  case_id VARCHAR(50) NOT NULL,
  link_token UUID UNIQUE NOT NULL DEFAULT uuid_generate_v4(),
  used BOOLEAN DEFAULT FALSE,
  education_years INT DEFAULT 12,
  clinician_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  education_years SMALLINT CHECK (education_years BETWEEN 0 AND 40),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  age_band VARCHAR(10) CHECK (age_band IN ('60-64', '65-69', '70-74', '75-79', '80+')),
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed')),

  CONSTRAINT unique_case_id_per_clinician UNIQUE (clinician_id, case_id)
);

-- Task Results: Raw data from each assessment task
CREATE TABLE task_results (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  task_name VARCHAR(50) NOT NULL CHECK (task_name IN (
    'trailMaking',
    'cube',
    'clock',
    'naming',
    'memory',
    'digitSpan',
    'vigilance',
    'serial7',
    'language',
    'abstraction',
    'delayedRecall',
    'orientation'
  )),
  raw_data JSONB NOT NULL,
  submitted_at TIMESTAMPTZ DEFAULT NOW(),

  CONSTRAINT unique_task_per_session UNIQUE (session_id, task_name)
);

-- Scoring Reports: Computed scores and analysis
CREATE TABLE scoring_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID UNIQUE NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  total_score INTEGER CHECK (total_score BETWEEN 0 AND 30),
  subscores JSONB NOT NULL DEFAULT '{
    "visuospatial": 0,
    "naming": 0,
    "attention": 0,
    "language": 0,
    "abstraction": 0,
    "delayedRecall": 0,
    "orientation": 0
  }'::jsonb,
  percentile INTEGER CHECK (percentile BETWEEN 0 AND 100),
  needs_review BOOLEAN DEFAULT FALSE,
  auto_score_errors JSONB DEFAULT '[]'::jsonb,
  computed_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id)
);

-- Drawing Reviews: Clinician scoring for drawing tasks
CREATE TABLE drawing_reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  task_name VARCHAR(20) NOT NULL CHECK (task_name IN ('cube', 'clock', 'trailMaking')),
  storage_path TEXT,
  strokes_data JSONB NOT NULL,
  clinician_score INTEGER,
  rubric_items JSONB,
  clinician_notes TEXT,
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES auth.users(id),

  CONSTRAINT unique_drawing_per_session UNIQUE (session_id, task_name)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Sessions indexes
CREATE INDEX idx_sessions_clinician ON sessions(clinician_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_created_at ON sessions(created_at DESC);
CREATE INDEX idx_sessions_link_token ON sessions(link_token) WHERE used = FALSE;

-- Task results indexes
CREATE INDEX idx_task_results_session ON task_results(session_id);
CREATE INDEX idx_task_results_task_name ON task_results(task_name);

-- Scoring reports indexes
CREATE INDEX idx_scoring_needs_review ON scoring_reports(needs_review) WHERE needs_review = TRUE;
CREATE INDEX idx_scoring_session ON scoring_reports(session_id);

-- Drawing reviews indexes
CREATE INDEX idx_drawing_session ON drawing_reviews(session_id);
CREATE INDEX idx_drawing_task ON drawing_reviews(task_name);
CREATE INDEX idx_drawing_needs_review ON drawing_reviews(session_id) WHERE clinician_score IS NULL;

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE task_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE scoring_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE drawing_reviews ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- SESSIONS POLICIES
-- ============================================================================

-- Clinicians can view their own sessions
CREATE POLICY "Clinicians can view own sessions"
  ON sessions
  FOR SELECT
  USING (auth.uid() = clinician_id);

-- Clinicians can create sessions
CREATE POLICY "Clinicians can create sessions"
  ON sessions
  FOR INSERT
  WITH CHECK (auth.uid() = clinician_id);

-- Clinicians can update their own sessions
CREATE POLICY "Clinicians can update own sessions"
  ON sessions
  FOR UPDATE
  USING (auth.uid() = clinician_id);

-- Service role can access all sessions (for Edge Functions)
CREATE POLICY "Service role full access to sessions"
  ON sessions
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- TASK RESULTS POLICIES
-- ============================================================================

-- Clinicians can view task results for their sessions
CREATE POLICY "Clinicians can view task results"
  ON task_results
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = task_results.session_id
      AND sessions.clinician_id = auth.uid()
    )
  );

-- Service role can manage task results (for patient submissions via Edge Functions)
CREATE POLICY "Service role full access to task results"
  ON task_results
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- SCORING REPORTS POLICIES
-- ============================================================================

-- Clinicians can view scoring reports for their sessions
CREATE POLICY "Clinicians can view scoring reports"
  ON scoring_reports
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = scoring_reports.session_id
      AND sessions.clinician_id = auth.uid()
    )
  );

-- Clinicians can update scoring reports for their sessions
CREATE POLICY "Clinicians can update scoring reports"
  ON scoring_reports
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = scoring_reports.session_id
      AND sessions.clinician_id = auth.uid()
    )
  );

-- Service role can manage scoring reports
CREATE POLICY "Service role full access to scoring reports"
  ON scoring_reports
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- DRAWING REVIEWS POLICIES
-- ============================================================================

-- Clinicians can view drawing reviews for their sessions
CREATE POLICY "Clinicians can view drawing reviews"
  ON drawing_reviews
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = drawing_reviews.session_id
      AND sessions.clinician_id = auth.uid()
    )
  );

-- Clinicians can update drawing reviews for their sessions
CREATE POLICY "Clinicians can update drawing reviews"
  ON drawing_reviews
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = drawing_reviews.session_id
      AND sessions.clinician_id = auth.uid()
    )
  );

-- Service role can manage drawing reviews
CREATE POLICY "Service role full access to drawing reviews"
  ON drawing_reviews
  FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

-- ============================================================================
-- FUNCTIONS
-- ============================================================================

-- Function: Validate link token and return session
CREATE OR REPLACE FUNCTION validate_link_token(token UUID)
RETURNS TABLE (
  session_id UUID,
  is_valid BOOLEAN,
  error_message TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    s.id,
    CASE
      WHEN s.id IS NULL THEN FALSE
      WHEN s.used = TRUE THEN FALSE
      WHEN s.status = 'completed' THEN FALSE
      ELSE TRUE
    END AS is_valid,
    CASE
      WHEN s.id IS NULL THEN 'Link token not found'
      WHEN s.used = TRUE THEN 'Link token already used'
      WHEN s.status = 'completed' THEN 'Session already completed'
      ELSE NULL
    END AS error_message
  FROM sessions s
  WHERE s.link_token = token;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Mark session as started (first task submission)
CREATE OR REPLACE FUNCTION mark_session_started(p_session_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE sessions
  SET
    status = 'in_progress',
    started_at = COALESCE(started_at, NOW())
  WHERE id = p_session_id
  AND status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Mark session as completed
CREATE OR REPLACE FUNCTION mark_session_completed(p_session_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE sessions
  SET
    status = 'completed',
    completed_at = NOW(),
    used = TRUE
  WHERE id = p_session_id
  AND status != 'completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function: Recalculate total score after clinician review
CREATE OR REPLACE FUNCTION recalculate_total_score(p_session_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_total INTEGER := 0;
  v_drawing_scores RECORD;
BEGIN
  -- Get current subscore total
  SELECT
    COALESCE((subscores->>'visuospatial')::INTEGER, 0) +
    COALESCE((subscores->>'naming')::INTEGER, 0) +
    COALESCE((subscores->>'attention')::INTEGER, 0) +
    COALESCE((subscores->>'language')::INTEGER, 0) +
    COALESCE((subscores->>'abstraction')::INTEGER, 0) +
    COALESCE((subscores->>'delayedRecall')::INTEGER, 0) +
    COALESCE((subscores->>'orientation')::INTEGER, 0)
  INTO v_total
  FROM scoring_reports
  WHERE session_id = p_session_id;

  -- Note: Visuospatial subscore will be updated separately when drawings are reviewed
  -- This function just ensures total_score is synced with subscores

  UPDATE scoring_reports
  SET total_score = v_total
  WHERE session_id = p_session_id;

  RETURN v_total;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================================================
-- TRIGGERS
-- ============================================================================

-- Trigger: Auto-create scoring report when session is created
CREATE OR REPLACE FUNCTION create_scoring_report_for_session()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO scoring_reports (session_id)
  VALUES (NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_create_scoring_report
  AFTER INSERT ON sessions
  FOR EACH ROW
  EXECUTE FUNCTION create_scoring_report_for_session();

-- Trigger: Update reviewed timestamp when clinician scores a drawing
CREATE OR REPLACE FUNCTION update_drawing_review_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.clinician_score IS NOT NULL AND OLD.clinician_score IS NULL THEN
    NEW.reviewed_at := NOW();
    NEW.reviewed_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_drawing_review
  BEFORE UPDATE ON drawing_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_drawing_review_timestamp();

-- ============================================================================
-- STORAGE BUCKETS
-- ============================================================================

-- Note: Run this via Supabase Dashboard or CLI, not in this migration
-- INSERT INTO storage.buckets (id, name, public)
-- VALUES ('drawings', 'drawings', false);

-- Storage policy: Clinicians can view drawings for their sessions
-- CREATE POLICY "Clinicians can view own session drawings"
--   ON storage.objects
--   FOR SELECT
--   USING (
--     bucket_id = 'drawings' AND
--     (storage.foldername(name))[1] IN (
--       SELECT id::text FROM sessions WHERE clinician_id = auth.uid()
--     )
--   );

-- ============================================================================
-- SEED DATA (Development Only)
-- ============================================================================

-- Uncomment for local development with test data
/*
-- Create test clinician user (requires auth.users to exist)
-- INSERT INTO auth.users (id, email)
-- VALUES ('00000000-0000-0000-0000-000000000001', 'clinician@example.com')
-- ON CONFLICT DO NOTHING;

-- Create test session
INSERT INTO sessions (
  id,
  case_id,
  link_token,
  clinician_id,
  age_band,
  status
) VALUES (
  '11111111-1111-1111-1111-111111111111',
  'RC-2026-TEST',
  '22222222-2222-2222-2222-222222222222',
  '00000000-0000-0000-0000-000000000001',
  '60-64',
  'pending'
);
*/

-- ============================================================================
-- VIEWS (Useful for analytics)
-- ============================================================================

-- View: Session summary with scores
CREATE VIEW session_summary AS
SELECT
  s.id,
  s.case_id,
  s.age_band,
  s.status,
  s.created_at,
  s.started_at,
  s.completed_at,
  EXTRACT(EPOCH FROM (s.completed_at - s.started_at)) / 60 AS duration_minutes,
  sr.total_score,
  sr.percentile,
  sr.needs_review,
  COUNT(dr.id) AS drawing_tasks,
  COUNT(dr.id) FILTER (WHERE dr.clinician_score IS NOT NULL) AS drawings_reviewed
FROM sessions s
LEFT JOIN scoring_reports sr ON sr.session_id = s.id
LEFT JOIN drawing_reviews dr ON dr.session_id = s.id
GROUP BY s.id, s.case_id, s.age_band, s.status, s.created_at, s.started_at, s.completed_at, sr.total_score, sr.percentile, sr.needs_review;

-- View: Tasks pending clinician review
CREATE VIEW tasks_pending_review AS
SELECT
  s.id AS session_id,
  s.case_id,
  s.clinician_id,
  s.completed_at,
  sr.total_score,
  array_agg(dr.task_name) AS pending_drawings
FROM sessions s
JOIN scoring_reports sr ON sr.session_id = s.id
JOIN drawing_reviews dr ON dr.session_id = s.id
WHERE s.status = 'completed'
AND sr.needs_review = TRUE
AND dr.clinician_score IS NULL
GROUP BY s.id, s.case_id, s.clinician_id, s.completed_at, sr.total_score;

-- ============================================================================
-- COMMENTS (Documentation)
-- ============================================================================

COMMENT ON TABLE sessions IS 'Core assessment sessions with one-time link tokens';
COMMENT ON TABLE task_results IS 'Raw task data submitted by patients';
COMMENT ON TABLE scoring_reports IS 'Computed scores and percentiles';
COMMENT ON TABLE drawing_reviews IS 'Clinician review and scoring for drawing tasks';

COMMENT ON COLUMN sessions.link_token IS 'One-time UUID for patient session access';
COMMENT ON COLUMN sessions.used IS 'TRUE after session is completed or link is consumed';
COMMENT ON COLUMN sessions.age_band IS 'Age range (not exact age) for privacy';
COMMENT ON COLUMN scoring_reports.percentile IS 'Percentile based on Lifshitz 2012 Israeli norms';
COMMENT ON COLUMN drawing_reviews.strokes_data IS 'Full stroke array with points, timestamps, pressure';

-- ============================================================================
-- FINAL NOTES
-- ============================================================================

-- To apply this schema:
-- 1. Save as migrations/001_initial_schema.sql
-- 2. Run: supabase db push
-- 3. Or via Supabase Dashboard SQL Editor

-- To reset (DANGER - deletes all data):
-- DROP TABLE IF EXISTS drawing_reviews CASCADE;
-- DROP TABLE IF EXISTS scoring_reports CASCADE;
-- DROP TABLE IF EXISTS task_results CASCADE;
-- DROP TABLE IF EXISTS sessions CASCADE;

-- End of schema
