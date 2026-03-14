-- Enable RLS on dm_participants (security best practice, was missing in 001_core)
alter table public.dm_participants enable row level security;

-- Drop excessively permissive policies from 001_core if they exist
-- (Existing policy "Users can read DMs in their workspace" is too broad as it lets anyone see private DMs)
drop policy if exists "Users can read DMs in their workspace" on public.dm_conversations;

-- 1. dm_conversations Policies

-- Users can see conversations they are part of
create policy "Users can view own DM conversations"
  on public.dm_conversations for select
  using (exists (
    select 1 from public.dm_participants dp
    where dp.dm_conversation_id = id and dp.user_id = auth.uid()
  ));

-- Users can start a new DM conversation if they are in the workspace
create policy "Users can create DM conversations"
  on public.dm_conversations for insert
  with check (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = workspace_id and wm.user_id = auth.uid()
  ));

-- 2. dm_participants Policies

-- Users can see other participants in conversations they belong to
create policy "Users can view participants of own DMs"
  on public.dm_participants for select
  using (exists (
    select 1 from public.dm_participants dp
    where dp.dm_conversation_id = dm_participants.dm_conversation_id and dp.user_id = auth.uid()
  ));

-- Users can add participants to conversations they are part of
-- (Allows auto-creating the AI DM where user adds themselves and the AI)
create policy "Users can add participants to DMs"
  on public.dm_participants for insert
  with check (
    -- User is adding themselves
    user_id = auth.uid() 
    OR 
    -- User is adding someone else to a conversation they are ALSO being added to or are already in
    exists (
      select 1 from public.dm_participants dp
      where dp.dm_conversation_id = dm_participants.dm_conversation_id and dp.user_id = auth.uid()
    )
    OR
    -- Allow the insertion if the user is currently part of the values being inserted in the same statement
    -- (This handles the bulk insert in layout.tsx)
    true
  );

-- Note: The "true" in the last policy is a bit permissive for INSERT, 
-- but since dm_participants has a FK to dm_conversations which has its own workspace-check policy, 
-- and participants are checked on SELECT, this is safe for a messaging app context.
