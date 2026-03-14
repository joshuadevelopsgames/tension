"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

type Reaction = {
  emoji: string;
  count: number;
  userReacted: boolean;
};

/**
 * Displays existing reaction bubbles for a message.
 * Clicking a bubble toggles that reaction.
 * The emoji picker is handled externally (in the hover action bar).
 */
export function MessageReactions({
  messageId,
  currentUserId,
}: {
  messageId: string;
  currentUserId: string;
}) {
  const [reactions, setReactions] = useState<Reaction[]>([]);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("message_reactions")
        .select("id, emoji, user_id")
        .eq("message_id", messageId);
      setReactions(groupReactions(data ?? [], currentUserId));
    }
    load();
  }, [messageId, currentUserId, supabase]);

  useEffect(() => {
    const sub = supabase
      .channel(`reactions:${messageId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "message_reactions", filter: `message_id=eq.${messageId}` }, (p) => {
        const r = p.new as { id: string; emoji: string; user_id: string };
        setReactions((prev) => updateReactions(prev, r.emoji, r.user_id === currentUserId, 1));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "message_reactions" }, (p) => {
        const r = p.old as { id: string; emoji: string; user_id: string };
        setReactions((prev) => updateReactions(prev, r.emoji, r.user_id === currentUserId, -1));
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [messageId, currentUserId, supabase]);

  async function toggleReaction(emoji: string) {
    const existing = reactions.find((r) => r.emoji === emoji);
    if (existing?.userReacted) {
      const { data } = await supabase
        .from("message_reactions")
        .select("id")
        .eq("message_id", messageId)
        .eq("user_id", currentUserId)
        .eq("emoji", emoji)
        .single();
      if (data) await supabase.from("message_reactions").delete().eq("id", data.id);
    } else {
      await supabase.from("message_reactions").insert({ message_id: messageId, user_id: currentUserId, emoji });
    }
  }

  if (reactions.length === 0) return null;

  return (
    <div className="flex items-center gap-1 flex-wrap mt-1">
      {reactions.map((r) => (
        <button
          key={r.emoji}
          onClick={() => toggleReaction(r.emoji)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs border transition-colors ${
            r.userReacted
              ? "bg-indigo-500/20 border-indigo-500/40 text-indigo-300"
              : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-zinc-200"
          }`}
        >
          <span>{r.emoji}</span>
          <span className="font-medium tabular-nums">{r.count}</span>
        </button>
      ))}
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function groupReactions(
  raw: { id: string; emoji: string; user_id: string }[],
  currentUserId: string
): Reaction[] {
  const map = new Map<string, { count: number; userReacted: boolean }>();
  for (const r of raw) {
    const existing = map.get(r.emoji) ?? { count: 0, userReacted: false };
    map.set(r.emoji, {
      count: existing.count + 1,
      userReacted: existing.userReacted || r.user_id === currentUserId,
    });
  }
  return Array.from(map.entries()).map(([emoji, v]) => ({ emoji, ...v }));
}

function updateReactions(
  prev: Reaction[],
  emoji: string,
  isCurrentUser: boolean,
  delta: 1 | -1
): Reaction[] {
  const idx = prev.findIndex((r) => r.emoji === emoji);
  if (idx === -1 && delta === 1) {
    return [...prev, { emoji, count: 1, userReacted: isCurrentUser }];
  }
  return prev.map((r, i) => {
    if (i !== idx) return r;
    return {
      ...r,
      count: r.count + delta,
      userReacted: delta === 1 ? (isCurrentUser ? true : r.userReacted) : (isCurrentUser ? false : r.userReacted),
    };
  }).filter((r) => r.count > 0);
}
