"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { Paperclip, Send, Sparkles, X, Loader2 } from "lucide-react";

type PendingFile = {
  file: File;
  previewUrl: string | null;
};

export type UploadedFile = {
  file_name: string;
  file_size: number;
  mime_type: string;
  storage_path: string;
  public_url: string;
};

type WorkspaceMember = {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
};

export function MessageComposer({
  placeholder,
  workspaceId,
  currentUserId,
  channelId,
  onSend,
  onTyping,
}: {
  placeholder: string;
  workspaceId: string;
  currentUserId: string;
  channelId?: string;
  onSend: (body: string, files: UploadedFile[]) => Promise<void>;
  onTyping?: () => void;
}) {
  const draftKey = channelId ? `draft:${channelId}` : null;
  const [draft, setDraft] = useState(() => {
    if (typeof window === "undefined" || !channelId) return "";
    return localStorage.getItem(`draft:${channelId}`) ?? "";
  });
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([]);
  const [sending, setSending] = useState(false);
  const [draftLoading, setDraftLoading] = useState(false);

  // @mention autocomplete state
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionStart, setMentionStart] = useState<number>(0);
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [mentionIndex, setMentionIndex] = useState(0);

  // /slash command state
  const [slashQuery, setSlashQuery] = useState<string | null>(null);
  const [slashIndex, setSlashIndex] = useState(0);

  const SLASH_COMMANDS = [
    { cmd: "/shrug",   desc: "Append ¯\\_(ツ)_/¯",        action: () => appendText(" ¯\\_(ツ)_/¯") },
    { cmd: "/flip",    desc: "Append (╯°□°）╯︵ ┻━┻",     action: () => appendText(" (╯°□°）╯︵ ┻━┻") },
    { cmd: "/unflip",  desc: "Append ┬─┬ノ( º _ ºノ)",    action: () => appendText(" ┬─┬ノ( º _ ºノ)") },
    { cmd: "/lenny",   desc: "Append ( ͡° ͜ʖ ͡°)",        action: () => appendText(" ( ͡° ͜ʖ ͡°)") },
    { cmd: "/tableflip", desc: "Send (╯°□°）╯︵ ┻━┻",     action: () => sendSlash("(╯°□°）╯︵ ┻━┻") },
    { cmd: "/shout",   desc: "UPPERCASE your message",      action: () => setDraft((d) => d.replace(/^\/shout\s*/i, "").toUpperCase()) },
  ] as const;

  function appendText(text: string) {
    setDraft((d) => d.replace(/^\/\w*\s*/, "") + text);
    setSlashQuery(null);
  }

  function sendSlash(text: string) {
    setDraft(text);
    setSlashQuery(null);
    setTimeout(() => handleSubmit(), 0);
  }

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lastSentRef = useRef<string | null>(null);
  const supabase = createClient();

  // Load workspace members for @mention
  useEffect(() => {
    supabase
      .from("workspace_members")
      .select("user_id, users(full_name, avatar_url)")
      .eq("workspace_id", workspaceId)
      .neq("user_id", currentUserId)
      .then(({ data }) => {
        const mapped = (data ?? []).map((r: any) => ({
          user_id: r.user_id,
          full_name: r.users?.full_name ?? `User ${r.user_id.slice(0, 4)}`,
          avatar_url: r.users?.avatar_url ?? null,
        }));
        setMembers(mapped);
      });
  }, [workspaceId, currentUserId, supabase]);

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = "auto";
    ta.style.height = Math.min(ta.scrollHeight, 160) + "px";
  }, [draft]);

  // Detect @mention as user types
  function handleChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const val = e.target.value;
    setDraft(val);
    if (draftKey) {
      if (val) localStorage.setItem(draftKey, val);
      else localStorage.removeItem(draftKey);
    }
    lastSentRef.current = null;
    onTyping?.();

    // Detect /slash commands (only when message starts with /)
    if (val.startsWith("/")) {
      const query = val.slice(1).toLowerCase();
      setSlashQuery(query);
      setSlashIndex(0);
      setMentionQuery(null);
      return;
    }
    setSlashQuery(null);

    // Find the last '@' before cursor
    const cursor = e.target.selectionStart ?? val.length;
    const textBefore = val.slice(0, cursor);
    const atIdx = textBefore.lastIndexOf("@");

    if (atIdx !== -1) {
      const fragment = textBefore.slice(atIdx + 1);
      // Only show if no space in fragment (active mention)
      if (!fragment.includes(" ")) {
        setMentionQuery(fragment.toLowerCase());
        setMentionStart(atIdx);
        setMentionIndex(0);
        return;
      }
    }
    setMentionQuery(null);
  }

  const filteredMembers = mentionQuery !== null
    ? members.filter((m) => m.full_name.toLowerCase().includes(mentionQuery))
    : [];

  const filteredSlash = slashQuery !== null
    ? SLASH_COMMANDS.filter((c) => c.cmd.slice(1).startsWith(slashQuery))
    : [];

  function insertMention(member: WorkspaceMember) {
    const before = draft.slice(0, mentionStart);
    const after = draft.slice(textareaRef.current?.selectionStart ?? draft.length);
    const newDraft = `${before}@${member.full_name}${after.startsWith(" ") ? "" : " "}${after}`;
    setDraft(newDraft);
    setMentionQuery(null);
    setTimeout(() => {
      const pos = before.length + member.full_name.length + 2;
      textareaRef.current?.setSelectionRange(pos, pos);
      textareaRef.current?.focus();
    }, 0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    // Navigate/select /slash commands
    if (slashQuery !== null && filteredSlash.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setSlashIndex((i) => (i + 1) % filteredSlash.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setSlashIndex((i) => (i - 1 + filteredSlash.length) % filteredSlash.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); filteredSlash[slashIndex].action(); return; }
      if (e.key === "Escape") { setSlashQuery(null); return; }
    }
    // Navigate/select @mention
    if (mentionQuery !== null && filteredMembers.length > 0) {
      if (e.key === "ArrowDown") { e.preventDefault(); setMentionIndex((i) => (i + 1) % filteredMembers.length); return; }
      if (e.key === "ArrowUp") { e.preventDefault(); setMentionIndex((i) => (i - 1 + filteredMembers.length) % filteredMembers.length); return; }
      if (e.key === "Enter" || e.key === "Tab") { e.preventDefault(); insertMention(filteredMembers[mentionIndex]); return; }
      if (e.key === "Escape") { setMentionQuery(null); return; }
    }
    // Send on Enter (not Shift+Enter)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    addFiles(Array.from(e.target.files ?? []));
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function addFiles(files: File[]) {
    const newPending: PendingFile[] = files.map((f) => ({
      file: f,
      previewUrl: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
    }));
    setPendingFiles((prev) => [...prev, ...newPending].slice(0, 5));
  }

  function removeFile(idx: number) {
    setPendingFiles((prev) => {
      const copy = [...prev];
      if (copy[idx].previewUrl) URL.revokeObjectURL(copy[idx].previewUrl!);
      copy.splice(idx, 1);
      return copy;
    });
  }

  // Drag & drop
  function handleDragOver(e: React.DragEvent) { e.preventDefault(); }
  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files);
    if (files.length) addFiles(files);
  }

  // Paste images from clipboard
  function handlePaste(e: React.ClipboardEvent) {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter((item) => item.kind === "file" && item.type.startsWith("image/"));
    if (imageItems.length === 0) return;
    e.preventDefault();
    const files = imageItems.map((item) => item.getAsFile()).filter(Boolean) as File[];
    addFiles(files);
  }

  async function uploadFile(pf: PendingFile): Promise<UploadedFile | null> {
    const ext = pf.file.name.split(".").pop();
    const path = `${workspaceId}/${currentUserId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from("files").upload(path, pf.file);
    if (error) { console.error("Upload error", error); return null; }
    const { data: urlData } = supabase.storage.from("files").getPublicUrl(path);
    return {
      file_name: pf.file.name,
      file_size: pf.file.size,
      mime_type: pf.file.type || "application/octet-stream",
      storage_path: path,
      public_url: urlData.publicUrl,
    };
  }

  async function suggestDraft() {
    if (!channelId || draftLoading) return;
    setDraftLoading(true);
    try {
      const res = await fetch("/api/ai/draft", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId, userId: currentUserId }),
      });
      const { draft: suggested } = await res.json();
      if (suggested) {
        setDraft(suggested);
        setTimeout(() => textareaRef.current?.focus(), 0);
      }
    } finally {
      setDraftLoading(false);
    }
  }

  async function handleSubmit() {
    const body = draft.trim();
    if (!body && pendingFiles.length === 0) return;
    if (body === lastSentRef.current && pendingFiles.length === 0) return;

    setSending(true);
    lastSentRef.current = body;
    setDraft("");
    if (draftKey) localStorage.removeItem(draftKey);
    setMentionQuery(null);
    const filesToUpload = [...pendingFiles];
    setPendingFiles([]);

    const uploadedFiles: UploadedFile[] = [];
    for (const pf of filesToUpload) {
      const uploaded = await uploadFile(pf);
      if (uploaded) uploadedFiles.push(uploaded);
    }

    await onSend(body || " ", uploadedFiles);
    setSending(false);
  }

  return (
    <div
      className="p-4 pt-2 shrink-0"
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* File previews */}
      {pendingFiles.length > 0 && (
        <div className="flex gap-2 flex-wrap mb-2">
          {pendingFiles.map((pf, i) => (
            <div key={i} className="relative group">
              {pf.previewUrl ? (
                <img src={pf.previewUrl} alt={pf.file.name} className="w-16 h-16 object-cover rounded-lg border border-[var(--t-border)]" />
              ) : (
                <div className="w-16 h-16 rounded-lg border border-[var(--t-border)] bg-white/5 flex items-center justify-center">
                  <span className="text-[10px] text-zinc-500 text-center px-1 break-all">{pf.file.name.slice(0, 12)}</span>
                </div>
              )}
              <button
                type="button"
                onClick={() => removeFile(i)}
                className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-[var(--t-raised)]/80 border border-[var(--t-border)] rounded-full flex items-center justify-center text-zinc-300 hover:text-white opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="w-2.5 h-2.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* /slash commands dropdown */}
      {slashQuery !== null && filteredSlash.length > 0 && (
        <div className="mb-1 bg-[var(--t-raised)] border border-[var(--t-border)] rounded-xl shadow-xl overflow-hidden">
          {filteredSlash.map((c, i) => (
            <button
              key={c.cmd}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); c.action(); }}
              className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                i === slashIndex ? "bg-[var(--t-accent)]/20 text-zinc-100" : "text-zinc-300 hover:bg-white/5"
              }`}
            >
              <span className="text-sm font-mono font-semibold text-[var(--t-accent)] w-24 shrink-0">{c.cmd}</span>
              <span className="text-xs text-zinc-500">{c.desc}</span>
            </button>
          ))}
        </div>
      )}

      {/* @mention dropdown */}
      {mentionQuery !== null && filteredMembers.length > 0 && (
        <div className="mb-1 bg-[var(--t-raised)] border border-[var(--t-border)] rounded-xl shadow-xl overflow-hidden">
          {filteredMembers.slice(0, 6).map((m, i) => {
            const initials = m.full_name.slice(0, 2).toUpperCase();
            return (
              <button
                key={m.user_id}
                type="button"
                onMouseDown={(e) => { e.preventDefault(); insertMention(m); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors ${
                  i === mentionIndex ? "bg-[var(--t-accent)]/20 text-zinc-100" : "text-zinc-300 hover:bg-white/5"
                }`}
              >
                <div className="w-6 h-6 rounded-full bg-[var(--t-accent)]/15 border border-[var(--t-border)] flex items-center justify-center text-[9px] font-semibold text-[var(--t-accent)] shrink-0 overflow-hidden">
                  {m.avatar_url ? <img src={m.avatar_url} alt={m.full_name} className="w-full h-full object-cover" /> : initials}
                </div>
                <span className="text-sm font-medium">{m.full_name}</span>
              </button>
            );
          })}
        </div>
      )}

      <div className="flex items-end gap-2 bg-[var(--t-surface)]/80 backdrop-blur-md border border-[var(--t-border)] rounded-xl p-1 shadow-inner focus-within:border-[var(--t-accent)]/40 focus-within:bg-[var(--t-surface)]/90 transition-colors">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="p-2 mb-0.5 ml-0.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-colors shrink-0"
          title="Attach file"
        >
          <Paperclip className="w-[16px] h-[16px]" />
        </button>
        {channelId && (
          <button
            type="button"
            onClick={suggestDraft}
            disabled={draftLoading}
            className="p-2 mb-0.5 rounded-lg text-zinc-500 hover:text-[var(--t-accent)] hover:bg-[var(--t-accent)]/10 disabled:opacity-30 transition-colors shrink-0"
            title="Suggest a reply with AI"
          >
            {draftLoading ? <Loader2 className="w-[16px] h-[16px] animate-spin" /> : <Sparkles className="w-[16px] h-[16px]" />}
          </button>
        )}
        <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleFileSelect}
          accept="image/*,.pdf,.txt,.md,.csv,.doc,.docx,.xls,.xlsx,.zip" />
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={placeholder}
          rows={1}
          className="flex-1 bg-transparent px-2 py-2.5 text-[14px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none resize-none overflow-hidden leading-relaxed"
          style={{ minHeight: "36px", maxHeight: "160px" }}
        />
        <button
          type="button"
          onClick={handleSubmit}
          disabled={sending || (!draft.trim() && pendingFiles.length === 0)}
          className="p-2 mb-0.5 mr-0.5 rounded-lg bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:text-zinc-400 transition-colors shrink-0"
        >
          {sending ? <Loader2 className="w-[18px] h-[18px] animate-spin" /> : <Send className="w-[18px] h-[18px]" />}
        </button>
      </div>
      <p className="text-[10px] text-zinc-700 mt-1 pl-1">Enter to send · Shift+Enter for new line</p>
    </div>
  );
}
