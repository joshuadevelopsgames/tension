-- Allow users to update their own messages
create policy "Users can update their own messages"
  on public.messages for update
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

-- Allow users to delete their own messages
create policy "Users can delete their own messages"
  on public.messages for delete
  using (sender_id = auth.uid());
