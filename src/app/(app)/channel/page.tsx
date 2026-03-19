"use client";

import { useEffect, useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { ChannelView } from "./ChannelView";

function ChannelPageContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [channel, setChannel] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);

  useEffect(() => {
    if (!id) return;

    async function loadChannel() {
      const supabase = createClient();
      const { data: ch } = await supabase
        .from("channels")
        .select("id, name, topic, client_tag, campaign_tag, workspace_id")
        .eq("id", id)
        .single();

      if (!ch) {
        router.push("/");
        return;
      }

      const { data: msgs } = await supabase
        .from("messages")
        .select(`
          id,
          body,
          sender_id,
          created_at,
          parent_id,
          urgent,
          users:sender_id (
            full_name,
            avatar_url
          )
        `)
        .eq("channel_id", id)
        .order("created_at", { ascending: true });

      setChannel(ch);
      const messagesWithProfiles = (msgs ?? []).map(m => ({
        ...m,
        users: Array.isArray(m.users) ? m.users[0] : m.users
      })) as any[];
      setMessages(messagesWithProfiles);
      setLoading(false);
    }

    loadChannel();
  }, [id, router]);

  if (!id || loading || !channel) {
    return <div className="flex-1 flex items-center justify-center bg-zinc-950 text-[#a1a1aa]">Loading...</div>;
  }

  return (
    <ChannelView
      key={channel.id}
      channel={channel}
      initialMessages={messages}
    />
  );
}

export default function ChannelPage() {
  return (
    <Suspense fallback={<div className="flex-1 flex items-center justify-center bg-zinc-950 text-[#a1a1aa]">Loading...</div>}>
      <ChannelPageContent />
    </Suspense>
  );
}
