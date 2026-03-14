export type Channel = {
  id: string;
  workspace_id: string;
  name: string;
  slug: string;
  topic: string | null;
  is_private: boolean;
  client_tag: string | null;
  campaign_tag: string | null;
  created_at: string;
};

export type Message = {
  id: string;
  workspace_id: string;
  sender_id: string;
  body: string;
  channel_id: string | null;
  dm_conversation_id: string | null;
  parent_id: string | null;
  created_at: string;
};

export type Workspace = {
  id: string;
  name: string;
  slug: string;
  created_at: string;
};
