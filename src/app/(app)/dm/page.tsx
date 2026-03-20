"use client";

import { useEffect, useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { DMView } from "./DMView";

function DMSkeleton() {
  return (
    <div className="flex flex-col h-full overflow-hidden animate-pulse">
      {/* Header */}
      <div
        className="px-6 py-4 pt-10 flex items-center gap-3 shrink-0"
        style={{ borderBottom: "1px solid var(--t-border)" }}
      >
        <div className="w-8 h-8 rounded-full shrink-0" style={{ background: "var(--t-raised)" }} />
        <div className="h-4 w-36 rounded-md" style={{ background: "var(--t-raised)" }} />
      </div>

      {/* Messages */}
      <div className="flex-1 px-6 py-4 space-y-5 overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex gap-3 items-start">
            <div className="w-8 h-8 rounded-full shrink-0" style={{ background: "var(--t-raised)" }} />
            <div className="flex-1 space-y-2">
              <div className="flex gap-2 items-center">
                <div
                  className="h-3 rounded"
                  style={{ width: `${60 + (i % 3) * 20}px`, background: "var(--t-raised)" }}
                />
                <div className="h-2.5 w-10 rounded" style={{ background: "var(--t-raised)", opacity: 0.5 }} />
              </div>
              <div
                className="h-3 rounded"
                style={{ width: `${50 + ((i * 37) % 45)}%`, background: "var(--t-raised)" }}
              />
              {i % 2 === 0 && (
                <div
                  className="h-3 rounded"
                  style={{ width: `${30 + ((i * 23) % 30)}%`, background: "var(--t-raised)", opacity: 0.6 }}
                />
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

function DMPageContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [participants, setParticipants] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    // Reset state immediately when switching conversations
    setLoading(true);
    setMessages([]);
    setParticipants([]);

    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      setCurrentUserId(user.id);

      const TENSION_AI_ID = "00000000-0000-0000-0000-000000000001";
      let rawParticipants: any[] | null = null;

      if (id === "temp-ai-dm") {
        rawParticipants = [
          { user_id: user.id, users: { full_name: user.user_metadata?.full_name || "You", avatar_url: user.user_metadata?.avatar_url || null } },
          { user_id: TENSION_AI_ID, users: { full_name: "Tension AI", avatar_url: null } }
        ];
      } else {
        const { data } = await supabase
          .from("dm_participants")
          .select("user_id, users(full_name, avatar_url)")
          .eq("dm_conversation_id", id);
        rawParticipants = data;
      }

      if (!rawParticipants || rawParticipants.length === 0) {
        router.push("/");
        return;
      }

      const participantList = rawParticipants.map((p: any) => ({
        user_id: p.user_id,
        full_name: p.users?.full_name ?? null,
        avatar_url: p.users?.avatar_url ?? null,
      }));

      const { data: msgs } = await supabase
        .from("messages")
        .select("id, body, sender_id, created_at, parent_id")
        .eq("dm_conversation_id", id)
        .order("created_at", { ascending: true });

      setParticipants(participantList);
      setMessages(msgs ?? []);
      setLoading(false);
    }

    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  if (!id || loading || !currentUserId) return <DMSkeleton />;

  return (
    <DMView
      key={id}
      dmId={id}
      participants={participants}
      initialMessages={messages}
      currentUserId={currentUserId}
    />
  );
}

export default function DMPage() {
  return (
    <Suspense fallback={<DMSkeleton />}>
      <DMPageContent />
    </Suspense>
  );
}
