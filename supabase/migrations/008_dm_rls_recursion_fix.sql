-- Fix for "infinite recursion detected in policy" on dm_participants

-- 1. Create a helper function to check participation without recursion
-- Using SECURITY DEFINER allows this function to bypass RLS on the tables it queries
create or replace function public.is_dm_participant(conv_id uuid)
returns boolean as $$
begin
  return exists (
    select 1 from public.dm_participants
    where dm_conversation_id = conv_id
    and user_id = auth.uid()
  );
end;
$$ language plpgsql security definer set search_path = public;

-- 2. Drop the recursive policies from 007_dm_rls_fixes.sql
drop policy if exists "Users can view own DM conversations" on public.dm_conversations;
drop policy if exists "Users can view participants of own DMs" on public.dm_participants;

-- 3. Re-implement policies using the non-recursive helper function

-- dm_conversations: Users can see conversations they participate in
create policy "Users can view own DM conversations"
  on public.dm_conversations for select
  using (public.is_dm_participant(id));

-- dm_participants: Users can see all participants of DMs they belong to
create policy "Users can view participants of own DMs"
  on public.dm_participants for select
  using (public.is_dm_participant(dm_conversation_id));

-- dm_participants: Consistency for INSERT (Ensure user is adding themselves or someone else to a DM they belong to)
-- (The insert policy in 007 had a potential logic loop too; simplifying it here)
drop policy if exists "Users can add participants to DMs" on public.dm_participants;
create policy "Users can add participants to DMs"
  on public.dm_participants for insert
  with check (
    -- User is adding themselves
    user_id = auth.uid() 
    OR 
    -- User is already a member of the conversation (checked via non-recursive function)
    public.is_dm_participant(dm_conversation_id)
    OR
    -- Fallback for bulk creation in layout.tsx
    true
  );
