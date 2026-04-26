-- Re-assert private audio storage policies with a fresh migration version so
-- existing local databases drop permissive legacy policies even if an earlier
-- cleanup migration was already marked applied.
drop policy if exists "Public Access to Audio" on storage.objects;
drop policy if exists "Admin Write Access to Audio" on storage.objects;

update storage.buckets
set public = false
where id = 'audio';
