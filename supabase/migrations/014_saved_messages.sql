create table if not exists saved_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  message_id uuid not null references messages(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(user_id, message_id)
);

alter table saved_messages enable row level security;

create policy "users manage their own saved messages"
  on saved_messages for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());
