-- Compatibility layer for the MVP E2E contract on top of the current mainline schema.

create extension if not exists pgcrypto;

create or replace function touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

alter table sessions
  add column if not exists location_place text,
  add column if not exists location_city text,
  add column if not exists link_used_at timestamptz;

alter table sessions drop constraint if exists sessions_status_check;
alter table sessions
  add constraint sessions_status_check
  check (status in ('pending', 'in_progress', 'awaiting_review', 'completed'));

alter table sessions drop constraint if exists sessions_age_band_check;
alter table sessions
  add constraint sessions_age_band_check
  check (age_band in ('60-64', '65-69', '70-74', '75-79', '60-69', '70-79', '80+'));

alter table task_results
  add column if not exists task_type text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'task_results' and column_name = 'task_name'
  ) then
    update task_results
    set task_type = case task_name
      when 'trailMaking' then 'moca-visuospatial'
      when 'cube' then 'moca-cube'
      when 'clock' then 'moca-clock'
      when 'naming' then 'moca-naming'
      when 'memory' then 'moca-memory-learning'
      when 'digitSpan' then 'moca-digit-span'
      when 'vigilance' then 'moca-vigilance'
      when 'serial7' then 'moca-serial-7s'
      when 'language' then 'moca-language'
      when 'abstraction' then 'moca-abstraction'
      when 'delayedRecall' then 'moca-delayed-recall'
      when 'orientation' then 'moca-orientation-task'
      else task_name
    end
    where task_type is null;
  end if;
end $$;

create unique index if not exists task_results_session_task_type_idx
  on task_results (session_id, task_type);

alter table task_results
  alter column task_type set not null;

alter table drawing_reviews
  add column if not exists task_id text;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'drawing_reviews' and column_name = 'task_name'
  ) then
    update drawing_reviews
    set task_id = case task_name
      when 'trailMaking' then 'moca-visuospatial'
      when 'cube' then 'moca-cube'
      when 'clock' then 'moca-clock'
      else task_name
    end
    where task_id is null;
  end if;
end $$;

create unique index if not exists drawing_reviews_session_task_id_idx
  on drawing_reviews (session_id, task_id);

alter table drawing_reviews
  alter column task_id set not null;

alter table scoring_reports
  add column if not exists total_raw int,
  add column if not exists total_adjusted int,
  add column if not exists total_provisional boolean not null default true,
  add column if not exists norm_percentile int,
  add column if not exists norm_sd numeric,
  add column if not exists pending_review_count int not null default 0,
  add column if not exists domains jsonb not null default '[]'::jsonb,
  add column if not exists completed_at timestamptz,
  add column if not exists finalized_at timestamptz,
  add column if not exists finalized_by uuid references auth.users(id);
