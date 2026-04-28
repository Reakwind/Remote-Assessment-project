-- Create clinician profiles from Auth signup metadata so email-confirmation
-- signups do not depend on an unauthenticated browser insert.

create or replace function public.create_clinician_profile_from_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
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

drop trigger if exists trigger_create_clinician_profile_from_auth_user on auth.users;
create trigger trigger_create_clinician_profile_from_auth_user
  after insert on auth.users
  for each row
  execute function public.create_clinician_profile_from_auth_user();

insert into public.clinicians (
  id,
  email,
  full_name,
  clinic_name,
  phone
)
select
  users.id,
  coalesce(users.email, ''),
  coalesce(
    nullif(users.raw_user_meta_data->>'full_name', ''),
    nullif(users.raw_user_meta_data->>'fullName', ''),
    users.email,
    'Clinician'
  ),
  nullif(
    coalesce(
      users.raw_user_meta_data->>'clinic_name',
      users.raw_user_meta_data->>'clinicName'
    ),
    ''
  ),
  nullif(
    coalesce(
      users.raw_user_meta_data->>'phone',
      users.raw_user_meta_data->>'phoneNumber'
    ),
    ''
  )
from auth.users as users
where not exists (
  select 1
  from public.clinicians
  where clinicians.id = users.id
);
