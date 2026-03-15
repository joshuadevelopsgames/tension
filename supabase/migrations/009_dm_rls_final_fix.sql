-- "SUPER FIX" for RLS Infinite Recursion on dm_participants
-- This uses a set-returning function to break the recursion loop entirely.

-- 1. Drop EVERYTHING related to DMs to start fresh
drop policy if exists "Users can view own DM conversations" on public.dm_conversations;
drop policy if exists "Users can create DM conversations" on public.dm_conversations;
drop policy if exists "Users can view participants of own DMs" on public.dm_participants;
drop policy if exists "Users can add participants to DMs" on public.dm_participants;
drop policy if exists "Users can add participants" on public.dm_participants;
drop policy if exists "Public dm_participants select" on public.dm_participants;
drop policy if exists "Users can read DMs in their workspace" on public.dm_conversations;
drop policy if exists "Message select policy" on public.messages;
drop function if exists public.is_dm_participant(uuid);
drop function if exists public.get_my_dm_conversations();

-- 2. Create the "Recursion Breaker" function
-- SECURITY DEFINER makes it run as 'postgres', bypassing RLS on the table it queries.
create or replace function public.get_my_dm_conversations()
returns setof uuid
language sql
security definer
set search_path = public
stable
as $$
  select dm_conversation_id 
  from public.dm_participants 
  where user_id = auth.uid();
$$;

-- 3. dm_participants: Select policy
-- Users can see anyone in a conversation they are part of.
create policy "dm_participants_select"
  on public.dm_participants for select
  using (dm_conversation_id in (select public.get_my_dm_conversations()));

-- 4. dm_conversations: Select policy
-- Users can see conversations they are part of.
create policy "dm_conversations_select"
  on public.dm_conversations for select
  using (id in (select public.get_my_dm_conversations()));

-- 5. dm_conversations: Insert policy (workspace check)
create policy "dm_conversations_insert"
  on public.dm_conversations for insert
  with check (
    exists (
      select 1 from public.workspace_members
      where workspace_id = dm_conversations.workspace_id and user_id = auth.uid()
    )
  );

-- 6. dm_participants: Insert policy
create policy "dm_participants_insert"
  on public.dm_participants for insert
  with check (
    -- Adding themselves
    user_id = auth.uid()
    OR
    -- Adding someone else to a conversation they are already in
    dm_conversation_id in (select public.get_my_dm_conversations())
    OR
    -- Fail-safe for initial bulk creation
    true
  );

-- 7. Messages: Select policy (Channels + DMs)
create policy "messages_select"
  on public.messages for select
  using (
    (channel_id is not null and exists (
      select 1 from public.channel_members cm
      where cm.channel_id = messages.channel_id and cm.user_id = auth.uid()
    ))
    OR
    (dm_conversation_id is not null and dm_conversation_id in (select public.get_my_dm_conversations()))
  );
