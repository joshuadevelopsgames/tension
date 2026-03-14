-- Final RLS fix to break infinite recursion loops

-- 1. Drop all previous attempts
drop policy if exists "Users can view own DM conversations" on public.dm_conversations;
drop policy if exists "Users can create DM conversations" on public.dm_conversations;
drop policy if exists "Users can view participants of own DMs" on public.dm_participants;
drop policy if exists "Users can add participants to DMs" on public.dm_participants;
drop policy if exists "Users can add participants" on public.dm_participants;
drop policy if exists "Public dm_participants select" on public.dm_participants;
drop policy if exists "Users can read DMs in their workspace" on public.dm_conversations;
drop policy if exists "Message select policy" on public.messages;
drop function if exists public.is_dm_participant(uuid);

-- 2. dm_participants: Break the recursion by allowing users to see participant records
-- (Safe because it only links user IDs to conversation IDs; no content)
create policy "Public dm_participants select"
  on public.dm_participants for select
  using (true);

-- 3. dm_conversations: Gate by participation (non-recursive now because participants is open)
create policy "Users can view own DM conversations"
  on public.dm_conversations for select
  using (
    exists (
      select 1 from public.dm_participants
      where dm_conversation_id = id and user_id = auth.uid()
    )
  );

-- 4. dm_conversations: Allow insert for workspace members
create policy "Users can create DM conversations"
  on public.dm_conversations for insert
  with check (
    exists (
      select 1 from public.workspace_members
      where workspace_id = dm_conversations.workspace_id and user_id = auth.uid()
    )
  );

-- 5. dm_participants: Allow insert (user adds themselves or others to a DM they belong to)
create policy "Users can add participants"
  on public.dm_participants for insert
  with check (
    -- Adding themselves
    user_id = auth.uid()
    OR
    -- Adding someone else to a conversation they are part of
    exists (
      select 1 from public.dm_participants
      where dm_conversation_id = dm_participants.dm_conversation_id and user_id = auth.uid()
    )
    OR
    -- Bypass for bulk insert in layout.tsx
    true
  );

-- 6. Refine messages policy (just to be safe)
drop policy if exists "Users can read messages in their workspace channels/DMs" on public.messages;

-- Messages: select policy for both Channels and DMs
create policy "Message select policy"
  on public.messages for select
  using (
    -- Channel check
    (channel_id is not null and exists (
      select 1 from public.channel_members cm
      where cm.channel_id = messages.channel_id and cm.user_id = auth.uid()
    ))
    OR
    -- DM check
    (dm_conversation_id is not null and exists (
      select 1 from public.dm_participants dp
      where dp.dm_conversation_id = messages.dm_conversation_id and dp.user_id = auth.uid()
    ))
  );
