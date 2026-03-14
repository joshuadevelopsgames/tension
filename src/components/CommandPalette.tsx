"use client";

import { useEffect, useState, useRef } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { Search, Hash, MessageSquare, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ModalPortal } from "@/components/ModalPortal";

type MessageResult = {
  id: string;
  body: string;
  channel_id: string | null;
  dm_conversation_id: string | null;
  channel_name?: string;
  created_at: string;
};

export function CommandPalette({
  channels,
}: {
  channels: { id: string; name: string }[];
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [messageResults, setMessageResults] = useState<MessageResult[]>([]);
  const [searching, setSearching] = useState(false);
  const router = useRouter();
  const supabase = createClient();
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((open) => !open);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  useEffect(() => {
    if (!open) { setQuery(""); setMessageResults([]); }
  }, [open]);

  // Debounced message search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    const trimmed = query.trim();

    // Only search messages if query looks like a message search (not just navigating channels)
    if (trimmed.length < 2) {
      setMessageResults([]);
      return;
    }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);

      // Get workspace
      const { data: ws } = await supabase.from("workspace_members").select("workspace_id").limit(1).single();
      if (!ws) { setSearching(false); return; }

      const { data: msgs } = await supabase
        .from("messages")
        .select("id, body, channel_id, dm_conversation_id, created_at")
        .eq("workspace_id", ws.workspace_id)
        .ilike("body", `%${trimmed}%`)
        .is("parent_id", null)
        .order("created_at", { ascending: false })
        .limit(8);

      // Attach channel names
      const channelMap = new Map(channels.map((c) => [c.id, c.name]));
      const results: MessageResult[] = (msgs ?? []).map((m: any) => ({
        ...m,
        channel_name: m.channel_id ? channelMap.get(m.channel_id) : undefined,
      }));

      setMessageResults(results);
      setSearching(false);
    }, 300);
  }, [query, channels, supabase]);

  function highlight(text: string, q: string) {
    if (!q.trim()) return text;
    const idx = text.toLowerCase().indexOf(q.toLowerCase().trim());
    if (idx === -1) return text;
    const maxLen = 80;
    const start = Math.max(0, idx - 20);
    const snippet = (start > 0 ? "…" : "") + text.slice(start, start + maxLen) + (start + maxLen < text.length ? "…" : "");
    return snippet;
  }

  function navigateToMessage(msg: MessageResult) {
    if (msg.channel_id) router.push(`/channel?id=${msg.channel_id}`);
    else if (msg.dm_conversation_id) router.push(`/dm?id=${msg.dm_conversation_id}`);
    setOpen(false);
  }

  if (!open) return null;

  // Filter channels by query
  const filteredChannels = query.trim()
    ? channels.filter((c) => c.name.toLowerCase().includes(query.toLowerCase().trim()))
    : channels;

  return (
    <ModalPortal>
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] pb-[15vh]">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
      <div className="relative w-full max-w-lg bg-neutral-900/90 border border-white/10 rounded-xl shadow-2xl backdrop-blur-3xl overflow-hidden flex flex-col max-h-full">
        <Command
          className="flex flex-col flex-1 min-h-0"
          shouldFilter={false}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
        >
          <div className="flex items-center px-4 border-b border-white/10" cmdk-input-wrapper="">
            {searching ? (
              <Loader2 className="w-4 h-4 text-zinc-500 mr-2 shrink-0 animate-spin" />
            ) : (
              <Search className="w-4 h-4 text-zinc-500 mr-2 shrink-0" />
            )}
            <Command.Input
              autoFocus
              value={query}
              onValueChange={setQuery}
              placeholder="Search messages or jump to channel…"
              className="flex-1 py-4 bg-transparent outline-none text-zinc-100 placeholder:text-zinc-500 text-sm"
            />
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-zinc-500 hover:text-zinc-300 text-xs ml-2 transition-colors"
              >
                Clear
              </button>
            )}
          </div>

          <Command.List className="overflow-y-auto p-2 min-h-[300px]">
            <Command.Empty className="py-6 text-center text-zinc-500 text-sm">
              {query.trim().length > 1 && !searching ? "No results found." : "Type to search messages or jump to a channel."}
            </Command.Empty>

            {/* Channel results */}
            {filteredChannels.length > 0 && (
              <Command.Group heading="Channels" className="text-xs font-medium text-zinc-500 px-2 py-2">
                {filteredChannels.slice(0, 5).map((ch) => (
                  <Command.Item
                    key={ch.id}
                    value={`channel-${ch.id}`}
                    onSelect={() => { router.push(`/channel?id=${ch.id}`); setOpen(false); }}
                    className="flex items-center px-2 py-2.5 rounded-md cursor-pointer text-zinc-300 text-sm aria-selected:bg-indigo-500 aria-selected:text-white"
                  >
                    <Hash className="w-4 h-4 mr-2 opacity-70 shrink-0" />
                    {ch.name}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Message search results */}
            {messageResults.length > 0 && (
              <Command.Group heading="Messages" className="text-xs font-medium text-zinc-500 px-2 py-2 mt-2">
                {messageResults.map((msg) => (
                  <Command.Item
                    key={msg.id}
                    value={`msg-${msg.id}`}
                    onSelect={() => navigateToMessage(msg)}
                    className="flex items-start gap-2 px-2 py-2.5 rounded-md cursor-pointer text-zinc-300 text-sm aria-selected:bg-indigo-500 aria-selected:text-white"
                  >
                    <MessageSquare className="w-4 h-4 mr-1 opacity-70 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      {msg.channel_name && (
                        <span className="text-[10px] font-medium text-zinc-500 aria-selected:text-indigo-200 block mb-0.5">
                          #{msg.channel_name}
                        </span>
                      )}
                      <span className="truncate block text-xs">{highlight(msg.body, query)}</span>
                    </div>
                    <span className="text-[10px] text-zinc-600 shrink-0 mt-0.5">
                      {new Date(msg.created_at).toLocaleDateString()}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
    </ModalPortal>
  );
}
