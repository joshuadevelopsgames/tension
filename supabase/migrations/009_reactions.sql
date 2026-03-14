-- Emoji reactions on messages
create table public.message_reactions (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  emoji text not null,
  created_at timestamptz default now(),
  unique(message_id, user_id, emoji)
);

alter table public.message_reactions enable row level security;

-- Users can read reactions on messages in their workspace
create policy "Users can read reactions in their workspace"
  on public.message_reactions for select
  using (
    exists (
      select 1 from public.messages m
      join public.workspace_members wm on wm.workspace_id = m.workspace_id
      where m.id = message_reactions.message_id and wm.user_id = auth.uid()
    )
  );

-- Users can add their own reactions
create policy "Users can add reactions"
  on public.message_reactions for insert
  with check (user_id = auth.uid());

-- Users can remove their own reactions
create policy "Users can remove their own reactions"
  on public.message_reactions for delete
  using (user_id = auth.uid());

-- Enable realtime for reactions
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and tablename = 'message_reactions'
  ) then
    alter publication supabase_realtime add table public.message_reactions;
  end if;
end $$;
