-- Allow workspace members to create channels
create policy "Workspace members can create channels"
  on public.channels for insert
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = channels.workspace_id and wm.user_id = auth.uid()
    )
  );

-- Allow channel members to read each other
alter table public.channel_members enable row level security;

create policy "Users can read channel members in their workspace"
  on public.channel_members for select
  using (
    exists (
      select 1 from public.channels c
      join public.workspace_members wm on wm.workspace_id = c.workspace_id
      where c.id = channel_members.channel_id and wm.user_id = auth.uid()
    )
  );

-- Allow users to add themselves (or workspace members to join) a channel
create policy "Users can join channels in their workspace"
  on public.channel_members for insert
  with check (
    user_id = auth.uid() and
    exists (
      select 1 from public.channels c
      join public.workspace_members wm on wm.workspace_id = c.workspace_id
      where c.id = channel_members.channel_id and wm.user_id = auth.uid()
    )
  );
