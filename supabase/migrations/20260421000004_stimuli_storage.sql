-- Stimuli Storage Setup
insert into storage.buckets (id, name, public) 
values ('stimuli', 'stimuli', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('drawings', 'drawings', false)
on conflict (id) do nothing;

-- RLS for Storage (Public Read, Admin Write)
create policy "Public Access to Stimuli"
  on storage.objects for select
  using ( bucket_id = 'stimuli' );

create policy "Admin Write Access to Stimuli"
  on storage.objects for all
  using ( bucket_id = 'stimuli' )
  with check ( auth.role() = 'service_role' );

create policy "Clinicians can read own drawings"
  on storage.objects for select
  using (
    bucket_id = 'drawings'
    and (storage.foldername(name))[1] in (
      select id::text from public.sessions where clinician_id = auth.uid()
    )
  );

create policy "Service role can manage drawings"
  on storage.objects for all
  using ( bucket_id = 'drawings' and auth.role() = 'service_role' )
  with check ( bucket_id = 'drawings' and auth.role() = 'service_role' );
