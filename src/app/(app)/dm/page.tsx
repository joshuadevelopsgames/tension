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
      const { data: rawParticipants } = await supabase
        .from("dm_participants")
        .select("user_id, users(full_name, avatar_url)")
        .eq("dm_conversation_id", id);

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
  }, [id, router]);

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
