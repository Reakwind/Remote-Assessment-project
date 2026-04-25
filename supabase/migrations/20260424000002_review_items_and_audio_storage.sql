-- Generic clinician review rows for non-drawing scorer failures, plus private audio storage.

create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create table if not exists scoring_item_reviews (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  item_id text not null,
  task_type text not null,
  max_score int not null check (max_score >= 0 and max_score <= 30),
  raw_data jsonb,
  clinician_score int check (clinician_score >= 0),
  clinician_notes text,
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, item_id)
);

create index if not exists idx_scoring_item_reviews_session
  on scoring_item_reviews (session_id);

create index if not exists idx_scoring_item_reviews_pending
  on scoring_item_reviews (session_id)
  where clinician_score is null;

alter table scoring_item_reviews enable row level security;

create policy "clinicians can read own scoring item reviews"
  on scoring_item_reviews for select
  using (
    exists (
      select 1 from sessions
      where sessions.id = scoring_item_reviews.session_id
      and sessions.clinician_id = auth.uid()
    )
  );

create trigger touch_scoring_item_reviews_updated_at
  before update on scoring_item_reviews
  for each row execute function touch_updated_at();

insert into storage.buckets (id, name, public)
values ('audio', 'audio', false)
on conflict (id) do update
set public = false;

create policy "Clinicians can read own audio"
  on storage.objects for select
  using (
    bucket_id = 'audio'
    and (storage.foldername(name))[1] in (
      select id::text from public.sessions where clinician_id = auth.uid()
    )
  );

create policy "Service role can manage audio"
  on storage.objects for all
  using (bucket_id = 'audio' and auth.role() = 'service_role')
  with check (bucket_id = 'audio' and auth.role() = 'service_role');
