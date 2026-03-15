-- Add ai_source column to record whether a message came from Tension KB or Gemini
alter table public.messages 
add column if not exists ai_source text 
check (ai_source in ('tension', 'gemini'));
