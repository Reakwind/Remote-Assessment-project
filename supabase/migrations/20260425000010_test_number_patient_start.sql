-- Patient start is driven by a clinician-shared test number for MVP.
-- SMS delivery is out of scope; access_code is the patient-facing test number.

create unique index if not exists sessions_active_access_code_unique_idx
  on sessions (access_code)
  where access_code is not null and status in ('pending', 'in_progress');

comment on column sessions.access_code is 'Patient-facing test number for MVP start flow.';
comment on column sessions.patient_phone is 'Legacy optional contact field; SMS delivery is not part of MVP.';
