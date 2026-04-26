-- Allow repeat assessments for the same clinician case.
--
-- Case IDs identify a patient/case record, not a one-time session. A clinician
-- must be able to order follow-up tests for the same case over time.

alter table sessions
  drop constraint if exists unique_case_id_per_clinician,
  drop constraint if exists sessions_clinician_id_case_id_key;

drop index if exists sessions_clinician_id_case_id_key;

create index if not exists idx_sessions_clinician_case_created
  on sessions (clinician_id, case_id, created_at desc);
