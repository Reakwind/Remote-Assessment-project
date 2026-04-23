-- Patient records + session access code support

create table if not exists patients (
  id uuid primary key default uuid_generate_v4(),
  clinician_id uuid not null references auth.users(id) on delete cascade,
  full_name text not null,
  phone text not null,
  date_of_birth date,
  id_number text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table patients enable row level security;

drop policy if exists "Clinicians can insert own patients" on patients;
create policy "Clinicians can insert own patients"
  on patients
  for insert
  with check (auth.uid() = clinician_id);

drop policy if exists "Clinicians can view own patients" on patients;
create policy "Clinicians can view own patients"
  on patients
  for select
  using (auth.uid() = clinician_id);

drop policy if exists "Clinicians can update own patients" on patients;
create policy "Clinicians can update own patients"
  on patients
  for update
  using (auth.uid() = clinician_id);

drop policy if exists "Clinicians can delete own patients" on patients;
create policy "Clinicians can delete own patients"
  on patients
  for delete
  using (auth.uid() = clinician_id);

drop policy if exists "Service role full access to patients" on patients;
create policy "Service role full access to patients"
  on patients
  for all
  using (auth.jwt()->>'role' = 'service_role')
  with check (auth.jwt()->>'role' = 'service_role');

create or replace function set_patient_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_patients_updated_at on patients;
create trigger trigger_patients_updated_at
  before update on patients
  for each row
  execute function set_patient_updated_at();

alter table sessions add column if not exists patient_id uuid references patients(id) on delete set null;
alter table sessions add column if not exists access_code text;
alter table sessions add column if not exists assessment_type text not null default 'moca';

create index if not exists idx_patients_clinician_id on patients(clinician_id);
create index if not exists idx_sessions_patient_id on sessions(patient_id);
create index if not exists idx_sessions_access_code on sessions(access_code);
