-- Workspaces (marketing org / agency)
create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now()
);

-- Members of a workspace
create table public.workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'admin', 'member')),
  created_at timestamptz default now(),
  unique(workspace_id, user_id)
);

-- Channels (client, campaign, or topic)
create table public.channels (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name text not null,
  slug text not null,
  topic text,
  is_private boolean default false,
  -- Marketing: optional client/campaign tags for filtering and AI
  client_tag text,
  campaign_tag text,
  created_at timestamptz default now(),
  unique(workspace_id, slug)
);

create table public.channel_members (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.channels(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(channel_id, user_id)
);

-- DM conversations (group DMs via multiple rows per conversation)
create table public.dm_conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_at timestamptz default now()
);

create table public.dm_participants (
  id uuid primary key default gen_random_uuid(),
  dm_conversation_id uuid not null references public.dm_conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz default now(),
  unique(dm_conversation_id, user_id)
);

-- Messages (channel or DM)
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  sender_id uuid not null references auth.users(id) on delete cascade,
  body text not null,
  -- One of these set: channel or dm
  channel_id uuid references public.channels(id) on delete cascade,
  dm_conversation_id uuid references public.dm_conversations(id) on delete cascade,
  parent_id uuid references public.messages(id) on delete cascade,
  created_at timestamptz default now(),
  constraint message_has_room check (
    (channel_id is not null and dm_conversation_id is null) or
    (channel_id is null and dm_conversation_id is not null)
  )
);

-- Optional: approval state for marketing workflows (e.g. creative sign-off)
create table public.message_approvals (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null check (status in ('pending', 'approved', 'rejected')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(message_id, user_id)
);

-- RLS (simplified: require auth)
alter table public.workspace_members enable row level security;
create policy "Users can read own memberships"
  on public.workspace_members for select
  using (user_id = auth.uid());

alter table public.workspaces enable row level security;
alter table public.channels enable row level security;
alter table public.dm_conversations enable row level security;
alter table public.messages enable row level security;

create policy "Users can read workspaces they belong to"
  on public.workspaces for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = workspaces.id and wm.user_id = auth.uid()
  ));

create policy "Users can read channels in their workspace"
  on public.channels for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = channels.workspace_id and wm.user_id = auth.uid()
  ));

create policy "Users can read DMs they participate in"
  on public.dm_conversations for select
  using (exists (
    select 1 from public.dm_participants dp
    where dp.dm_conversation_id = dm_conversations.id and dp.user_id = auth.uid()
  ));

create policy "Users can read messages in their workspace channels/DMs"
  on public.messages for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = messages.workspace_id and wm.user_id = auth.uid()
  ));

create policy "Users can insert messages when sender and in workspace"
  on public.messages for insert
  with check (
    sender_id = auth.uid() and
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = messages.workspace_id and wm.user_id = auth.uid()
    )
  );

-- Realtime for messages (skip if already in publication)
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
