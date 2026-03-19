create table if not exists pinned_messages (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  message_id uuid not null references messages(id) on delete cascade,
  pinned_by uuid not null references auth.users(id),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(channel_id, message_id)
);

alter table pinned_messages enable row level security;

create policy "workspace members can view pins"
  on pinned_messages for select
  using (
    exists (
      select 1 from workspace_members
      where workspace_members.workspace_id = pinned_messages.workspace_id
        and workspace_members.user_id = auth.uid()
    )
  );

create policy "workspace members can pin messages"
  on pinned_messages for insert
  with check (
    exists (
      select 1 from workspace_members
      where workspace_members.workspace_id = pinned_messages.workspace_id
        and workspace_members.user_id = auth.uid()
    )
  );

create policy "pinners can unpin"
  on pinned_messages for delete
  using (pinned_by = auth.uid());
