-- Add entries for commonly asked Tension features that were missing
insert into public.tension_knowledge (title, content) values
  ('Deleting a Channel', 
   'To delete a channel in Tension, you must be a workspace owner or have administrative permissions. Hover over the channel name in the sidebar, click the "..." menu, and select "Delete Channel". Note: Deleting a channel is permanent and will remove all message history within that channel.'),
  
  ('Deleting a Message', 
   'You can delete any message you have sent by hovering over the message and clicking the trash can icon. Workspace owners can also delete messages sent by other users to moderate the workspace.'),
  
  ('Managing Workspace Members', 
   'You can invite new members to your workspace from the "Members" section in Workspace Settings. You can also change member roles (Member, Admin, Owner) or remove members from the workspace if needed.'),

  ('Keyboard Shortcuts', 
   'Tension is built for speed. Use Cmd+K (Mac) or Ctrl+K (Windows) to open the Quick Switcher and jump between channels and DMs instantly. Use Cmd+. to toggle the right-side thread panel.');
