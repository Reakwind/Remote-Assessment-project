create table if not exists audit_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  session_id uuid references sessions(id) on delete set null,
  actor_type text not null check (actor_type in ('clinician', 'patient', 'system')),
  actor_user_id uuid references auth.users(id),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_audit_events_session_created
  on audit_events (session_id, created_at desc);

create index if not exists idx_audit_events_actor_created
  on audit_events (actor_user_id, created_at desc);

alter table audit_events enable row level security;

create policy "clinicians can read own session audit events"
  on audit_events for select
  using (
    exists (
      select 1 from sessions
      where sessions.id = audit_events.session_id
      and sessions.clinician_id = auth.uid()
    )
  );
