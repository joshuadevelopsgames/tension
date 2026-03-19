"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Bookmark, BookmarkCheck, Check, ChevronDown, Copy, FileText, Hash,
  Loader2, MessageSquare, Pencil, Pin, PinOff, Send, Settings, Smile,
  Sparkles, Trash2, X,
} from "lucide-react";
import { MessageReactions } from "@/components/MessageReactions";
import { MessageFiles } from "@/components/MessageFiles";
import { MessageComposer, type UploadedFile } from "@/components/MessageComposer";
import { UserAvatar } from "@/components/UserAvatar";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import { DateSeparator, isDifferentDay } from "@/components/DateSeparator";
import { ChannelSettingsModal } from "@/components/ChannelSettingsModal";

type Message = {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
  parent_id: string | null;
  urgent?: boolean;
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

// ─── Message Row ──────────────────────────────────────────────────────────────

function MessageRow({
  m,
  prev,
  currentUserId,
  workspaceId,
  onThreadClick,
  replyCount,
  onEdit,
  onDelete,
  onPin,
  isPinned,
  onSave,
  isSaved,
}: {
  m: Message;
  prev: Message | null;
  currentUserId: string | null;
  workspaceId: string | null;
  onThreadClick?: (msg: Message) => void;
  replyCount?: number;
  onEdit: (id: string, newBody: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onPin?: (id: string) => void;
  isPinned?: boolean;
  onSave?: (id: string) => void;
  isSaved?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [editDraft, setEditDraft] = useState(m.body);
  const [saving, setSaving] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const editRef = useRef<HTMLInputElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const isOwn = currentUserId === m.sender_id;
  const supabaseRow = createClient();

  useEffect(() => {
    if (!pickerOpen) return;
    const handler = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) setPickerOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pickerOpen]);

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

  const actionBar = !isEditing ? (
    <div className="absolute right-4 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 flex items-center gap-0.5 bg-zinc-800 border border-white/10 rounded-lg p-0.5 shadow-xl transition-all">
      {currentUserId && COMMON_EMOJI.slice(0, 4).map((emoji) => (
        <button
          key={emoji}
          onClick={() => handleQuickReact(emoji)}
          className="w-7 h-7 flex items-center justify-center text-sm rounded hover:bg-white/10 transition-colors"
        >
          {emoji}
        </button>
      ))}

      {currentUserId && <span className="w-px h-4 bg-white/10 mx-0.5" />}

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

      {onPin && <span className="w-px h-4 bg-white/10 mx-0.5" />}
      {onPin && (
        <button
          onClick={() => onPin(m.id)}
          className={`p-1.5 rounded hover:bg-white/10 transition-colors ${isPinned ? "text-amber-400" : "text-zinc-400 hover:text-zinc-200"}`}
          title={isPinned ? "Unpin message" : "Pin message"}
        >
          {isPinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
        </button>
      )}

      {onSave && (
        <button
          onClick={() => onSave(m.id)}
          className={`p-1.5 rounded hover:bg-white/10 transition-colors ${isSaved ? "text-indigo-400" : "text-zinc-400 hover:text-zinc-200"}`}
          title={isSaved ? "Remove from saved" : "Save message"}
        >
          {isSaved ? <BookmarkCheck className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
        </button>
      )}

      {onThreadClick && <span className="w-px h-4 bg-white/10 mx-0.5" />}
      {onThreadClick && (
        <button
          onClick={() => onThreadClick(m)}
          className="p-1.5 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
          title="Reply in thread"
        >
          <MessageSquare className="w-3.5 h-3.5" />
        </button>
      )}

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
      {currentUserId && <MessageReactions messageId={m.id} currentUserId={currentUserId} />}
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

  const urgentBorder = m.urgent ? "border-l-2 border-amber-500/60 pl-2" : "";

  if (isGrouped) {
    return (
      <div className={`flex gap-4 group mt-1 hover:bg-white/[0.02] -mx-4 px-4 py-0.5 rounded-sm relative ${urgentBorder}`}>
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
    <div className={`flex gap-4 group mt-4 hover:bg-white/[0.02] -mx-4 px-4 py-1 rounded-sm relative ${urgentBorder}`}>
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
          {m.urgent && (
            <span className="flex items-center gap-0.5 text-[10px] font-semibold text-amber-500 bg-amber-500/10 px-1.5 py-0.5 rounded-full">
              ⚠️ Urgent
            </span>
          )}
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
  const [draftLoading, setDraftLoading] = useState(false);
  const supabase = createClient();
  const endRef = useRef<HTMLDivElement>(null);
  const lastSentRef = useRef<string | null>(null);

  useEffect(() => {
    async function loadReplies() {
      const { data } = await supabase
        .from("messages")
        .select(`id, body, sender_id, created_at, parent_id, users:sender_id(full_name, avatar_url)`)
        .eq("parent_id", parentMessage.id)
        .order("created_at", { ascending: true });

      setReplies(((data ?? []).map((m: any) => ({
        ...m,
        users: Array.isArray(m.users) ? m.users[0] : m.users,
      }))) as Message[]);
    }
    loadReplies();
    setDraft("");
  }, [parentMessage.id, supabase]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [replies]);

  useEffect(() => {
    const sub = supabase
      .channel(`thread:${parentMessage.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `parent_id=eq.${parentMessage.id}` }, (payload) => {
        const msg = payload.new as Message;
        supabase.from("users").select("full_name, avatar_url").eq("id", msg.sender_id).single().then(({ data }) => {
          if (data) msg.users = data;
          setReplies((prev) => {
            if (prev.some((m) => m.id === msg.id)) return prev.map((m) => m.id === msg.id ? { ...m, ...msg } : m);
            return [...prev, msg];
          });
        });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `parent_id=eq.${parentMessage.id}` }, (payload) => {
        setReplies((prev) => prev.map((m) => m.id === (payload.new as Message).id ? payload.new as Message : m));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => {
        setReplies((prev) => prev.filter((m) => m.id !== payload.old.id));
      })
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

  async function suggestReply() {
    setDraftLoading(true);
    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, userId: currentUserId }),
      });
      const { draft: suggested } = await res.json();
      if (suggested) setDraft(suggested);
    } finally {
      setDraftLoading(false);
    }
  }

  async function sendReply() {
    const toSend = draft.trim();
    if (!toSend || toSend === lastSentRef.current) return;
    setDraft("");
    lastSentRef.current = toSend;

    const realId = crypto.randomUUID();
    const optimistic: Message = { id: realId, body: toSend, sender_id: currentUserId, created_at: new Date().toISOString(), parent_id: parentMessage.id };
    setReplies((prev) => [...prev, optimistic]);

    const { data, error } = await supabase.from("messages").insert({
      id: realId, workspace_id: workspaceId, sender_id: currentUserId,
      channel_id: channelId, parent_id: parentMessage.id, body: toSend,
    }).select().single();

    if (error) {
      setReplies((prev) => prev.filter((m) => m.id !== realId));
    } else {
      setReplies((prev) => prev.map((m) => m.id === realId ? data as Message : m));
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
          <UserAvatar userId={parentMessage.sender_id} displayName={parentMessage.users?.full_name || undefined} avatarUrl={parentMessage.users?.avatar_url} size="sm" />
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
            <UserAvatar userId={r.sender_id} displayName={r.users?.full_name || undefined} avatarUrl={r.users?.avatar_url} size="sm" />
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
                <button onClick={() => handleEdit(r.id, r.body)} className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors">
                  <Pencil className="w-3 h-3" />
                </button>
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
          <button
            type="button"
            onClick={suggestReply}
            disabled={draftLoading}
            className="p-1.5 mb-0.5 rounded-lg text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10 disabled:opacity-30 transition-colors"
            title="Suggest a reply with AI"
          >
            {draftLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          </button>
          <button type="submit" disabled={!draft.trim()} className="p-1.5 mb-0.5 mr-0.5 rounded-lg bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-30 transition-colors">
            <Send className="w-3.5 h-3.5" />
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Pins Panel ───────────────────────────────────────────────────────────────

type PinEntry = {
  id: string;
  message: Message;
  pinned_by: string;
  created_at: string;
};

function PinsPanel({
  pins,
  onUnpin,
  currentUserId,
  onClose,
}: {
  pins: PinEntry[];
  onUnpin: (messageId: string) => void;
  currentUserId: string;
  onClose: () => void;
}) {
  return (
    <div className="w-80 flex flex-col border-l border-white/5 bg-zinc-900/60 shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
        <div className="flex items-center gap-2">
          <Pin className="w-3.5 h-3.5 text-zinc-500" />
          <span className="text-xs font-semibold text-zinc-300">Pinned Messages</span>
          {pins.length > 0 && (
            <span className="text-[10px] font-semibold text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded-full">{pins.length}</span>
          )}
        </div>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {pins.length === 0 ? (
          <p className="text-xs text-zinc-600 text-center py-8">No pinned messages yet.<br />Pin a message to keep it easy to find.</p>
        ) : (
          <div className="space-y-2">
            {pins.map((pin) => (
              <div key={pin.id} className="bg-white/[0.03] border border-white/5 rounded-xl p-3 group relative">
                <p className="text-xs font-semibold text-zinc-300 mb-1">
                  {pin.message.users?.full_name || `User ${pin.message.sender_id.slice(0, 4)}`}
                </p>
                <p className="text-xs text-zinc-400 line-clamp-3 break-words">{pin.message.body}</p>
                <p className="text-[10px] text-zinc-600 mt-1.5">
                  {new Date(pin.created_at).toLocaleDateString()}
                </p>
                <button
                  onClick={() => onUnpin(pin.message.id)}
                  className="absolute top-2 right-2 p-1 rounded hover:bg-white/10 text-zinc-600 hover:text-zinc-300 opacity-0 group-hover:opacity-100 transition-all"
                  title="Unpin"
                >
                  <PinOff className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Brief Modal ──────────────────────────────────────────────────────────────

function BriefModal({ brief, onClose }: { brief: string; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(brief);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh]">
        <div className="flex items-center justify-between p-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-indigo-400" />
            <span className="text-sm font-semibold text-white">Campaign Brief</span>
            <span className="text-[10px] text-zinc-500 bg-zinc-800 px-1.5 py-0.5 rounded-full">AI Generated</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={copy}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-lg text-xs text-zinc-300 font-medium transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
              {copied ? "Copied" : "Copy"}
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg text-zinc-400 hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6">
          <MarkdownMessage body={brief} />
        </div>
      </div>
    </div>
  );
}

// ─── Main ChannelView ─────────────────────────────────────────────────────────

export function ChannelView({
  channel: initialChannel,
  initialMessages,
}: {
  channel: Channel;
  initialMessages: Message[];
}) {
  const [channel, setChannel] = useState<Channel>(initialChannel);
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

  // Summary / Brief state
  const [summaryOpen, setSummaryOpen] = useState(false);
  const [summaryText, setSummaryText] = useState("");
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);
  const [briefText, setBriefText] = useState("");
  const [briefLoading, setBriefLoading] = useState(false);

  // Settings
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Pins
  const [pinsOpen, setPinsOpen] = useState(false);
  const [pins, setPins] = useState<PinEntry[]>([]);
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());

  // Saved
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

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

  // Load pins and saved IDs once currentUserId is known
  useEffect(() => {
    if (!currentUserId) return;

    supabase
      .from("pinned_messages")
      .select("id, message_id, pinned_by, created_at, messages(id, body, sender_id, created_at, parent_id, users:sender_id(full_name, avatar_url))")
      .eq("channel_id", channel.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        const pinEntries: PinEntry[] = (data as any[]).map((p) => {
          const msg = Array.isArray(p.messages) ? p.messages[0] : p.messages;
          if (msg) {
            msg.users = Array.isArray(msg.users) ? msg.users[0] : msg.users;
          }
          return { id: p.id, message: msg as Message, pinned_by: p.pinned_by, created_at: p.created_at };
        }).filter((p) => p.message);
        setPins(pinEntries);
        setPinnedIds(new Set(pinEntries.map((p) => p.message.id)));
      });

    supabase
      .from("saved_messages")
      .select("message_id")
      .eq("user_id", currentUserId)
      .then(({ data }) => {
        if (data) setSavedIds(new Set((data as any[]).map((s) => s.message_id)));
      });
  }, [currentUserId, channel.id, supabase]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [topLevelMessages.length]);

  useEffect(() => {
    const sub = supabase
      .channel(`channel:${channel.id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "messages", filter: `channel_id=eq.${channel.id}` }, (payload) => {
        const newMsg = payload.new as Message;
        supabase.from("users").select("full_name, avatar_url").eq("id", newMsg.sender_id).single().then(({ data }) => {
          if (data) newMsg.users = data;
          setAllMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev.map((m) => m.id === newMsg.id ? { ...m, ...newMsg } : m);
            if (prev.some((m) => m.body === newMsg.body && m.created_at === newMsg.created_at)) return prev;
            return [...prev, newMsg];
          });
        });
        if (newMsg.parent_id) {
          setReplyCounts((prev) => ({ ...prev, [newMsg.parent_id!]: (prev[newMsg.parent_id!] ?? 0) + 1 }));
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "messages", filter: `channel_id=eq.${channel.id}` }, (payload) => {
        setAllMessages((prev) => prev.map((m) => m.id === (payload.new as Message).id ? { ...m, ...payload.new as Message } : m));
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "messages" }, (payload) => {
        setAllMessages((prev) => prev.filter((m) => m.id !== payload.old.id));
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [channel.id, supabase]);

  useEffect(() => {
    const ch = supabase.channel(`typing:channel:${channel.id}`);
    typingChannelRef.current = ch;
    ch.on("broadcast", { event: "typing" }, ({ payload }: { payload: { userId: string; name: string } }) => {
      const { userId, name } = payload;
      if (userId === currentUserId) return;
      const existing = typingTimeoutsRef.current.get(userId);
      if (existing) clearTimeout(existing);
      setTypingUsers((prev) => new Map(prev).set(userId, name));
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
    setReplyCounts((prev) => { const u = { ...prev }; delete u[id]; return u; });
  }

  async function handlePin(messageId: string) {
    if (!currentUserId) return;
    if (pinnedIds.has(messageId)) {
      await supabase.from("pinned_messages").delete().eq("channel_id", channel.id).eq("message_id", messageId);
      setPinnedIds((prev) => { const n = new Set(prev); n.delete(messageId); return n; });
      setPins((prev) => prev.filter((p) => p.message.id !== messageId));
    } else {
      await supabase.from("pinned_messages").insert({ channel_id: channel.id, message_id: messageId, pinned_by: currentUserId, workspace_id: workspaceId });
      setPinnedIds((prev) => new Set(prev).add(messageId));
      const msg = allMessages.find((m) => m.id === messageId);
      if (msg) setPins((prev) => [{ id: messageId, message: msg, pinned_by: currentUserId, created_at: new Date().toISOString() }, ...prev]);
    }
  }

  async function handleSave(messageId: string) {
    if (!currentUserId) return;
    if (savedIds.has(messageId)) {
      await supabase.from("saved_messages").delete().eq("user_id", currentUserId).eq("message_id", messageId);
      setSavedIds((prev) => { const n = new Set(prev); n.delete(messageId); return n; });
    } else {
      await supabase.from("saved_messages").insert({ user_id: currentUserId, message_id: messageId });
      setSavedIds((prev) => new Set(prev).add(messageId));
    }
  }

  async function handleSummarize() {
    if (summaryLoading) return;
    if (summaryOpen && summaryText) { setSummaryOpen(false); return; }
    setSummaryOpen(true);
    setSummaryLoading(true);
    setSummaryText("");
    try {
      const res = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: channel.id }),
      });
      const { summary } = await res.json();
      setSummaryText(summary || "No summary available.");
    } catch {
      setSummaryText("Failed to generate summary.");
    } finally {
      setSummaryLoading(false);
    }
  }

  async function handleBrief() {
    if (briefLoading) return;
    setBriefLoading(true);
    try {
      const res = await fetch("/api/ai/brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: channel.id }),
      });
      const { brief } = await res.json();
      setBriefText(brief || "Could not generate brief.");
      setBriefOpen(true);
    } finally {
      setBriefLoading(false);
    }
  }

  async function handleSend(body: string, files: UploadedFile[]) {
    if (!currentUserId) return;

    const realId = crypto.randomUUID();
    const optimistic: Message = {
      id: realId, body: body.trim() || " ", sender_id: currentUserId,
      created_at: new Date().toISOString(), parent_id: null,
      users: cachedProfileRef.current ?? undefined,
    };
    setAllMessages((prev) => [...prev, optimistic]);

    const { data, error } = await supabase.from("messages")
      .insert({ id: realId, workspace_id: workspaceId, sender_id: currentUserId, channel_id: channel.id, body: body.trim() || " " })
      .select().single();

    if (error) { setAllMessages((prev) => prev.filter((m) => m.id !== realId)); return; }
    setAllMessages((prev) => prev.map((m) => m.id === realId ? data as Message : m));

    if (files.length > 0) {
      await supabase.from("message_files").insert(
        files.map((f) => ({
          message_id: realId, workspace_id: workspaceId, uploaded_by: currentUserId,
          file_name: f.file_name, file_size: f.file_size, mime_type: f.mime_type,
          storage_path: f.storage_path, public_url: f.public_url,
        }))
      );
    }

    // @mention notifications
    const mentionMatches = [...body.matchAll(/@(\w[\w.-]*)/g)].map((m) => m[1].toLowerCase());
    if (mentionMatches.length > 0) {
      const { data: members } = await supabase
        .from("workspace_members")
        .select("user_id, users(full_name)")
        .eq("workspace_id", workspaceId)
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
            workspace_id: workspaceId, user_id: uid, actor_id: currentUserId,
            message_id: realId, channel_id: channel.id, type: "mention",
            body_preview: body.slice(0, 120),
          }))
        );
      }
    }

    // Fire-and-forget urgency classification for longer messages
    if (body.trim().length > 30) {
      fetch("/api/ai/classify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messageId: realId, body: body.trim() }),
      }).catch(() => {});
    }
  }

  const rightPanelOpen = !!(threadParent || pinsOpen);
  const activePanel = threadParent ? "thread" : pinsOpen ? "pins" : null;

  return (
    <>
      <div className="flex h-full overflow-hidden">
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Channel header */}
          <header className="px-6 py-3 pt-8 flex items-center justify-between shrink-0 border-b border-white/5 select-none">
            <div className="flex items-center gap-3 min-w-0">
              <h2 className="font-semibold text-zinc-100 uppercase tracking-widest text-[11px] flex items-center gap-1.5 shrink-0">
                <Hash className="w-3.5 h-3.5 text-zinc-500" /> {channel.name}
              </h2>
              {channel.topic && <span className="text-zinc-500 text-[11px] font-medium truncate">— {channel.topic}</span>}
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {(channel.client_tag || channel.campaign_tag) && (
                <div className="flex items-center gap-1.5 mr-2">
                  {[channel.client_tag, channel.campaign_tag].filter(Boolean).map((tag) => (
                    <span key={tag} className="px-2 py-0.5 rounded outline outline-1 outline-white/10 bg-white/5 text-[10px] font-mono text-zinc-400">{tag}</span>
                  ))}
                </div>
              )}

              {/* AI: Summarize */}
              <button
                onClick={handleSummarize}
                disabled={summaryLoading}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${summaryOpen ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"}`}
                title="Summarize this channel"
              >
                {summaryLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                Summary
              </button>

              {/* AI: Brief */}
              <button
                onClick={handleBrief}
                disabled={briefLoading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors"
                title="Generate campaign brief from this channel"
              >
                {briefLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <FileText className="w-3 h-3" />}
                Brief
              </button>

              {/* Pins */}
              <button
                onClick={() => { setPinsOpen((o) => !o); setThreadParent(null); }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium transition-colors ${pinsOpen ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "text-zinc-500 hover:text-zinc-300 hover:bg-white/5"}`}
                title="Pinned messages"
              >
                <Pin className="w-3 h-3" />
                {pins.length > 0 && <span>{pins.length}</span>}
              </button>

              {/* Settings */}
              <button
                onClick={() => setSettingsOpen(true)}
                className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-white/5 transition-colors"
                title="Channel settings"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
            </div>
          </header>

          {/* AI Summary panel */}
          {summaryOpen && (
            <div className="border-b border-white/5 bg-indigo-950/20">
              <div className="px-6 py-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                    <span className="text-xs font-semibold text-indigo-300">Channel Summary</span>
                    <span className="text-[10px] text-indigo-500/70 bg-indigo-500/10 px-1.5 py-0.5 rounded-full">AI</span>
                  </div>
                  <button onClick={() => setSummaryOpen(false)} className="p-0.5 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                {summaryLoading ? (
                  <div className="flex items-center gap-2 text-xs text-indigo-400 py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Summarizing…</span>
                  </div>
                ) : (
                  <div className="text-xs text-zinc-300 max-h-48 overflow-y-auto">
                    <MarkdownMessage body={summaryText} />
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="relative flex-1 min-h-0 overflow-hidden">
            <div ref={scrollContainerRef} onScroll={handleScroll} className="h-full overflow-y-auto">
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
                            onThreadClick={(msg) => { setThreadParent(msg); setPinsOpen(false); }}
                            replyCount={replyCounts[m.id] ?? 0}
                            onEdit={handleEdit}
                            onDelete={handleDelete}
                            onPin={handlePin}
                            isPinned={pinnedIds.has(m.id)}
                            onSave={handleSave}
                            isSaved={savedIds.has(m.id)}
                          />
                        </div>
                      );
                    })}
                    <div ref={messagesEndRef} />
                  </>
                )}
              </div>
            </div>

            {showScrollBtn && (
              <button
                onClick={() => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })}
                className="absolute bottom-4 right-6 w-8 h-8 bg-zinc-800 border border-white/10 rounded-full flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-700 shadow-xl transition-all z-10"
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
                    <span key={i} className="w-1 h-1 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: `${i * 150}ms` }} />
                  ))}
                </span>
                <span>{Array.from(typingUsers.values()).join(", ")} {typingUsers.size === 1 ? "is" : "are"} typing…</span>
              </div>
            )}
          </div>

          {currentUserId && (
            <MessageComposer
              placeholder={`Message #${channel.name}`}
              workspaceId={workspaceId}
              currentUserId={currentUserId}
              channelId={channel.id}
              onSend={handleSend}
              onTyping={handleTyping}
            />
          )}
        </div>

        {/* Right panels */}
        {activePanel === "thread" && threadParent && currentUserId && (
          <ThreadPanel
            parentMessage={threadParent}
            channelId={channel.id}
            workspaceId={workspaceId}
            currentUserId={currentUserId}
            onClose={() => setThreadParent(null)}
            onReplyAdded={handleReplyAdded}
          />
        )}
        {activePanel === "pins" && currentUserId && (
          <PinsPanel
            pins={pins}
            onUnpin={handlePin}
            currentUserId={currentUserId}
            onClose={() => setPinsOpen(false)}
          />
        )}
      </div>

      {briefOpen && briefText && <BriefModal brief={briefText} onClose={() => setBriefOpen(false)} />}

      <ChannelSettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        channel={channel}
        onSaved={(updated) => setChannel((prev) => ({ ...prev, ...updated }))}
      />
    </>
  );
}
