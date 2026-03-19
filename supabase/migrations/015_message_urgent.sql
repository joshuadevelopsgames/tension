-- Add urgent flag to messages for AI urgency classification
alter table messages
  add column if not exists urgent boolean not null default false;

-- Add channel archive support
alter table channels
  add column if not exists is_archived boolean not null default false;
