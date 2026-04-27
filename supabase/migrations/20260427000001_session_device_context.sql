alter table sessions
  add column if not exists device_context jsonb not null default '{}'::jsonb;

alter table sessions
  drop constraint if exists sessions_device_context_object_check;

alter table sessions
  add constraint sessions_device_context_object_check
  check (jsonb_typeof(device_context) = 'object');

comment on column sessions.device_context is
  'Concise patient browser/device context captured when the patient starts a session.';
