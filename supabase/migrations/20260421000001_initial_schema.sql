-- Remote Check MoCA Platform - Pilot MVP schema

create extension if not exists "pgcrypto";

create table clinicians (
  id uuid primary key references auth.users(id) on delete cascade,
  clinic_name text not null,
  created_at timestamptz not null default now()
);

create table sessions (
  id uuid primary key default gen_random_uuid(),
  clinician_id uuid not null references clinicians(id) on delete restrict,
  case_id text not null,
  moca_version text not null default '8.3' check (moca_version in ('8.1', '8.2', '8.3')),
  age_band text not null check (age_band in ('60-69', '70-79', '80+')),
  education_years int not null check (education_years >= 0 and education_years <= 40),
  location_place text not null,
  location_city text not null,
  link_token uuid unique not null default gen_random_uuid(),
  link_used_at timestamptz,
  status text not null default 'pending'
    check (status in ('pending', 'in_progress', 'awaiting_review', 'completed')),
  created_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz,
  unique (clinician_id, case_id)
);

create table task_results (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  task_type text not null check (task_type in (
    'moca-visuospatial',
    'moca-cube',
    'moca-clock',
    'moca-naming',
    'moca-memory-learning',
    'moca-digit-span',
    'moca-vigilance',
    'moca-serial-7s',
    'moca-language',
    'moca-abstraction',
    'moca-delayed-recall',
    'moca-orientation-task'
  )),
  raw_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, task_type)
);

create table scoring_reports (
  id uuid primary key default gen_random_uuid(),
  session_id uuid unique not null references sessions(id) on delete cascade,
  total_raw int not null check (total_raw between 0 and 30),
  total_adjusted int not null check (total_adjusted between 0 and 30),
  total_provisional boolean not null default true,
  norm_percentile float,
  norm_sd float,
  pending_review_count int not null default 0,
  domains jsonb not null,
  completed_at timestamptz not null default now(),
  finalized_at timestamptz,
  finalized_by uuid references auth.users(id)
);

create table drawing_reviews (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  task_id text not null check (task_id in ('moca-visuospatial', 'moca-cube', 'moca-clock')),
  storage_path text,
  strokes_data jsonb not null default '[]'::jsonb,
  clinician_score int check (clinician_score >= 0),
  clinician_notes text,
  rubric_items jsonb,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, task_id)
);

create index idx_sessions_clinician_created on sessions (clinician_id, created_at desc);
create index idx_sessions_status on sessions (status);
create index idx_sessions_link_token_unused on sessions (link_token) where link_used_at is null;
create index idx_task_results_session on task_results (session_id);
create index idx_scoring_reports_session on scoring_reports (session_id);
create index idx_scoring_reports_pending on scoring_reports (pending_review_count) where total_provisional = true;
create index idx_drawing_reviews_session on drawing_reviews (session_id);
create index idx_drawing_reviews_pending on drawing_reviews (session_id) where clinician_score is null;

alter table clinicians enable row level security;
alter table sessions enable row level security;
alter table task_results enable row level security;
alter table scoring_reports enable row level security;
alter table drawing_reviews enable row level security;

create policy "clinicians can read own profile"
  on clinicians for select
  using (id = auth.uid());

create policy "clinicians can insert own profile"
  on clinicians for insert
  with check (id = auth.uid());

create policy "clinicians can update own profile"
  on clinicians for update
  using (id = auth.uid())
  with check (id = auth.uid());

create policy "clinicians can manage own sessions"
  on sessions for all
  using (clinician_id = auth.uid())
  with check (clinician_id = auth.uid());

create policy "clinicians can read own task results"
  on task_results for select
  using (
    exists (
      select 1 from sessions
      where sessions.id = task_results.session_id
      and sessions.clinician_id = auth.uid()
    )
  );

create policy "clinicians can read own scoring reports"
  on scoring_reports for select
  using (
    exists (
      select 1 from sessions
      where sessions.id = scoring_reports.session_id
      and sessions.clinician_id = auth.uid()
    )
  );

create policy "clinicians can update own scoring reports"
  on scoring_reports for update
  using (
    exists (
      select 1 from sessions
      where sessions.id = scoring_reports.session_id
      and sessions.clinician_id = auth.uid()
    )
  );

create policy "clinicians can read own drawing reviews"
  on drawing_reviews for select
  using (
    exists (
      select 1 from sessions
      where sessions.id = drawing_reviews.session_id
      and sessions.clinician_id = auth.uid()
    )
  );

create policy "clinicians can update own drawing reviews"
  on drawing_reviews for update
  using (
    exists (
      select 1 from sessions
      where sessions.id = drawing_reviews.session_id
      and sessions.clinician_id = auth.uid()
    )
  );

create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger touch_task_results_updated_at
  before update on task_results
  for each row execute function touch_updated_at();

create trigger touch_drawing_reviews_updated_at
  before update on drawing_reviews
  for each row execute function touch_updated_at();
