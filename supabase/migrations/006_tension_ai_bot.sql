-- Step 1: Create the bot identity in auth.users first (required by FK constraint)
insert into auth.users (
  id, email, encrypted_password, email_confirmed_at,
  created_at, updated_at,
  raw_user_meta_data, raw_app_meta_data,
  aud, role
)
values (
  '00000000-0000-0000-0000-000000000001',
  'tension-ai@tension.internal',
  '',
  now(), now(), now(),
  '{"full_name": "Tension AI"}'::jsonb,
  '{}'::jsonb,
  'authenticated',
  'authenticated'
)
on conflict (id) do nothing;

-- Step 2: Now create the bot's public profile
insert into public.users (id, full_name, avatar_url, status, bio)
values (
  '00000000-0000-0000-0000-000000000001',
  'Tension AI',
  null,
  'active',
  'Your AI assistant for Tension. Ask me anything!'
)
on conflict (id) do nothing;

-- Create the knowledge base table for Tension AI context
create table if not exists public.tension_knowledge (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  content text not null,
  created_at timestamptz default now()
);

-- Enable RLS (read-only for all authenticated users, write only via service role)
alter table public.tension_knowledge enable row level security;

create policy "Anyone can read tension knowledge"
  on public.tension_knowledge for select
  using (true);

-- Seed with starter knowledge about the Tension app
insert into public.tension_knowledge (title, content) values
  ('What is Tension?', 
   'Tension is a modern team communication and project management application built for agencies and creative teams. It combines real-time messaging, channel-based communication, and direct messages in a sleek, dark-themed interface.'),
  
  ('Channels in Tension', 
   'Channels are spaces for team conversations organized by topic, project, or client. Channels can have tags like client_tag and campaign_tag to organize work. Anyone in a workspace can view and join channels. You can create a new channel by clicking the + icon next to Channels in the sidebar.'),
  
  ('Direct Messages (DMs)', 
   'Direct Messages in Tension let you have private one-on-one or group conversations with team members. You can start a new DM by clicking the + icon next to Direct Messages. DMs support real-time typing indicators so you can see when someone is composing a reply.'),
  
  ('User Profiles', 
   'Every user in Tension has a profile with a full name, avatar photo, bio, and a status (Active, Away, Busy, or Offline). Users can also set a custom status message with an emoji. Profiles can be edited from the User Settings gear icon in the bottom-left sidebar.'),
  
  ('Workspaces', 
   'A workspace in Tension is the top-level container for your team. Each workspace has channels and members. When you first sign up, a workspace is automatically created for you.'),
  
  ('Message Reactions', 
   'You can react to any message in Tension with emoji reactions. Hover over a message to see the reaction bar, or click the smiley face icon to open the full emoji picker. Quick reactions (👍 🎉 👀 ❤️) are available directly in the hover bar.'),
  
  ('Thread Replies', 
   'In Tension channels, you can reply to any message in a thread to keep conversations organized. Click the speech bubble icon on a message to open the thread panel on the right side.'),

  ('File Uploads', 
   'Tension supports uploading files and images directly in messages. Click the paperclip icon in the message composer to attach files. Uploaded files are stored securely and can be viewed by channel members.'),

  ('Mentions and Notifications', 
   'You can mention team members in messages using @username. Mentioned users receive a notification badge. You can also use @here, @everyone, or @channel to notify all members of a channel.'),

  ('Tension AI', 
   'Tension AI is your built-in AI assistant. You can DM Tension AI directly to ask questions about the Tension app, get help with features, or ask general questions. For Tension-specific topics, it draws from an internal knowledge base. For general questions, it uses Gemini Flash.');
