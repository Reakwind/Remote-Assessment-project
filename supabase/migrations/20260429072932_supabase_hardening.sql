-- Harden legacy public Supabase surfaces that are not part of the current MVP
-- app contract. Browser and patient flows use Edge Functions, not public RPCs.

drop view if exists public.tasks_pending_review;
drop view if exists public.session_summary;

drop function if exists public.validate_link_token(uuid);
drop function if exists public.mark_session_started(uuid);
drop function if exists public.mark_session_completed(uuid);
drop function if exists public.recalculate_total_score(uuid);

drop trigger if exists trigger_create_clinician_profile_for_auth_user on auth.users;
drop function if exists public.create_clinician_profile_for_auth_user();

create or replace function public.log_session_event()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
declare
  v_session_id uuid;
begin
  if tg_table_name = 'sessions' then
    v_session_id := new.id;
  else
    v_session_id := new.session_id;
  end if;

  if tg_op = 'INSERT' then
    insert into public.session_events (session_id, event_type, actor_id, new_data)
    values (v_session_id, tg_table_name || '_created', auth.uid(), row_to_json(new));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.session_events (session_id, event_type, actor_id, old_data, new_data)
    values (v_session_id, tg_table_name || '_updated', auth.uid(), row_to_json(old), row_to_json(new));
    return new;
  end if;

  return null;
end;
$$;

create or replace function public.create_clinician_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = pg_catalog, public
as $$
begin
  insert into public.clinicians (
    id,
    email,
    full_name,
    clinic_name,
    phone
  )
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      nullif(new.raw_user_meta_data->>'full_name', ''),
      nullif(new.raw_user_meta_data->>'fullName', ''),
      new.email,
      'Clinician'
    ),
    nullif(
      coalesce(
        new.raw_user_meta_data->>'clinic_name',
        new.raw_user_meta_data->>'clinicName'
      ),
      ''
    ),
    nullif(
      coalesce(
        new.raw_user_meta_data->>'phone',
        new.raw_user_meta_data->>'phoneNumber'
      ),
      ''
    )
  )
  on conflict (id) do update
    set
      email = excluded.email,
      full_name = excluded.full_name,
      clinic_name = excluded.clinic_name,
      phone = excluded.phone,
      updated_at = now();

  return new;
end;
$$;

revoke execute on function public.log_session_event() from public, anon, authenticated;
revoke execute on function public.create_clinician_profile_from_auth_user() from public, anon, authenticated;

update storage.buckets
set
  public = false,
  file_size_limit = 10485760,
  allowed_mime_types = array['image/png']::text[]
where id = 'stimuli';

update storage.buckets
set
  public = false,
  file_size_limit = 6291456,
  allowed_mime_types = array['image/png']::text[]
where id = 'drawings';

update storage.buckets
set
  public = false,
  file_size_limit = 20971520,
  allowed_mime_types = array[
    'audio/webm',
    'audio/ogg',
    'audio/mp4',
    'audio/mpeg',
    'audio/wav',
    'audio/x-wav'
  ]::text[]
where id = 'audio';
