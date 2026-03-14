-- Allow users to view all members of workspaces they belong to
create policy "Users can read all workspace members in their workspaces"
  on public.workspace_members for select
  using (
    exists (
      select 1 from public.workspace_members wm2
      where wm2.workspace_id = workspace_members.workspace_id
        and wm2.user_id = auth.uid()
    )
  );

-- Allow workspace owners/admins to update member roles
create policy "Owners and admins can update member roles"
  on public.workspace_members for update
  using (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  )
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = workspace_members.workspace_id
        and wm.user_id = auth.uid()
        and wm.role in ('owner', 'admin')
    )
  );

-- Allow authenticated users to join a workspace (insert themselves)
create policy "Users can join workspaces"
  on public.workspace_members for insert
  with check (user_id = auth.uid());
