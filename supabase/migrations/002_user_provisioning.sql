-- Function to auto-provision a workspace and general channel for new users
create or replace function public.handle_new_user()
returns trigger as $$
declare
  new_workspace_id uuid;
begin
  -- 1. Create a personal workspace for the new user
  insert into public.workspaces (name, slug)
  values (
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)) || '''s Workspace',
    gen_random_uuid()::text -- ensure slug is unique
  )
  returning id into new_workspace_id;

  -- 2. Add the user as the owner of their new workspace
  insert into public.workspace_members (workspace_id, user_id, role)
  values (new_workspace_id, new.id, 'owner');

  -- 3. Create a default #general channel in that workspace
  insert into public.channels (workspace_id, name, slug, topic)
  values (new_workspace_id, 'general', 'general', 'General discussion');

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Trigger the function every time a user signs up
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
