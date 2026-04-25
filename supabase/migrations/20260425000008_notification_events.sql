create table if not exists notification_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references sessions(id) on delete cascade,
  notification_type text not null,
  channel text not null check (channel in ('email', 'sms')),
  provider text not null,
  status text not null check (status in ('sent', 'skipped', 'failed')),
  recipient text,
  provider_message_id text,
  attempts integer not null default 1 check (attempts >= 0),
  error_message text,
  next_retry_at timestamptz,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (session_id, notification_type, channel)
);

create index if not exists idx_notification_events_session_created
  on notification_events (session_id, created_at desc);

create index if not exists idx_notification_events_retry
  on notification_events (status, next_retry_at)
  where status = 'failed';

alter table notification_events enable row level security;

drop policy if exists "clinicians can read own session notification events" on notification_events;
create policy "clinicians can read own session notification events"
  on notification_events for select
  using (
    exists (
      select 1 from sessions
      where sessions.id = notification_events.session_id
      and sessions.clinician_id = auth.uid()
    )
  );

drop policy if exists "service role full access to notification events" on notification_events;
create policy "service role full access to notification events"
  on notification_events for all
  using (auth.jwt()->>'role' = 'service_role')
  with check (auth.jwt()->>'role' = 'service_role');

create or replace function set_notification_events_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trigger_notification_events_updated_at on notification_events;
create trigger trigger_notification_events_updated_at
  before update on notification_events
  for each row
  execute function set_notification_events_updated_at();
