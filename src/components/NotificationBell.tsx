"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { Bell, Check, X } from "lucide-react";
import Link from "next/link";

type Notification = {
  id: string;
  type: "mention" | "reply" | "dm";
  body_preview: string | null;
  read: boolean;
  created_at: string;
  channel_id: string | null;
  dm_conversation_id: string | null;
  actor_id: string;
};

export function NotificationBell({ currentUserId }: { currentUserId: string }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const supabase = createClient();

  const unreadCount = notifications.filter((n) => !n.read).length;

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("notifications")
        .select("id, type, body_preview, read, created_at, channel_id, dm_conversation_id, actor_id")
        .eq("user_id", currentUserId)
        .order("created_at", { ascending: false })
        .limit(20);
      setNotifications(data ?? []);
    }
    load();
  }, [currentUserId, supabase]);

  // Realtime
  useEffect(() => {
    const sub = supabase
      .channel(`notifs:${currentUserId}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${currentUserId}`,
      }, (payload) => {
        setNotifications((prev) => [payload.new as Notification, ...prev]);
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [currentUserId, supabase]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function markRead(id: string) {
    await supabase.from("notifications").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
  }

  async function markAllRead() {
    await supabase.from("notifications").update({ read: true }).eq("user_id", currentUserId).eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
  }

  function getLabel(n: Notification) {
    if (n.type === "mention") return "mentioned you";
    if (n.type === "reply") return "replied to your message";
    if (n.type === "dm") return "sent you a message";
    return "";
  }

  function getLink(n: Notification) {
    if (n.channel_id) return `/channel?id=${n.channel_id}`;
    if (n.dm_conversation_id) return `/dm?id=${n.dm_conversation_id}`;
    return "/";
  }

  const typeColors: Record<string, string> = {
    mention: "bg-[var(--t-accent)]",
    reply:   "bg-[var(--t-accent)]",
    dm:      "bg-amber-500",
  };

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="relative p-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-zinc-200 transition-colors"
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-[var(--t-accent)] text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl z-50 overflow-hidden animate-pop-in" style={{ background: "var(--t-raised)", border: "1px solid var(--t-border)", boxShadow: "var(--t-shadow-high)" }}>
          <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--t-border)]">
            <span className="text-xs font-semibold text-zinc-300">Notifications</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-[11px] text-[var(--t-accent)] hover:text-[var(--t-accent)]/80 transition-colors">
                Mark all read
              </button>
            )}
          </div>
          <div className="overflow-y-auto max-h-80">
            {notifications.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
                <Bell className="w-8 h-8 mb-2 opacity-20" style={{ color: "var(--t-accent)" }} />
                <p className="text-xs font-medium" style={{ color: "var(--t-fg-2)" }}>You're all caught up</p>
                <p className="text-[11px] mt-0.5" style={{ color: "var(--t-fg-3)" }}>Mentions and replies will appear here.</p>
              </div>
            ) : (
              <ul>
                {notifications.map((n) => (
                  <li key={n.id} className={`border-b border-[var(--t-border)] last:border-0 ${!n.read ? "bg-white/[0.02]" : ""}`}>
                    <Link
                      href={getLink(n)}
                      onClick={() => { markRead(n.id); setOpen(false); }}
                      className="flex items-start gap-3 px-4 py-3 hover:bg-white/5 transition-colors block"
                    >
                      <div className={`w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 ${!n.read ? typeColors[n.type] ?? "bg-zinc-500" : "bg-zinc-700"}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-zinc-300 font-medium">
                          <span className="text-zinc-500">User {n.actor_id.slice(0, 4)}</span> {getLabel(n)}
                        </p>
                        {n.body_preview && (
                          <p className="text-[11px] text-zinc-500 mt-0.5 truncate">"{n.body_preview}"</p>
                        )}
                        <p className="text-[10px] text-zinc-700 mt-0.5">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </div>
                      {!n.read && (
                        <button
                          onClick={(e) => { e.preventDefault(); markRead(n.id); }}
                          className="shrink-0 p-1 rounded hover:bg-white/10 text-zinc-600 hover:text-zinc-300 transition-colors"
                        >
                          <Check className="w-3 h-3" />
                        </button>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
