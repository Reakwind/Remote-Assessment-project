-- Ensure the audio bucket remains private after the earlier MVP audio-storage migration.
drop policy if exists "Public Access to Audio" on storage.objects;
drop policy if exists "Admin Write Access to Audio" on storage.objects;

update storage.buckets
set public = false
where id = 'audio';
