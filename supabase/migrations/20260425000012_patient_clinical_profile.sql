-- Patient/case clinical profile for assessment interpretation.
-- The case record owns demographics; sessions snapshot scoring-critical fields
-- at test creation time so later profile edits do not rewrite past scores.

alter table patients
  add column if not exists case_id text,
  add column if not exists gender text,
  add column if not exists language text not null default 'he',
  add column if not exists dominant_hand text,
  add column if not exists education_years smallint;

update patients
set case_id = full_name
where case_id is null;

update patients
set case_id = 'CASE-' || upper(left(replace(id::text, '-', ''), 12))
where case_id !~ '^[A-Za-z0-9][A-Za-z0-9_.-]{2,49}$';

with duplicates as (
  select
    id,
    row_number() over (partition by clinician_id, case_id order by created_at, id) as duplicate_rank
  from patients
)
update patients
set case_id = left(patients.case_id, 32) || '-' || upper(left(replace(patients.id::text, '-', ''), 12))
from duplicates
where patients.id = duplicates.id
  and duplicates.duplicate_rank > 1;

update patients
set full_name = case_id;

alter table patients
  alter column case_id set not null,
  alter column education_years set default 12;

update patients
set education_years = 12
where education_years is null;

alter table patients
  alter column education_years set not null;

alter table patients
  drop constraint if exists patients_case_id_format_check,
  add constraint patients_case_id_format_check
    check (case_id ~ '^[A-Za-z0-9][A-Za-z0-9_.-]{2,49}$'),
  drop constraint if exists patients_gender_check,
  add constraint patients_gender_check
    check (gender is null or gender in ('male', 'female')),
  drop constraint if exists patients_language_check,
  add constraint patients_language_check
    check (language in ('he')),
  drop constraint if exists patients_dominant_hand_check,
  add constraint patients_dominant_hand_check
    check (dominant_hand is null or dominant_hand in ('right', 'left', 'ambidextrous')),
  drop constraint if exists patients_education_years_check,
  add constraint patients_education_years_check
    check (education_years between 0 and 40);

create unique index if not exists patients_clinician_case_id_unique_idx
  on patients (clinician_id, case_id);

alter table sessions
  drop constraint if exists unique_case_id_per_clinician;

alter table sessions
  add column if not exists patient_age_years smallint,
  add column if not exists patient_date_of_birth date,
  add column if not exists patient_gender text,
  add column if not exists assessment_language text not null default 'he',
  add column if not exists patient_dominant_hand text;

alter table sessions
  drop constraint if exists sessions_patient_age_years_check,
  add constraint sessions_patient_age_years_check
    check (patient_age_years is null or patient_age_years between 0 and 130),
  drop constraint if exists sessions_patient_gender_check,
  add constraint sessions_patient_gender_check
    check (patient_gender is null or patient_gender in ('male', 'female')),
  drop constraint if exists sessions_assessment_language_check,
  add constraint sessions_assessment_language_check
    check (assessment_language in ('he')),
  drop constraint if exists sessions_patient_dominant_hand_check,
  add constraint sessions_patient_dominant_hand_check
    check (patient_dominant_hand is null or patient_dominant_hand in ('right', 'left', 'ambidextrous'));

comment on column patients.case_id is 'Clinician-entered pseudonymous case ID.';
comment on column patients.phone is 'Patient phone number for clinician reference/contact.';
comment on column patients.date_of_birth is 'Patient date of birth; exact age is calculated server-side when creating a session.';
comment on column patients.gender is 'Patient gender for clinical interpretation.';
comment on column patients.language is 'Primary assessment language. MVP supports Hebrew only.';
comment on column patients.dominant_hand is 'Patient dominant hand for clinical interpretation.';
comment on column patients.education_years is 'Years of education used for standardized interpretation and education correction.';
comment on column sessions.patient_age_years is 'Snapshot of age in years at session creation.';
comment on column sessions.assessment_language is 'Assessment language selected for this session.';
