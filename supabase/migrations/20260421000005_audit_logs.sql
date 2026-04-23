-- supabase/migrations/20260421000005_audit_logs.sql

CREATE TABLE session_events (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID REFERENCES sessions(id) ON DELETE CASCADE,
  event_type VARCHAR(50) NOT NULL,
  actor_id UUID, -- Can be null if it's the patient via link_token
  old_data JSONB,
  new_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: Clinicians can only view logs for their own sessions. No one can update/delete.
ALTER TABLE session_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinicians can view audit logs" ON session_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM sessions
      WHERE sessions.id = session_events.session_id
      AND sessions.clinician_id = auth.uid()
    )
  );

CREATE POLICY "No one can modify audit logs" ON session_events
  FOR INSERT WITH CHECK (false);
CREATE POLICY "No one can update audit logs" ON session_events
  FOR UPDATE USING (false);
CREATE POLICY "No one can delete audit logs" ON session_events
  FOR DELETE USING (false);

-- Trigger Function
CREATE OR REPLACE FUNCTION log_session_event()
RETURNS TRIGGER AS $$
DECLARE
  v_event_type VARCHAR(50);
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_event_type := TG_TABLE_NAME || '_created';
    INSERT INTO session_events (session_id, event_type, actor_id, new_data)
    VALUES (
      CASE WHEN TG_TABLE_NAME = 'sessions' THEN NEW.id ELSE NEW.session_id END,
      v_event_type,
      auth.uid(),
      row_to_json(NEW)
    );
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    v_event_type := TG_TABLE_NAME || '_updated';
    INSERT INTO session_events (session_id, event_type, actor_id, old_data, new_data)
    VALUES (
      CASE WHEN TG_TABLE_NAME = 'sessions' THEN NEW.id ELSE NEW.session_id END,
      v_event_type,
      auth.uid(),
      row_to_json(OLD),
      row_to_json(NEW)
    );
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Attach to tables
CREATE TRIGGER audit_sessions_trigger
  AFTER INSERT OR UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION log_session_event();

CREATE TRIGGER audit_task_results_trigger
  AFTER INSERT OR UPDATE ON task_results
  FOR EACH ROW EXECUTE FUNCTION log_session_event();

CREATE TRIGGER audit_drawing_reviews_trigger
  AFTER UPDATE ON drawing_reviews
  FOR EACH ROW EXECUTE FUNCTION log_session_event();
