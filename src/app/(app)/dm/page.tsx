"use client";

import { useEffect, useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { DMView } from "./DMView";

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

    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }

      setCurrentUserId(user.id);

      // Load participants with user details
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

      // Load messages
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

  if (!id || loading || !currentUserId) {
    return (
      <div className="flex-1 flex items-center justify-center bg-zinc-950 text-zinc-500">
        Loading...
      </div>
    );
  }

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
    <Suspense fallback={<div className="flex-1 flex items-center justify-center bg-zinc-950 text-zinc-500">Loading...</div>}>
      <DMPageContent />
    </Suspense>
  );
}
