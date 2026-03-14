-- Allow workspace members to create DM conversations
create policy "Workspace members can create DM conversations"
  on public.dm_conversations for insert
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = dm_conversations.workspace_id and wm.user_id = auth.uid()
    )
  );

-- Enable RLS on dm_participants
alter table public.dm_participants enable row level security;

-- Users can see participants in DMs they are part of
create policy "Users can read DM participants for their conversations"
  on public.dm_participants for select
  using (
    exists (
      select 1 from public.dm_participants dp2
      where dp2.dm_conversation_id = dm_participants.dm_conversation_id
        and dp2.user_id = auth.uid()
    )
  );

-- Users can add participants to DMs in their workspace
create policy "Users can add DM participants in their workspace"
  on public.dm_participants for insert
  with check (
    exists (
      select 1 from public.dm_conversations dc
      join public.workspace_members wm on wm.workspace_id = dc.workspace_id
      where dc.id = dm_participants.dm_conversation_id and wm.user_id = auth.uid()
    )
  );

-- Allow DM messages (messages with dm_conversation_id) to be inserted
-- (the existing message insert policy already covers this since it checks workspace_id)
-- No additional policy needed for messages themselves.
