-- Track patient test-number start attempts for rate limiting and audit review.
-- Store hashed IP/test-number fingerprints only; do not store raw test numbers or IP addresses.
create table if not exists patient_start_attempts (
  id uuid primary key default uuid_generate_v4(),
  ip_hash text not null,
  access_code_hash text,
  success boolean not null default false,
  failure_reason text,
  session_id uuid references sessions(id) on delete set null,
  created_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb
);

alter table patient_start_attempts enable row level security;

create index if not exists idx_patient_start_attempts_ip_created
  on patient_start_attempts (ip_hash, created_at desc);

create index if not exists idx_patient_start_attempts_code_created
  on patient_start_attempts (access_code_hash, created_at desc)
  where access_code_hash is not null;

create index if not exists idx_patient_start_attempts_session_created
  on patient_start_attempts (session_id, created_at desc)
  where session_id is not null;

drop policy if exists "service role full access to patient start attempts" on patient_start_attempts;
create policy "service role full access to patient start attempts"
  on patient_start_attempts
  for all
  using (auth.role() = 'service_role')
  with check (auth.role() = 'service_role');

comment on table patient_start_attempts is 'Hashed patient test-number start attempts used for rate limiting and operational audit.';
comment on column patient_start_attempts.ip_hash is 'HMAC/SHA-256 fingerprint of the client IP or source marker.';
comment on column patient_start_attempts.access_code_hash is 'HMAC/SHA-256 fingerprint of the submitted patient test number.';
