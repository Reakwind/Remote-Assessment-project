-- Keep older local clinician tables compatible with the current profile flow.

alter table clinicians
  add column if not exists email text,
  add column if not exists full_name text,
  add column if not exists phone text,
  add column if not exists updated_at timestamptz default now();

alter table clinicians
  alter column clinic_name drop not null;
