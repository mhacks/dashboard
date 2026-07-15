-- Local-only storage seed. Runs on first `supabase start` and every `supabase db reset`.
-- Not applied to the remote database (remote schema uses drizzle-kit migrate).
-- Production resume storage uses AWS S3, not Supabase Storage.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resumes',
  'resumes',
  false,
  10485760,
  array['application/pdf']::text[]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;
