-- The current MVP contract uses 8-digit patient-facing test numbers.
-- Keep this NOT VALID so legacy hosted 6-digit rows do not block deployment,
-- while PostgreSQL still enforces the 8-digit format for new or updated rows.

alter table public.sessions
  drop constraint if exists sessions_access_code_format;

alter table public.sessions
  add constraint sessions_access_code_format
  check (access_code is null or access_code ~ '^[0-9]{8}$') not valid;

comment on constraint sessions_access_code_format on public.sessions
  is 'Patient-facing MVP test numbers must be 8 digits for new or updated rows; not validated against legacy historical rows.';
