"use client";

import { useEffect, useState, useRef, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { ChannelView } from "./ChannelView";

/* ── Skeleton — only shown on the very first load ─────────────────────── */
function ChannelSkeleton() {
  return (
    <div className="flex flex-col h-full overflow-hidden animate-pulse">
      {/* Header */}
      <div
        className="px-6 py-4 pt-10 flex items-center gap-3 shrink-0"
        style={{ borderBottom: "1px solid var(--t-border)" }}
      >
        <div className="h-5 w-32 rounded-md" style={{ background: "var(--t-raised)" }} />
        <div className="h-3 w-48 rounded-md ml-2" style={{ background: "var(--t-raised)" }} />
      </div>

      {/* Messages */}
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

      {/* Composer */}
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

  // Displayed content — only updated when new data is ready
  const [channel, setChannel] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);

  // Thin accent bar shown during background channel switches
  const [switching, setSwitching] = useState(false);

  // Track the latest requested id to discard stale responses
  const latestIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!id) return;
    latestIdRef.current = id;

    // First load: no channel yet — skeleton is shown
    // Subsequent loads: keep current channel visible, show progress bar
    if (channel !== null) setSwitching(true);

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
      // Discard if the user already navigated somewhere else
      if (latestIdRef.current !== id) return;
      if (!ch) { router.push("/"); return; }

      setChannel(ch);
      setMessages(
        (msgs ?? []).map((m: any) => ({
          ...m,
          users: Array.isArray(m.users) ? m.users[0] : m.users,
        }))
      );
      setSwitching(false);
    });

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // First load — show skeleton
  if (!channel) return <ChannelSkeleton />;

  return (
    <div className="relative flex flex-col h-full overflow-hidden">
      {/* Thin accent progress bar during background switch */}
      {switching && (
        <div
          className="absolute top-0 left-0 right-0 z-50 overflow-hidden"
          style={{ height: 2 }}
        >
          <div
            className="h-full animate-pulse"
            style={{ background: "var(--t-accent)", width: "100%" }}
          />
        </div>
      )}

      <ChannelView
        key={channel.id}
        channel={channel}
        initialMessages={messages}
      />
    </div>
  );
}

export default function ChannelPage() {
  return (
    <Suspense fallback={<ChannelSkeleton />}>
      <ChannelPageContent />
    </Suspense>
  );
}
