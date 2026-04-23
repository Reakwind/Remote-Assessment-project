-- Stimuli Storage Setup
insert into storage.buckets (id, name, public)
values ('stimuli', 'stimuli', false)
on conflict (id) do update
set public = excluded.public;

-- RLS for Storage (private read, service-role write only)
drop policy if exists "Public Access to Stimuli" on storage.objects;
drop policy if exists "Admin Write Access to Stimuli" on storage.objects;

create policy "Service role read access to Stimuli"
  on storage.objects for select
  using (bucket_id = 'stimuli' and auth.role() = 'service_role');

create policy "Service role write access to Stimuli"
  on storage.objects for all
  using (bucket_id = 'stimuli' and auth.role() = 'service_role')
  with check (bucket_id = 'stimuli' and auth.role() = 'service_role');
