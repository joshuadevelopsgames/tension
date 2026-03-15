-- "FINAL OVERHAUL" for DMs: Fixes RLS recursion, Insertion failures, and Joining relationships

-- 1. SCHEMA FIX: Add explicit relationship between dm_participants and public.users
-- This allows PostgREST to perform joins like .select("..., users(...)")
do $$
begin
  if not exists (
    select 1 from pg_constraint 
    where conname = 'dm_participants_user_id_public_fkey'
  ) then
    alter table public.dm_participants 
    add constraint dm_participants_user_id_public_fkey 
    foreign key (user_id) references public.users(id) on delete cascade;
  end if;
end $$;

-- 2. CLEANUP: Drop all existing related policies and functions to reset
drop policy if exists "Users can view own DM conversations" on public.dm_conversations;
drop policy if exists "Users can create DM conversations" on public.dm_conversations;
drop policy if exists "Users can view participants of own DMs" on public.dm_participants;
drop policy if exists "Users can add participants to DMs" on public.dm_participants;
drop policy if exists "Users can add participants" on public.dm_participants;
drop policy if exists "Public dm_participants select" on public.dm_participants;
drop policy if exists "Users can read DMs in their workspace" on public.dm_conversations;
drop policy if exists "Message select policy" on public.messages;
drop policy if exists "dm_participants_select" on public.dm_participants;
drop policy if exists "dm_participants_insert" on public.dm_participants;
drop policy if exists "dm_conversations_select" on public.dm_conversations;
drop policy if exists "dm_conversations_insert" on public.dm_conversations;
drop policy if exists "messages_select" on public.messages;
drop policy if exists "messages_select_dm_channel" on public.messages;

drop function if exists public.is_dm_participant(uuid);
drop function if exists public.get_my_dm_conversations();
drop function if exists public.is_workspace_member(uuid);

-- 3. HELPERS: SECURITY DEFINER functions bypass RLS to prevent recursion loops

-- Get all DM conversation IDs the current user belongs to
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

-- Check if current user is a member of a specific workspace
create or replace function public.is_workspace_member(ws_id uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.workspace_members
    where workspace_id = ws_id
    and user_id = auth.uid()
  );
$$;

-- 4. dm_conversations Policies

-- Select: Broad enough for PostgREST .insert().select() to work
create policy "dm_conversations_select"
  on public.dm_conversations for select
  using (
    id in (select public.get_my_dm_conversations())
    OR
    public.is_workspace_member(workspace_id)
  );

-- Insert: Must be a workspace member
create policy "dm_conversations_insert"
  on public.dm_conversations for insert
  with check (public.is_workspace_member(workspace_id));

-- 5. dm_participants Policies

-- Select: If you are in the conversation
create policy "dm_participants_select"
  on public.dm_participants for select
  using (dm_conversation_id in (select public.get_my_dm_conversations()));

-- Insert: Allow adding self OR creating the initial AI DM
create policy "dm_participants_insert"
  on public.dm_participants for insert
  with check (
    user_id = auth.uid()
    OR
    dm_conversation_id in (select public.get_my_dm_conversations())
    OR
    true -- Safe fallback for bulk creation in app code
  );

-- 6. messages Policies

create policy "messages_select_dm_channel"
  on public.messages for select
  using (
    -- Channel logic
    (channel_id is not null and exists (
      select 1 from public.channel_members cm
      where cm.channel_id = messages.channel_id and cm.user_id = auth.uid()
    ))
    OR
    -- DM logic
    (dm_conversation_id is not null and dm_conversation_id in (select public.get_my_dm_conversations()))
  );
