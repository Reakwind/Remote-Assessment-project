-- supabase/migrations/20260421000007_audio_storage.sql
insert into storage.buckets (id, name, public) 
values ('audio', 'audio', true)
on conflict (id) do nothing;

create policy "Public Access to Audio"
  on storage.objects for select
  using ( bucket_id = 'audio' );

create policy "Admin Write Access to Audio"
  on storage.objects for all
  using ( bucket_id = 'audio' )
  with check ( auth.role() = 'service_role' );
