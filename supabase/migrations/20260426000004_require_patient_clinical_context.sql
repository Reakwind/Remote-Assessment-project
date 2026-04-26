-- Enforce complete clinical context for new MVP cases and sessions.
-- Constraints are NOT VALID so legacy incomplete rows remain readable, while
-- new inserts/updates must carry the data needed for norm interpretation.

alter table patients
  alter column education_years drop default;

alter table sessions
  alter column education_years drop default;

alter table patients
  drop constraint if exists patients_phone_required_check,
  add constraint patients_phone_required_check
    check (phone is not null and btrim(phone) <> '') not valid,
  drop constraint if exists patients_date_of_birth_required_check,
  add constraint patients_date_of_birth_required_check
    check (date_of_birth is not null) not valid,
  drop constraint if exists patients_gender_required_check,
  add constraint patients_gender_required_check
    check (gender is not null and gender in ('male', 'female')) not valid,
  drop constraint if exists patients_language_required_check,
  add constraint patients_language_required_check
    check (language is not null and language in ('he')) not valid,
  drop constraint if exists patients_dominant_hand_required_check,
  add constraint patients_dominant_hand_required_check
    check (dominant_hand is not null and dominant_hand in ('right', 'left', 'ambidextrous')) not valid,
  drop constraint if exists patients_education_years_required_check,
  add constraint patients_education_years_required_check
    check (education_years is not null and education_years between 0 and 40) not valid;

alter table sessions
  drop constraint if exists sessions_patient_id_required_check,
  add constraint sessions_patient_id_required_check
    check (patient_id is not null) not valid,
  drop constraint if exists sessions_patient_age_years_required_check,
  add constraint sessions_patient_age_years_required_check
    check (patient_age_years is not null and patient_age_years between 60 and 130) not valid,
  drop constraint if exists sessions_patient_date_of_birth_required_check,
  add constraint sessions_patient_date_of_birth_required_check
    check (patient_date_of_birth is not null) not valid,
  drop constraint if exists sessions_patient_gender_required_check,
  add constraint sessions_patient_gender_required_check
    check (patient_gender is not null and patient_gender in ('male', 'female')) not valid,
  drop constraint if exists sessions_patient_dominant_hand_required_check,
  add constraint sessions_patient_dominant_hand_required_check
    check (patient_dominant_hand is not null and patient_dominant_hand in ('right', 'left', 'ambidextrous')) not valid,
  drop constraint if exists sessions_education_years_required_check,
  add constraint sessions_education_years_required_check
    check (education_years is not null and education_years between 0 and 40) not valid;

comment on constraint patients_date_of_birth_required_check on patients
  is 'New MVP cases require date of birth so age and norms can be calculated at session creation.';
comment on constraint sessions_patient_age_years_required_check on sessions
  is 'New MVP sessions snapshot exact patient age for standardized norm lookup.';
comment on column patients.education_years
  is 'Years of education used for standardized norm interpretation.';
