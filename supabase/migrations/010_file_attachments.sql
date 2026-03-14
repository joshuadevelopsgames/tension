-- File attachments table
create table public.message_files (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  uploaded_by uuid not null references auth.users(id) on delete cascade,
  file_name text not null,
  file_size bigint not null,
  mime_type text not null,
  storage_path text not null,  -- path in Supabase storage
  public_url text not null,
  created_at timestamptz default now()
);

alter table public.message_files enable row level security;

-- Workspace members can read files
create policy "Workspace members can read files"
  on public.message_files for select
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = message_files.workspace_id and wm.user_id = auth.uid()
    )
  );

-- Users can insert their own files
create policy "Users can upload files"
  on public.message_files for insert
  with check (uploaded_by = auth.uid());

-- Create files storage bucket (run this manually in Supabase dashboard if needed)
-- The SQL below creates a policy entry but the bucket itself must be created in the dashboard
-- or via Supabase CLI with: supabase storage create files
