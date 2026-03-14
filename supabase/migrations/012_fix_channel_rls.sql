-- Fix: ensure workspace members can insert channels and join them
-- Run this in the Supabase SQL Editor if channel creation is blocked by RLS.

-- Drop existing INSERT policies to avoid conflicts (safe to re-run)
drop policy if exists "Workspace members can create channels" on public.channels;
drop policy if exists "Users can join channels in their workspace" on public.channel_members;
drop policy if exists "Users can read channel members in their workspace" on public.channel_members;

-- Re-create: workspace members may create channels in their workspace
create policy "Workspace members can create channels"
  on public.channels for insert
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = channels.workspace_id
        and wm.user_id = auth.uid()
    )
  );

-- Re-create: workspace members may read channel_members rows
create policy "Users can read channel members in their workspace"
  on public.channel_members for select
  using (
    exists (
      select 1 from public.channels c
      join public.workspace_members wm on wm.workspace_id = c.workspace_id
      where c.id = channel_members.channel_id
        and wm.user_id = auth.uid()
    )
  );

-- Re-create: users can add themselves to any channel in their workspace
create policy "Users can join channels in their workspace"
  on public.channel_members for insert
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.channels c
      join public.workspace_members wm on wm.workspace_id = c.workspace_id
      where c.id = channel_members.channel_id
        and wm.user_id = auth.uid()
    )
  );
