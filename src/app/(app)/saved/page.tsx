"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bookmark, Hash, MessageSquare } from "lucide-react";
import Link from "next/link";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import { UserAvatar } from "@/components/UserAvatar";

type SavedItem = {
  id: string;
  created_at: string;
  message: {
    id: string;
    body: string;
    sender_id: string;
    created_at: string;
    channel_id: string | null;
    dm_conversation_id: string | null;
    channel_name?: string;
    sender_name?: string | null;
    sender_avatar?: string | null;
  };
};

export default function SavedPage() {
  const [items, setItems] = useState<SavedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data } = await supabase
        .from("saved_messages")
        .select(`
          id,
          created_at,
          messages(
            id, body, sender_id, created_at, channel_id, dm_conversation_id,
            users:sender_id(full_name, avatar_url),
            channels(name)
          )
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      const mapped: SavedItem[] = (data ?? []).map((row: any) => {
        const msg = Array.isArray(row.messages) ? row.messages[0] : row.messages;
        const users = msg ? (Array.isArray(msg.users) ? msg.users[0] : msg.users) : null;
        const channel = msg ? (Array.isArray(msg.channels) ? msg.channels[0] : msg.channels) : null;
        return {
          id: row.id,
          created_at: row.created_at,
          message: {
            id: msg?.id,
            body: msg?.body ?? "",
            sender_id: msg?.sender_id,
            created_at: msg?.created_at,
            channel_id: msg?.channel_id ?? null,
            dm_conversation_id: msg?.dm_conversation_id ?? null,
            channel_name: channel?.name ?? undefined,
            sender_name: users?.full_name ?? null,
            sender_avatar: users?.avatar_url ?? null,
          },
        };
      }).filter((i) => i.message.id);

      setItems(mapped);
      setLoading(false);
    }
    load();
  }, []);

  async function unsave(savedId: string) {
    const supabase = createClient();
    await supabase.from("saved_messages").delete().eq("id", savedId);
    setItems((prev) => prev.filter((i) => i.id !== savedId));
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-6 py-4 pt-10 flex items-center gap-3 shrink-0 border-b border-white/5 select-none">
        <Bookmark className="w-4 h-4 text-zinc-500" />
        <h2 className="font-semibold text-zinc-100 text-sm">Saved Messages</h2>
        {!loading && items.length > 0 && (
          <span className="text-[11px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded-full">{items.length}</span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-zinc-600 text-sm">Loading…</div>
        ) : items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bookmark className="w-10 h-10 text-zinc-700 mb-3" />
            <p className="text-zinc-500 text-sm font-medium">No saved messages yet</p>
            <p className="text-zinc-600 text-xs mt-1">Hover over a message and click the bookmark icon to save it.</p>
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl">
            {items.map((item) => {
              const href = item.message.channel_id
                ? `/channel?id=${item.message.channel_id}`
                : item.message.dm_conversation_id
                ? `/dm?id=${item.message.dm_conversation_id}`
                : "#";

              return (
                <div key={item.id} className="group bg-white/[0.03] border border-white/5 rounded-xl p-4 hover:border-white/10 transition-colors">
                  <div className="flex items-start gap-3">
                    <UserAvatar
                      userId={item.message.sender_id}
                      displayName={item.message.sender_name || undefined}
                      avatarUrl={item.message.sender_avatar}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[13px] font-semibold text-zinc-200">
                          {item.message.sender_name || "Unknown"}
                        </span>
                        {item.message.channel_name && (
                          <Link href={href} className="flex items-center gap-0.5 text-[11px] text-zinc-500 hover:text-indigo-400 transition-colors">
                            <Hash className="w-3 h-3" />
                            {item.message.channel_name}
                          </Link>
                        )}
                        {item.message.dm_conversation_id && !item.message.channel_id && (
                          <Link href={href} className="flex items-center gap-0.5 text-[11px] text-zinc-500 hover:text-indigo-400 transition-colors">
                            <MessageSquare className="w-3 h-3" />
                            DM
                          </Link>
                        )}
                        <span className="text-[10px] text-zinc-600 ml-auto">
                          {new Date(item.message.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <MarkdownMessage body={item.message.body} />
                    </div>
                  </div>
                  <div className="flex items-center justify-end mt-2 gap-2">
                    <Link
                      href={href}
                      className="text-[11px] text-zinc-600 hover:text-indigo-400 transition-colors"
                    >
                      Jump to message →
                    </Link>
                    <button
                      onClick={() => unsave(item.id)}
                      className="text-[11px] text-zinc-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
