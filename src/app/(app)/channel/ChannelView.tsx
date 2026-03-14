"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Check, ChevronDown, Hash, MessageSquare, Pencil, Send, Smile, Trash2, X } from "lucide-react";
import { MessageReactions } from "@/components/MessageReactions";
import { MessageFiles } from "@/components/MessageFiles";
import { MessageComposer, type UploadedFile } from "@/components/MessageComposer";
import { UserAvatar } from "@/components/UserAvatar";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import { DateSeparator, isDifferentDay } from "@/components/DateSeparator";

type Message = {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
  parent_id: string | null;
  users?: {
    full_name: string | null;
    avatar_url: string | null;
  };
};

type Channel = {
  id: string;
  name: string;
  topic: string | null;
  client_tag: string | null;
  campaign_tag: string | null;
  workspace_id: string;
};

const COMMON_EMOJI = [
  "👍", "👎", "❤️", "😂", "😮", "😢", "🔥", "🎉",
  "✅", "🚀", "💯", "👀", "🤔", "💡", "⚡", "🙏",
  "😎", "🫡", "💪", "🎯", "📌", "⚠️", "🏆", "✨",
];

// ─── Message Row with edit/delete ────────────────────────────────────────────

function MessageRow({
  m,
  prev,
  currentUserId,
  workspaceId,
  onThreadClick,
  replyCount,
  onEdit,
  onDelete,
}: {
  m: Message;
  prev: Message | null;
  currentUserId: string | null;
  workspaceId: string | null;
  onThreadClick?: (msg: Message) => void;
  replyCount?: number;
  onEdit: (id: string, newBody: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(m.body);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const editRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const isOwn = currentUserId === m.sender_id;
  const supabaseRow = createClient();

  // Close picker on outside click
  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setPickerOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

  // Directly toggle a quick-reaction (realtime sub in MessageReactions will update UI)
  async function handleQuickReact(emoji: string) {
    if (!currentUserId) return;
    const { data: existing } = await supabaseRow
      .from("message_reactions")
      .select("id")
      .eq("message_id", m.id)
      .eq("user_id", currentUserId)
      .eq("emoji", emoji)
      .maybeSingle();
    if (existing) {
      await supabaseRow.from("message_reactions").delete().eq("id", existing.id);
    } else {
      await supabaseRow.from("message_reactions").insert({ message_id: m.id, user_id: currentUserId, emoji });
    }
  }

  const time = new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  const isGrouped =
    prev !== null &&
    prev.sender_id === m.sender_id &&
    new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() <= 3600000;

  useEffect(() => {
    if (isEditing) editRef.current?.focus();
  }, [isEditing]);

  async function saveEdit() {
    if (!editDraft.trim() || editDraft.trim() === m.body) { setIsEditing(false); return; }
    setSaving(true);
    await onEdit(m.id, editDraft.trim());
    setSaving(false);
    setIsEditing(false);
  }

  function cancelEdit() { setEditDraft(m.body); setIsEditing(false); }

  // Hover action buttons
  const actionBar = !isEditing ? (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 bg-zinc-800 border border-white/10 rounded-lg p-0.5 shadow-xl transition-all">
      {/* Quick emoji reactions (first 4 from the full set) */}
      {currentUserId && COMMON_EMOJI.slice(0, 4).map((emoji) => (
        <button
          key={emoji}
          onClick={() => handleQuickReact(emoji)}
          className="w-7 h-7 flex items-center justify-center text-sm rounded hover:bg-white/10 transition-colors"
          title={`React with ${emoji}`}
        >
          {emoji}
        </button>
      ))}

      {/* Divider */}
      {currentUserId && <span className="w-px h-4 bg-white/10 mx-0.5" />}

      {/* More reactions button + picker popover */}
      {currentUserId && (
        <div className="relative" ref={pickerRef}>
          <button
            onClick={() => setPickerOpen((o) => !o)}
            className={`p-1.5 rounded hover:bg-white/10 transition-colors ${pickerOpen ? "text-indigo-400" : "text-zinc-400 hover:text-zinc-200"}`}
            title="More reactions"
          >
            <Smile className="w-3.5 h-3.5" />
          </button>
          {pickerOpen && (
            <div className="absolute bottom-full right-0 mb-2 bg-zinc-800 border border-white/10 rounded-xl p-2 shadow-2xl grid grid-cols-8 gap-0.5 z-50 w-56">
              {COMMON_EMOJI.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => { handleQuickReact(emoji); setPickerOpen(false); }}
                  className="w-7 h-7 flex items-center justify-center text-base rounded hover:bg-white/10 transition-colors"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Divider */}
      {onThreadClick && <span className="w-px h-4 bg-white/10 mx-0.5" />}

      {/* Thread */}
      {onThreadClick && (
        <button
          onClick={() => onThreadClick(m)}
          className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Reply in thread"
        >
          <MessageSquare className="w-3.5 h-3.5" />
        </button>
      )}

      {/* Edit / Delete (own messages only) */}
      {isOwn && (
        <>
          <span className="w-px h-4 bg-white/10 mx-0.5" />
          <button
            onClick={() => { setEditDraft(m.body); setIsEditing(true); }}
            className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Edit message"
          >
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onDelete(m.id)}
            className="p-1.5 rounded hover:bg-red-500/20 text-zinc-400 hover:text-red-400 transition-colors"
            title="Delete message"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </>
      )}
    </div>
  ) : null;

  const bodyContent = isEditing ? (
    <div className="flex items-center gap-2 mt-0.5">
      <input
        ref={editRef}
        value={editDraft}
        onChange={(e) => setEditDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") saveEdit();
          if (e.key === "Escape") cancelEdit();
        }}
        className="flex-1 bg-black/30 border border-indigo-500/40 rounded-md px-2 py-1 text-[14px] text-zinc-200 focus:outline-none"
      />
      <button onClick={saveEdit} disabled={saving} className="p-1 rounded hover:bg-white/10 text-indigo-400 hover:text-indigo-300 disabled:opacity-40">
        <Check className="w-3.5 h-3.5" />
      </button>
      <button onClick={cancelEdit} className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  ) : (
    <>
      {m.body.trim() && <MarkdownMessage body={m.body} />}
      <MessageFiles messageId={m.id} />
      {currentUserId && (
        <MessageReactions messageId={m.id} currentUserId={currentUserId} />
      )}
      {onThreadClick && typeof replyCount === "number" && replyCount > 0 && (
        <button
          onClick={() => onThreadClick(m)}
          className="mt-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 flex items-center gap-1 transition-colors"
        >
          <MessageSquare className="w-3 h-3" />
          {replyCount} {replyCount === 1 ? "reply" : "replies"}
        </button>
      )}
    </>
  );

  if (isGrouped) {
    return (
      <div className="flex gap-4 group mt-1 hover:bg-white/[0.02] -mx-4 px-4 py-0.5 rounded-sm relative">
        <div className="w-8 shrink-0 text-right">
          <span className="text-[10px] font-medium text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap block mt-1">
            {time}
          </span>
        </div>
        <div className="flex-1 min-w-0">{bodyContent}</div>
        {actionBar}
      </div>
    );
  }

  return (
    <div className="flex gap-4 group mt-4 hover:bg-white/[0.02] -mx-4 px-4 py-1 rounded-sm relative">
      <UserAvatar
        userId={m.sender_id}
        displayName={m.users?.full_name || undefined}
        avatarUrl={m.users?.avatar_url}
        size="md"
        showStatus={true}
        workspaceId={workspaceId ?? undefined}
        currentUserId={currentUserId ?? undefined}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-[13px] font-semibold text-zinc-200">
            {m.users?.full_name || `User ${m.sender_id.slice(0, 4)}`}
          </span>
          <span className="text-[10px] font-medium text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
            {time}
          </span>
        </div>
        {bodyContent}
      </div>
      {actionBar}
    </div>
  );
}

// ─── Thread Panel ─────────────────────────────────────────────────────────────

function ThreadPanel({
  parentMessage,
  channelId,
  workspaceId,
  currentUserId,
  onClose,
  onReplyAdded,
}: {
  parentMessage: Message;
  channelId: string;
  workspaceId: string;
  currentUserId: string;
  onClose: () => void;
  onReplyAdded: (parentId: string) => void;
}) {
  const [replies, setReplies] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const supabase = createClient();
  const endRef = useRef<HTMLDivElement>(null);
  const lastSentRef = useRef<string | null>(null);

  useEffect(() => {
    async function loadReplies() {
      const { data } = await supabase
        .from("messages")
        .select(`
          id, 
          body, 
          sender_id, 
          created_at, 
          parent_id,
          users:sender_id (
            full_name,
            avatar_url
          )
        `)
        .eq("parent_id", parentMessage.id)
        .order("created_at", { ascending: true });
      
      const repliesWithProfiles = (data ?? []).map(m => ({
        ...m,
        users: Array.isArray(m.users) ? m.users[0] : m.users
      })) as Message[];
      
      setReplies(repliesWithProfiles);
    }
    loadReplies();
    setDraft("");
  }, [parentMessage.id, supabase]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [replies]);

  useEffect(() => {
    const sub = supabase
      .channel(`thread:${parentMessage.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `parent_id=eq.${parentMessage.id}` },
        (payload) => {
          const msg = payload.new as Message;
          
          // Fetch profile for the new reply
          supabase.from("users")
            .select("full_name, avatar_url")
            .eq("id", msg.sender_id)
            .single()
            .then(({ data }) => {
              if (data) msg.users = data;
              setReplies((prev) => {
                if (prev.some((m) => m.id === msg.id)) {
                  return prev.map(m => m.id === msg.id ? { ...m, ...msg } : m);
                }
                return [...prev, msg];
              });
            });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "messages", filter: `parent_id=eq.${parentMessage.id}` },
        (payload) => {
          const updated = payload.new as Message;
          setReplies((prev) => prev.map((m) => m.id === updated.id ? updated : m));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: "messages" },
        (payload) => {
          setReplies((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [parentMessage.id, supabase]);

  async function handleEdit(id: string, newBody: string) {
    const { data } = await supabase.from("messages").update({ body: newBody }).eq("id", id).select().single();
    if (data) setReplies((prev) => prev.map((m) => m.id === id ? data as Message : m));
  }

  async function handleDelete(id: string) {
    await supabase.from("messages").delete().eq("id", id);
    setReplies((prev) => prev.filter((m) => m.id !== id));
  }

  async function sendReply() {
    const toSend = draft.trim();
    if (!toSend || toSend === lastSentRef.current) return;
    setDraft("");
    lastSentRef.current = toSend;

    const realId = crypto.randomUUID();
    const optimistic: Message = {
      id: realId, body: toSend, sender_id: currentUserId,
      created_at: new Date().toISOString(), parent_id: parentMessage.id,
    };
    setReplies((prev) => [...prev, optimistic]);

    const { data, error } = await supabase.from("messages").insert({
      id: realId, workspace_id: workspaceId, sender_id: currentUserId,
      channel_id: channelId, parent_id: parentMessage.id, body: toSend,
    }).select().single();

    if (error) {
      setReplies((prev) => prev.filter((m) => m.id !== realId));
    } else {
      setReplies((prev) => prev.map((m) => (m.id === realId ? (data as Message) : m)));
      onReplyAdded(parentMessage.id);
    }
  }

  return (
    <div className="w-80 flex flex-col border-l border-white/5 bg-zinc-900/60 shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-xs font-semibold text-zinc-300">Thread</span>
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="px-4 py-3 border-b border-white/5">
        <div className="flex gap-3">
          <UserAvatar
            userId={parentMessage.sender_id}
            displayName={parentMessage.users?.full_name || undefined}
            avatarUrl={parentMessage.users?.avatar_url}
            size="sm"
          />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold text-zinc-300 mb-0.5">
              {parentMessage.users?.full_name || `User ${parentMessage.sender_id.slice(0, 4)}`}
            </p>
            <MarkdownMessage body={parentMessage.body} />
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {replies.length === 0 && (
          <p className="text-xs text-zinc-600 text-center py-4">No replies yet. Start the thread.</p>
        )}
        {replies.map((r) => (
          <div key={r.id} className="flex gap-3 group mt-3 hover:bg-white/[0.02] -mx-2 px-2 py-1 rounded-sm relative">
          <UserAvatar
            userId={r.sender_id}
            displayName={r.users?.full_name || undefined}
            avatarUrl={r.users?.avatar_url}
            size="sm"
          />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <span className="text-[11px] font-semibold text-zinc-300">
                  {r.users?.full_name || `User ${r.sender_id.slice(0, 4)}`}
                </span>
                <span className="text-[10px] text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
                  {new Date(r.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
              <MarkdownMessage body={r.body} />
            </div>
            {currentUserId === r.sender_id && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 bg-zinc-800 border border-white/10 rounded-md p-0.5 shadow-lg">
                <button onClick={() => handleDelete(r.id)} className="p-1 rounded hover:bg-red-500/20 text-zinc-500 hover:text-red-400 transition-colors">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        ))}
        <div ref={endRef} />
      </div>

      <div className="p-3 pt-2 shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); sendReply(); }}
          className="flex items-end gap-2 bg-black/40 border border-white/10 rounded-xl p-1 focus-within:border-white/20 transition-colors"
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => { setDraft(e.target.value); lastSentRef.current = null; }}
            placeholder="Reply to thread…"
            className="flex-1 bg-transparent px-3 py-2 text-[13px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
          />
          <button type="submit" disabled={!draft.trim()} className="p-1.5 mb-0.5 mr-0.5 rounded-lg bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-30 transition-colors">
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Main ChannelView ─────────────────────────────────────────────────────────

export function ChannelView({
  channel,
  initialMessages,
}: {
  channel: Channel;
  initialMessages: Message[];
}) {
  const [allMessages, setAllMessages] = useState<Message[]>(initialMessages);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const workspaceId = channel.workspace_id;
  const [threadParent, setThreadParent] = useState<Message | null>(null);
  const [replyCounts, setReplyCounts] = useState<Record<string, number>>(() => {
    const counts: Record<string, number> = {};
    for (const m of initialMessages) {
      if (m.parent_id) counts[m.parent_id] = (counts[m.parent_id] ?? 0) + 1;
    }
    return counts;
  });

  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const supabase = createClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const cachedProfileRef = useRef<{ full_name: string | null; avatar_url: string | null } | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const topLevelMessages = allMessages.filter((m) => m.parent_id === null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      const uid = data.user?.id || null;
      setCurrentUserId(uid);
      if (uid) {
        supabase.from("users").select("full_name, avatar_url").eq("id", uid).single()
          .then(({ data: profile }) => { if (profile) cachedProfileRef.current = profile; });
      }
    });
  }, [supabase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [topLevelMessages.length]);

  useEffect(() => {
    const sub = supabase
      .channel(`channel:${channel.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${channel.id}` }, (payload) => {
        const newMsg = payload.new as Message;
        
        // Fetch profile for the new message to avoid placeholders
        supabase.from("users")
          .select("full_name, avatar_url")
          .eq("id", newMsg.sender_id)
          .single()
          .then(({ data }) => {
            if (data) newMsg.users = data;
            setAllMessages((prev) => {
              if (prev.some((m) => m.id === newMsg.id)) {
                // Update existing optimistic message with real data if it exists
                return prev.map(m => m.id === newMsg.id ? { ...m, ...newMsg } : m);
              }
              if (prev.some((m) => m.body === newMsg.body && m.created_at === newMsg.created_at)) return prev;
              return [...prev, newMsg];
            });
          });

        if (newMsg.parent_id) {
          setReplyCounts((prev) => ({ ...prev, [newMsg.parent_id!]: (prev[newMsg.parent_id!] ?? 0) + 1 }));
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `channel_id=eq.${channel.id}` }, (payload) => {
        const updated = payload.new as Message;
        setAllMessages((prev) => prev.map((m) => m.id === updated.id ? updated : m));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => {
        setAllMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [channel.id, supabase]);

  // Typing indicator broadcast channel
  useEffect(() => {
    const ch = supabase.channel(`typing:channel:${channel.id}`);
    typingChannelRef.current = ch;
    ch.on("broadcast", { event: "typing" }, ({ payload }: { payload: { userId: string; name: string } }) => {
      const { userId, name } = payload;
      if (userId === currentUserId) return;
      // Clear existing auto-expire timer for this user
      const existing = typingTimeoutsRef.current.get(userId);
      if (existing) clearTimeout(existing);
      setTypingUsers((prev) => new Map(prev).set(userId, name));
      // Auto-remove after 3 s of silence
      const t = setTimeout(() => {
        setTypingUsers((prev) => { const n = new Map(prev); n.delete(userId); return n; });
        typingTimeoutsRef.current.delete(userId);
      }, 3000);
      typingTimeoutsRef.current.set(userId, t);
    }).subscribe();
    return () => {
      supabase.removeChannel(ch);
      typingChannelRef.current = null;
      typingTimeoutsRef.current.forEach(clearTimeout);
      typingTimeoutsRef.current.clear();
    };
  }, [channel.id, currentUserId, supabase]);

  function handleTyping() {
    if (!currentUserId || !typingChannelRef.current) return;
    const name = cachedProfileRef.current?.full_name || "Someone";
    typingChannelRef.current.send({ type: "broadcast", event: "typing", payload: { userId: currentUserId, name } });
  }

  function handleScroll() {
    const el = scrollContainerRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
  }

  const handleReplyAdded = useCallback((parentId: string) => {
    setReplyCounts((prev) => ({ ...prev, [parentId]: (prev[parentId] ?? 0) + 1 }));
  }, []);

  async function handleEdit(id: string, newBody: string) {
    const { data } = await supabase.from("messages").update({ body: newBody }).eq("id", id).select().single();
    if (data) setAllMessages((prev) => prev.map((m) => m.id === id ? data as Message : m));
  }

  async function handleDelete(id: string) {
    await supabase.from("messages").delete().eq("id", id);
    setAllMessages((prev) => prev.filter((m) => m.id !== id));
    setReplyCounts((prev) => {
      const updated = { ...prev };
      delete updated[id];
      return updated;
    });
  }

  async function handleSend(body: string, files: UploadedFile[]) {
    if (!currentUserId) return;
    const wsId = workspaceId;

    const realId = crypto.randomUUID();
    const optimistic: Message = {
      id: realId, body: body.trim() || " ", sender_id: currentUserId,
      created_at: new Date().toISOString(), parent_id: null,
      // Use cached profile so we don't block the send with a network round-trip
      users: cachedProfileRef.current ?? undefined,
    };

    setAllMessages((prev) => [...prev, optimistic]);

    const { data, error } = await supabase.from("messages")
      .insert({ id: realId, workspace_id: wsId, sender_id: currentUserId, channel_id: channel.id, body: body.trim() || " " })
      .select().single();

    if (error) {
      setAllMessages((prev) => prev.filter((m) => m.id !== realId));
      return;
    }
    setAllMessages((prev) => prev.map((m) => (m.id === realId ? (data as Message) : m)));

    // Insert file records
    if (files.length > 0) {
      await supabase.from("message_files").insert(
        files.map((f) => ({
          message_id: realId,
          workspace_id: wsId,
          uploaded_by: currentUserId,
          file_name: f.file_name,
          file_size: f.file_size,
          mime_type: f.mime_type,
          storage_path: f.storage_path,
          public_url: f.public_url,
        }))
      );
    }

    // Detect @mentions and create notifications
    const mentionMatches = [...body.matchAll(/@(\w[\w.-]*)/g)].map((m) => m[1].toLowerCase());
    if (mentionMatches.length > 0) {
      const { data: members } = await supabase
        .from("workspace_members")
        .select("user_id, users(full_name)")
        .eq("workspace_id", wsId)
        .neq("user_id", currentUserId);

      const notifTargets: string[] = [];
      for (const member of members ?? []) {
        const name = ((member as any).users?.full_name ?? "").toLowerCase().replace(/\s+/g, "");
        const isEveryone = mentionMatches.some((m) => ["channel", "everyone", "here"].includes(m));
        const isNamed = mentionMatches.some((m) => name.startsWith(m) && m.length >= 2);
        if (isEveryone || isNamed) notifTargets.push((member as any).user_id);
      }

      if (notifTargets.length > 0) {
        await supabase.from("notifications").insert(
          notifTargets.map((uid) => ({
            workspace_id: wsId,
            user_id: uid,
            actor_id: currentUserId,
            message_id: realId,
            channel_id: channel.id,
            type: "mention",
            body_preview: body.slice(0, 120),
          }))
        );
      }
    }
  }

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex flex-col flex-1 overflow-hidden">
        <header className="px-6 py-4 pt-10 flex items-center justify-between shrink-0 border-b border-white/5 select-none">
          <div className="flex items-center gap-3">
            <h2 className="font-semibold text-zinc-100 uppercase tracking-widest text-[11px] flex items-center gap-1.5">
              <Hash className="w-3.5 h-3.5 text-zinc-500" /> {channel.name}
            </h2>
            {channel.topic && <span className="text-zinc-500 text-[11px] font-medium">— {channel.topic}</span>}
          </div>
          {(channel.client_tag || channel.campaign_tag) && (
            <div className="flex items-center gap-2">
              {[channel.client_tag, channel.campaign_tag].filter(Boolean).map((tag) => (
                <span key={tag} className="px-2 py-0.5 rounded outline outline-1 outline-white/10 bg-white/5 text-[10px] font-mono text-zinc-400">{tag}</span>
              ))}
            </div>
          )}
        </header>

        <div className="relative flex-1 min-h-0 overflow-hidden">
          <div
            ref={scrollContainerRef}
            onScroll={handleScroll}
            className="h-full overflow-y-auto"
          >
            <div className="flex flex-col justify-end min-h-full px-6 py-4">
              {topLevelMessages.length === 0 ? (
                <div className="flex-1 flex items-center justify-center py-16">
                  <p className="text-zinc-600 text-sm font-medium">No messages yet. Start the conversation.</p>
                </div>
              ) : (
                <>
                  {topLevelMessages.map((m, i) => {
                    const prev = topLevelMessages[i - 1] ?? null;
                    const showDate = !prev || isDifferentDay(prev.created_at, m.created_at);
                    return (
                      <div key={m.id}>
                        {showDate && <DateSeparator date={m.created_at} />}
                        <MessageRow
                          m={m}
                          prev={showDate ? null : prev}
                          currentUserId={currentUserId}
                          workspaceId={workspaceId}
                          onThreadClick={setThreadParent}
                          replyCount={replyCounts[m.id] ?? 0}
                          onEdit={handleEdit}
                          onDelete={handleDelete}
                        />
                      </div>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </>
              )}
            </div>
          </div>

          {/* Jump-to-bottom button */}
          {showScrollBtn && (
            <button
              onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
              className="absolute bottom-4 right-6 w-8 h-8 bg-zinc-800 border border-white/10 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 shadow-xl transition-all z-10"
              title="Jump to bottom"
            >
              <ChevronDown className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Typing indicator */}
        <div className="px-6 h-5 shrink-0 flex items-center">
          {typingUsers.size > 0 && (
            <div className="flex items-center gap-2 text-[11px] text-zinc-500">
              <span className="flex gap-0.5 items-end">
                {[0, 1, 2].map((i) => (
                  <span
                    key={i}
                    className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce"
                    style={{ animationDelay: `${i * 150}ms` }}
                  />
                ))}
              </span>
              <span>
                {Array.from(typingUsers.values()).join(", ")} {typingUsers.size === 1 ? "is" : "are"} typing…
              </span>
            </div>
          )}
        </div>

        {currentUserId && (
          <MessageComposer
            placeholder={`Message #${channel.name}`}
            workspaceId={workspaceId}
            currentUserId={currentUserId}
            onSend={handleSend}
            onTyping={handleTyping}
          />
        )}
      </div>

      {threadParent && currentUserId && (
        <ThreadPanel
          parentMessage={threadParent}
          channelId={channel.id}
          workspaceId={workspaceId}
          currentUserId={currentUserId}
          onClose={() => setThreadParent(null)}
          onReplyAdded={handleReplyAdded}
        />
      )}
    </div>
  );
}
