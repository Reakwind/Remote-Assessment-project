-- Current dashboard code still reads legacy scoring summary columns.

alter table scoring_reports
  add column if not exists total_score int,
  add column if not exists percentile int,
  add column if not exists needs_review boolean not null default true,
  add column if not exists subscores jsonb not null default '{}'::jsonb,
  add column if not exists auto_score_errors jsonb not null default '[]'::jsonb,
  add column if not exists computed_at timestamptz default now(),
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id);
