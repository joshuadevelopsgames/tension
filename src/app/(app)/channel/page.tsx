"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { ChannelView } from "./ChannelView";

/* ── Module-level cache — survives route changes, resets on full page reload ── */
const channelCache = new Map<string, { channel: any; messages: any[] }>();

/* ── Skeleton — only shown when a channel has never been loaded yet ─────── */
function ChannelSkeleton() {
  return (
    <div className="flex flex-col h-full overflow-hidden animate-pulse">
      <div
        className="px-6 py-4 pt-10 flex items-center gap-3 shrink-0"
        style={{ borderBottom: "1px solid var(--t-border)" }}
      >
        <div className="h-5 w-32 rounded-md" style={{ background: "var(--t-raised)" }} />
        <div className="h-3 w-48 rounded-md ml-2" style={{ background: "var(--t-raised)" }} />
      </div>
      <div className="flex-1 px-6 py-4 space-y-5 overflow-hidden">
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded shrink-0" style={{ background: "var(--t-raised)" }} />
            <div className="flex-1 space-y-2">
              <div className="flex gap-2 items-center">
                <div className="h-3 rounded" style={{ width: `${60 + (i % 3) * 20}px`, background: "var(--t-raised)" }} />
                <div className="h-2.5 w-10 rounded" style={{ background: "var(--t-raised)", opacity: 0.5 }} />
              </div>
              <div className="h-3 rounded" style={{ width: `${50 + ((i * 37) % 45)}%`, background: "var(--t-raised)" }} />
              {i % 2 === 0 && (
                <div className="h-3 rounded" style={{ width: `${30 + ((i * 23) % 30)}%`, background: "var(--t-raised)", opacity: 0.6 }} />
              )}
            </div>
          </div>
        ))}
      </div>
      <div className="p-4 shrink-0">
        <div className="h-11 rounded-xl" style={{ background: "var(--t-raised)" }} />
      </div>
    </div>
  );
}

function ChannelPageContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const router = useRouter();
  const latestIdRef = useRef<string | null>(null);

  // Initialise directly from cache — if already visited this channel,
  // state starts populated and no loading state is ever shown.
  const [channel, setChannel] = useState<any>(() =>
    id ? (channelCache.get(id)?.channel ?? null) : null
  );
  const [messages, setMessages] = useState<any[]>(() =>
    id ? (channelCache.get(id)?.messages ?? []) : []
  );

  useEffect(() => {
    if (!id) return;
    latestIdRef.current = id;

    const hit = channelCache.get(id);
    if (hit) {
      setChannel(hit.channel);
      setMessages(hit.messages);
    } else {
      setChannel(null);
      setMessages([]);
    }

    // Always refetch so cached channel views are not stuck with stale messages
    const supabase = createClient();
    Promise.all([
      supabase
        .from("channels")
        .select("id, name, topic, client_tag, campaign_tag, workspace_id")
        .eq("id", id)
        .single(),
      supabase
        .from("messages")
        .select(`
          id, body, sender_id, created_at, parent_id, urgent,
          users:sender_id ( full_name, avatar_url, bio )
        `)
        .eq("channel_id", id)
        .order("created_at", { ascending: true }),
    ]).then(([{ data: ch }, { data: msgs }]) => {
      if (latestIdRef.current !== id) return;
      if (!ch) { router.push("/"); return; }

      const processed = (msgs ?? []).map((m: any) => ({
        ...m,
        users: Array.isArray(m.users) ? m.users[0] : m.users,
      }));

      // Store in cache so the next visit is instant
      channelCache.set(id, { channel: ch, messages: processed });

      setChannel(ch);
      setMessages(processed);
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!channel) return <ChannelSkeleton />;

  return (
    <ChannelView
      channel={channel}
      initialMessages={messages}
    />
  );
}

export default function ChannelPage() {
  return (
    <Suspense fallback={<ChannelSkeleton />}>
      <ChannelPageContent />
    </Suspense>
  );
}
