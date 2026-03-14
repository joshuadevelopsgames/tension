-- Add custom status message and timezone columns to public.users
alter table public.users
  add column if not exists status_emoji text,
  add column if not exists status_message text,
  add column if not exists timezone text;
