-- Canvases (Slack Canvas equivalent — rich block-based documents)
create table public.canvases (
  id          uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  created_by  uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'Untitled',
  emoji       text not null default '📄',
  blocks      jsonb not null default '[]',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Version history snapshots
create table public.canvas_history (
  id          uuid primary key default gen_random_uuid(),
  canvas_id   uuid not null references public.canvases(id) on delete cascade,
  blocks      jsonb not null default '[]',
  title       text not null,
  created_by  uuid references auth.users(id) on delete set null,
  created_at  timestamptz not null default now()
);

-- Per-block comments
create table public.canvas_block_comments (
  id          uuid primary key default gen_random_uuid(),
  canvas_id   uuid not null references public.canvases(id) on delete cascade,
  block_id    text not null,
  user_id     uuid not null references auth.users(id) on delete cascade,
  body        text not null,
  created_at  timestamptz not null default now()
);

-- Collaborator access
create table public.canvas_shares (
  canvas_id   uuid not null references public.canvases(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'editor' check (role in ('editor', 'viewer')),
  primary key (canvas_id, user_id)
);

-- Indexes
create index on public.canvases (workspace_id);
create index on public.canvases (created_by);
create index on public.canvas_history (canvas_id, created_at desc);
create index on public.canvas_block_comments (canvas_id, block_id);

-- Auto-update updated_at
create or replace function public.update_canvas_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_canvas_updated_at
before update on public.canvases
for each row execute function public.update_canvas_updated_at();

-- Row-Level Security
alter table public.canvases enable row level security;
alter table public.canvas_history enable row level security;
alter table public.canvas_block_comments enable row level security;
alter table public.canvas_shares enable row level security;

-- canvases: visible to workspace members + direct shares
create policy "Members can view canvases in their workspace"
  on public.canvases for select
  using (
    exists (
      select 1 from public.workspace_members
      where workspace_id = canvases.workspace_id
        and user_id = auth.uid()
    )
  );

create policy "Members can create canvases"
  on public.canvases for insert
  with check (
    created_by = auth.uid() and
    exists (
      select 1 from public.workspace_members
      where workspace_id = canvases.workspace_id
        and user_id = auth.uid()
    )
  );

create policy "Creator can update their canvas"
  on public.canvases for update
  using (created_by = auth.uid());

create policy "Creator can delete their canvas"
  on public.canvases for delete
  using (created_by = auth.uid());

-- canvas_history
create policy "Workspace members can view history"
  on public.canvas_history for select
  using (
    exists (
      select 1 from public.canvases c
      join public.workspace_members wm on wm.workspace_id = c.workspace_id
      where c.id = canvas_history.canvas_id
        and wm.user_id = auth.uid()
    )
  );

create policy "Authenticated users can insert history"
  on public.canvas_history for insert
  with check (created_by = auth.uid());

-- canvas_block_comments
create policy "Workspace members can view comments"
  on public.canvas_block_comments for select
  using (
    exists (
      select 1 from public.canvases c
      join public.workspace_members wm on wm.workspace_id = c.workspace_id
      where c.id = canvas_block_comments.canvas_id
        and wm.user_id = auth.uid()
    )
  );

create policy "Members can comment"
  on public.canvas_block_comments for insert
  with check (user_id = auth.uid());

create policy "Users can delete own comments"
  on public.canvas_block_comments for delete
  using (user_id = auth.uid());

-- canvas_shares
create policy "Canvas owner can manage shares"
  on public.canvas_shares for all
  using (
    exists (
      select 1 from public.canvases
      where id = canvas_shares.canvas_id
        and created_by = auth.uid()
    )
  );
