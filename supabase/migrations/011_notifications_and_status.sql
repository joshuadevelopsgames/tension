-- Notifications table for @mention alerts
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,  -- who receives the notification
  actor_id uuid not null references auth.users(id) on delete cascade, -- who triggered it
  message_id uuid references public.messages(id) on delete cascade,
  channel_id uuid references public.channels(id) on delete cascade,
  dm_conversation_id uuid references public.dm_conversations(id) on delete cascade,
  type text not null check (type in ('mention', 'reply', 'dm')),
  body_preview text,
  read boolean not null default false,
  created_at timestamptz default now()
);

alter table public.notifications enable row level security;

-- Users can only read their own notifications
create policy "Users can read their own notifications"
  on public.notifications for select
  using (user_id = auth.uid());

-- Workspace members can insert notifications (needed to notify others)
create policy "Workspace members can create notifications"
  on public.notifications for insert
  with check (
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = notifications.workspace_id and wm.user_id = auth.uid()
    )
  );

-- Users can mark their own notifications as read
create policy "Users can update their own notifications"
  on public.notifications for update
  using (user_id = auth.uid());

-- Enable realtime for notifications
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table public.notifications;
  end if;
end $$;

-- Add status to users table if not exists
alter table public.users add column if not exists status text default 'active'
  check (status in ('active', 'away', 'busy', 'offline'));
