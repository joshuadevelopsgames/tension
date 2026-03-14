-- Insert the avatars storage bucket
insert into storage.buckets (id, name, public, avif_autodetection)
values ('avatars', 'avatars', true, false)
on conflict (id) do update set public = true;

-- Allow public access to read all avatars
create policy "Avatar images are publicly accessible."
on storage.objects for select
to public
using (bucket_id = 'avatars');

-- Allow authenticated users to upload their own avatar
create policy "Users can upload their own avatar."
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'avatars' and
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to update their own avatar
create policy "Users can update their own avatar."
on storage.objects for update
to authenticated
using (
  bucket_id = 'avatars' and
  (storage.foldername(name))[1] = auth.uid()::text
);

-- Allow authenticated users to delete their own avatar
create policy "Users can delete their own avatar."
on storage.objects for delete
to authenticated
using (
  bucket_id = 'avatars' and
  (storage.foldername(name))[1] = auth.uid()::text
);
