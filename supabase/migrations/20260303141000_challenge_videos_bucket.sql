insert into storage.buckets (id, name, public)
values ('challenge-videos', 'challenge-videos', true)
on conflict (id) do update
set public = true;

drop policy if exists "challenge videos read" on storage.objects;
create policy "challenge videos read"
on storage.objects
for select
using (bucket_id = 'challenge-videos');

drop policy if exists "challenge videos insert" on storage.objects;
create policy "challenge videos insert"
on storage.objects
for insert
with check (
  bucket_id = 'challenge-videos'
  and auth.role() = 'authenticated'
);

drop policy if exists "challenge videos update" on storage.objects;
create policy "challenge videos update"
on storage.objects
for update
using (
  bucket_id = 'challenge-videos'
  and auth.uid() = owner
);

drop policy if exists "challenge videos delete" on storage.objects;
create policy "challenge videos delete"
on storage.objects
for delete
using (
  bucket_id = 'challenge-videos'
  and auth.uid() = owner
);
