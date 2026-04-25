alter table sessions
  add column if not exists moca_version text not null default '8.3';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'sessions_moca_version_check'
  ) then
    alter table sessions
      add constraint sessions_moca_version_check
      check (moca_version in ('8.1', '8.2', '8.3'));
  end if;
end $$;
