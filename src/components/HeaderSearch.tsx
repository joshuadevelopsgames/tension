"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Search, Hash, MessageSquare, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type MessageResult = {
  id: string;
  body: string;
  channel_id: string | null;
  dm_conversation_id: string | null;
  channel_name?: string;
  created_at: string;
};

export function HeaderSearch({ channels }: { channels: { id: string; name: string }[] }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [messageResults, setMessageResults] = useState<MessageResult[]>([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const supabase = createClient();

  // ⌘K focuses the input instead of opening a modal
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        inputRef.current?.focus();
        setOpen(true);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Debounced message search
  useEffect(() => {
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    const trimmed = query.trim();
    if (trimmed.length < 2) { setMessageResults([]); return; }

    searchTimeoutRef.current = setTimeout(async () => {
      setSearching(true);
      const { data: ws } = await supabase
        .from("workspace_members").select("workspace_id").limit(1).single();
      if (!ws) { setSearching(false); return; }

      const { data: msgs } = await supabase
        .from("messages")
        .select("id, body, channel_id, dm_conversation_id, created_at")
        .eq("workspace_id", ws.workspace_id)
        .ilike("body", `%${trimmed}%`)
        .is("parent_id", null)
        .order("created_at", { ascending: false })
        .limit(8);

      const channelMap = new Map(channels.map((c) => [c.id, c.name]));
      setMessageResults((msgs ?? []).map((m: any) => ({
        ...m,
        channel_name: m.channel_id ? channelMap.get(m.channel_id) : undefined,
      })));
      setSearching(false);
    }, 300);
  }, [query, channels, supabase]);

  function navigate(path: string) {
    router.push(path);
    setOpen(false);
    setQuery("");
    inputRef.current?.blur();
  }

  function clear() {
    setQuery("");
    setMessageResults([]);
    inputRef.current?.focus();
  }

  const filteredChannels = query.trim()
    ? channels.filter((c) => c.name.toLowerCase().includes(query.toLowerCase().trim()))
    : channels.slice(0, 6);

  const hasResults = filteredChannels.length > 0 || messageResults.length > 0;

  return (
    <div
      ref={containerRef}
      className="relative w-[54rem]"
      onPointerDown={(e) => e.stopPropagation()}
    >
      {/* Input bar */}
      <div
        className="flex items-center gap-2 w-full px-3 py-1.5 rounded-lg border transition-all duration-150"
        style={{
          background: open ? "var(--t-raised)" : "var(--t-surface)",
          borderColor: open ? "var(--t-accent)" : "var(--t-border)",
          boxShadow: open ? "0 0 0 2px color-mix(in srgb, var(--t-accent) 15%, transparent)" : "none",
        }}
      >
        {searching
          ? <Loader2 className="w-3.5 h-3.5 shrink-0 animate-spin" style={{ color: "var(--t-accent)" }} />
          : <Search className="w-3.5 h-3.5 shrink-0" style={{ color: open ? "var(--t-accent)" : undefined }} />
        }
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); }
          }}
          placeholder="Search messages or jump to a channel…"
          className="flex-1 bg-transparent text-xs focus:outline-none placeholder:text-zinc-500"
          style={{ color: "var(--t-fg)", caretColor: "var(--t-accent)" }}
        />
        {query ? (
          <button
            onMouseDown={(e) => { e.preventDefault(); clear(); }}
            className="w-4 h-4 flex items-center justify-center rounded-full transition-colors hover:bg-[var(--t-accent)]/20"
            style={{ color: "var(--t-accent)" }}
          >
            <X className="w-3 h-3" />
          </button>
        ) : (
          <kbd
            className="px-1.5 py-0.5 rounded text-[10px] font-mono shrink-0"
            style={{
              background: "var(--t-surface)",
              border: "1px solid var(--t-border)",
              color: "color-mix(in srgb, var(--t-accent) 60%, var(--t-border))",
            }}
          >
            ⌘K
          </kbd>
        )}
      </div>

      {/* Dropdown */}
      {open && (
        <div
          className="absolute top-full left-0 mt-1.5 w-full rounded-xl overflow-hidden z-[200]"
          style={{
            background: "var(--t-raised)",
            border: "1px solid var(--t-border)",
            boxShadow: "0 16px 48px rgba(0,0,0,0.35)",
          }}
        >
          {!hasResults && !searching && (
            <p className="px-4 py-6 text-center text-xs" style={{ color: "color-mix(in srgb, var(--t-accent) 40%, #71717a)" }}>
              {query.trim().length > 1 ? "No results found." : "Type to search messages or jump to a channel."}
            </p>
          )}

          {filteredChannels.length > 0 && (
            <div>
              <p
                className="px-4 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: "var(--t-accent)", opacity: 0.7 }}
              >
                Channels
              </p>
              {filteredChannels.slice(0, 6).map((ch) => (
                <button
                  key={ch.id}
                  onMouseDown={() => navigate(`/channel?id=${ch.id}`)}
                  className="w-full flex items-center gap-3 px-4 py-2 text-sm text-left transition-colors group"
                  style={{ color: "var(--t-fg)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = `color-mix(in srgb, var(--t-accent) 8%, transparent)`)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <Hash className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--t-accent)", opacity: 0.6 }} />
                  <span className="font-medium">{ch.name}</span>
                </button>
              ))}
            </div>
          )}

          {messageResults.length > 0 && (
            <div className={filteredChannels.length > 0 ? "border-t" : ""} style={{ borderColor: "var(--t-border)" }}>
              <p
                className="px-4 pt-3 pb-1.5 text-[10px] font-semibold uppercase tracking-widest"
                style={{ color: "var(--t-accent)", opacity: 0.7 }}
              >
                Messages
              </p>
              {messageResults.map((msg) => (
                <button
                  key={msg.id}
                  onMouseDown={() => navigate(
                    msg.channel_id ? `/channel?id=${msg.channel_id}` : `/dm?id=${msg.dm_conversation_id}`
                  )}
                  className="w-full flex items-start gap-3 px-4 py-2.5 text-left transition-colors"
                  style={{ color: "var(--t-fg)" }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = `color-mix(in srgb, var(--t-accent) 8%, transparent)`)}
                  onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                >
                  <MessageSquare className="w-3.5 h-3.5 shrink-0 mt-0.5" style={{ color: "var(--t-accent)", opacity: 0.6 }} />
                  <div className="flex-1 min-w-0">
                    {msg.channel_name && (
                      <p className="text-[10px] mb-0.5" style={{ color: "var(--t-accent)", opacity: 0.6 }}>
                        #{msg.channel_name}
                      </p>
                    )}
                    <p className="text-xs truncate">{msg.body.slice(0, 100)}</p>
                  </div>
                  <span className="text-[10px] shrink-0 mt-0.5" style={{ color: "color-mix(in srgb, var(--t-accent) 40%, #71717a)" }}>
                    {new Date(msg.created_at).toLocaleDateString()}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Bottom padding */}
          <div className="h-2" />
        </div>
      )}
    </div>
  );
}
