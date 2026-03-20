"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  Plus, Search, FileText, Trash2, GripVertical, Type, Heading1, Heading2,
  Heading3, List, ListOrdered, CheckSquare, Code, Quote, Minus, Image,
  Lightbulb, X, Undo2, Redo2, ChevronDown, Sparkles, History, Clock,
  RotateCcw, Loader2,
} from "lucide-react";
import {
  DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor,
  useSensors, DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, sortableKeyboardCoordinates,
  useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { toast } from "sonner";
import { complete } from "@/lib/openrouter";

// ── Types ────────────────────────────────────────────────────────────────────

type BlockType =
  | "text" | "h1" | "h2" | "h3"
  | "bullet" | "ordered" | "checklist"
  | "quote" | "code" | "callout" | "divider" | "image";

type Block = {
  id: string;
  type: BlockType;
  content: string;        // plain text / markdown
  checked?: boolean;      // for checklist
  caption?: string;       // for image
};

type Canvas = {
  id: string;
  title: string;
  emoji: string;
  blocks: Block[];
  created_by: string;
  created_at: string;
  updated_at: string;
};

type HistoryEntry = {
  id: string;
  title: string;
  blocks: Block[];
  created_at: string;
};

// ── Constants ────────────────────────────────────────────────────────────────

const EMOJIS = ["📄","📝","📋","📑","📌","🗒️","📓","📔","📒","📃","🗂️","💡","🎯","🚀","🔖","⭐","🏆","💼","🧠","🎨","📊","🔍","✅","🌟","🎉"];

const BLOCK_MENU: { type: BlockType; label: string; description: string; icon: React.ReactNode }[] = [
  { type: "text",      label: "Text",         description: "Plain paragraph",         icon: <Type className="w-3.5 h-3.5" /> },
  { type: "h1",        label: "Heading 1",    description: "Large section title",     icon: <Heading1 className="w-3.5 h-3.5" /> },
  { type: "h2",        label: "Heading 2",    description: "Medium section title",    icon: <Heading2 className="w-3.5 h-3.5" /> },
  { type: "h3",        label: "Heading 3",    description: "Small section title",     icon: <Heading3 className="w-3.5 h-3.5" /> },
  { type: "bullet",    label: "Bullet list",  description: "Unordered list",          icon: <List className="w-3.5 h-3.5" /> },
  { type: "ordered",   label: "Numbered",     description: "Ordered list",            icon: <ListOrdered className="w-3.5 h-3.5" /> },
  { type: "checklist", label: "Checklist",    description: "To-do list with checkboxes", icon: <CheckSquare className="w-3.5 h-3.5" /> },
  { type: "quote",     label: "Quote",        description: "Block quotation",         icon: <Quote className="w-3.5 h-3.5" /> },
  { type: "callout",   label: "Callout",      description: "Highlighted note",        icon: <Lightbulb className="w-3.5 h-3.5" /> },
  { type: "code",      label: "Code",         description: "Code block",              icon: <Code className="w-3.5 h-3.5" /> },
  { type: "divider",   label: "Divider",      description: "Horizontal rule",         icon: <Minus className="w-3.5 h-3.5" /> },
  { type: "image",     label: "Image",        description: "Image by URL",            icon: <Image className="w-3.5 h-3.5" /> },
];

function newBlock(type: BlockType = "text"): Block {
  return { id: crypto.randomUUID(), type, content: "", checked: false };
}

// ── Sortable block wrapper ───────────────────────────────────────────────────

function SortableBlock({ id, children }: { id: string; children: React.ReactNode }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id });
  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
      className="group relative flex items-start gap-1"
    >
      <button
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        className="mt-1 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing shrink-0"
        style={{ color: "var(--t-fg-3)" }}
        tabIndex={-1}
      >
        <GripVertical className="w-3.5 h-3.5" />
      </button>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

// ── Block renderer / editor ──────────────────────────────────────────────────

function BlockEditor({
  block,
  index,
  onChange,
  onDelete,
  onAddAfter,
  onSlashKey,
  onFocus,
  inputRef,
}: {
  block: Block;
  index: number;
  onChange: (b: Partial<Block>) => void;
  onDelete: () => void;
  onAddAfter: () => void;
  onSlashKey: (rect: DOMRect) => void;
  onFocus: () => void;
  inputRef: (el: HTMLElement | null) => void;
}) {
  const divRef = useRef<HTMLDivElement | null>(null);
  // Track whether the current content change came from the user typing
  // (in which case we must NOT reset innerHTML, which would move the cursor).
  const isTyping = useRef(false);

  // Initialise innerHTML on mount, and resync whenever content changes from
  // outside (undo/redo, block-type switch) but NOT during typing.
  useEffect(() => {
    const el = divRef.current;
    if (!el || isTyping.current) return;
    // Only touch the DOM if it's actually different to avoid cursor jumps.
    if (el.innerHTML !== block.content) {
      el.innerHTML = block.content;
    }
  // block.id change = new block; block.type change = type switched via slash menu
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [block.id, block.type, block.content]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Enter" && block.type !== "code" && !e.shiftKey) {
      e.preventDefault();
      onAddAfter();
    }
    if (e.key === "Backspace" && !block.content) {
      e.preventDefault();
      onDelete();
    }
  }

  function handleInput(e: React.FormEvent<HTMLDivElement>) {
    isTyping.current = true;
    const text = (e.target as HTMLDivElement).innerText;
    if (text === "/") {
      const rect = (e.target as HTMLDivElement).getBoundingClientRect();
      onSlashKey(rect);
    }
    onChange({ content: text });
    // Allow the effect to resync on the next external change
    requestAnimationFrame(() => { isTyping.current = false; });
  }

  // Shared style for content-editable blocks
  const baseClass = "w-full focus:outline-none bg-transparent resize-none";
  const placeholder = "placeholder:text-[var(--t-fg-3)]";

  if (block.type === "divider") {
    return <div className="py-3"><hr style={{ borderColor: "var(--t-border)" }} /></div>;
  }

  if (block.type === "checklist") {
    return (
      <div className="flex items-start gap-2 py-0.5">
        <button
          onClick={() => onChange({ checked: !block.checked })}
          className="mt-0.5 w-4 h-4 rounded shrink-0 border-2 flex items-center justify-center transition-colors"
          style={{
            borderColor: block.checked ? "var(--t-accent)" : "var(--t-border)",
            background: block.checked ? "var(--t-accent)" : "transparent",
          }}
        >
          {block.checked && <span className="text-[9px] font-bold text-black">✓</span>}
        </button>
        <input
          ref={(el) => { inputRef(el); }}
          type="text"
          value={block.content}
          onChange={(e) => onChange({ content: e.target.value })}
          onKeyDown={handleKeyDown}
          onFocus={onFocus}
          placeholder="To-do item"
          className={`${baseClass} text-sm py-0 ${placeholder} ${block.checked ? "line-through opacity-50" : ""}`}
          style={{ color: "var(--t-fg)" }}
        />
      </div>
    );
  }

  if (block.type === "image") {
    return (
      <div className="py-1 space-y-1.5">
        <input
          ref={(el) => { inputRef(el); }}
          type="url"
          value={block.content}
          onChange={(e) => onChange({ content: e.target.value })}
          onKeyDown={handleKeyDown}
          onFocus={onFocus}
          placeholder="Paste image URL…"
          className={`${baseClass} text-sm ${placeholder} px-2 py-1.5 rounded-lg border`}
          style={{ color: "var(--t-fg)", borderColor: "var(--t-border)", background: "var(--t-raised)" }}
        />
        {block.content && (
          <div className="rounded-xl overflow-hidden">
            <img src={block.content} alt={block.caption || ""} className="max-w-full max-h-80 object-cover" />
          </div>
        )}
        {block.content && (
          <input
            type="text"
            value={block.caption || ""}
            onChange={(e) => onChange({ caption: e.target.value })}
            placeholder="Caption (optional)"
            className={`${baseClass} text-xs ${placeholder} text-center`}
            style={{ color: "var(--t-fg-3)" }}
          />
        )}
      </div>
    );
  }

  if (block.type === "code") {
    return (
      <div className="rounded-xl overflow-hidden my-1" style={{ background: "var(--t-raised)", border: "1px solid var(--t-border)" }}>
        <div className="px-3 py-1 flex items-center gap-2 border-b" style={{ borderColor: "var(--t-border)" }}>
          <Code className="w-3 h-3" style={{ color: "var(--t-accent)" }} />
          <span className="text-[10px] font-mono font-semibold" style={{ color: "var(--t-accent)" }}>code</span>
        </div>
        <textarea
          ref={(el) => { inputRef(el); }}
          value={block.content}
          onChange={(e) => onChange({ content: e.target.value })}
          onFocus={onFocus}
          placeholder="// type code here"
          rows={4}
          className={`${baseClass} font-mono text-sm px-4 py-3 ${placeholder}`}
          style={{ color: "var(--t-fg)", fontFamily: "var(--font-mono)" }}
        />
      </div>
    );
  }

  // Shared contenteditable for text/headings/lists/quote/callout
  const typeStyles: Record<BlockType, string> = {
    text:     "text-sm leading-relaxed",
    h1:       "text-3xl font-bold leading-tight",
    h2:       "text-2xl font-bold leading-tight",
    h3:       "text-lg font-semibold leading-snug",
    bullet:   "text-sm leading-relaxed pl-4",
    ordered:  "text-sm leading-relaxed pl-4",
    quote:    "text-sm italic leading-relaxed pl-4 border-l-2",
    callout:  "text-sm leading-relaxed px-4 py-3 rounded-xl",
    code:     "text-sm font-mono",
    checklist: "text-sm",
    divider:  "",
    image:    "",
  };

  const wrapperStyles: Partial<Record<BlockType, React.CSSProperties>> = {
    quote:   { borderColor: "var(--t-accent)", color: "var(--t-fg-2)" },
    callout: { background: "color-mix(in srgb, var(--t-accent) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--t-accent) 20%, transparent)" },
    bullet:  { listStyleType: "disc" },
    ordered: {},
  };

  const placeholderMap: Partial<Record<BlockType, string>> = {
    text: "Type something, or '/' for commands…",
    h1: "Heading 1",
    h2: "Heading 2",
    h3: "Heading 3",
    bullet: "List item",
    ordered: "List item",
    quote: "Quote",
    callout: "Note or callout",
  };

  return (
    <div
      ref={(el) => {
        divRef.current = el;
        inputRef(el);
      }}
      contentEditable
      suppressContentEditableWarning
      onInput={handleInput}
      onKeyDown={handleKeyDown}
      onFocus={onFocus}
      data-placeholder={placeholderMap[block.type] ?? "Type…"}
      className={`${baseClass} ${typeStyles[block.type] || "text-sm"} py-0.5 empty:before:content-[attr(data-placeholder)] empty:before:text-[var(--t-fg-3)] empty:before:pointer-events-none`}
      style={{ color: "var(--t-fg)", ...wrapperStyles[block.type] }}
    />
  );
}

// ── Main WorkspacesView ──────────────────────────────────────────────────────

export function WorkspacesView() {
  const supabase = createClient();
  const [workspaceId, setWorkspaceId] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Canvas list
  const [canvases, setCanvases] = useState<Canvas[]>([]);
  const [listLoading, setListLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Active canvas
  const [active, setActive] = useState<Canvas | null>(null);
  const [saving, setSaving] = useState(false);
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Undo / redo stacks
  const undoStack = useRef<{ title: string; blocks: Block[] }[]>([]);
  const redoStack = useRef<{ title: string; blocks: Block[] }[]>([]);

  // Slash menu
  const [slashMenu, setSlashMenu] = useState<{ x: number; y: number; blockId: string } | null>(null);
  const [slashFilter, setSlashFilter] = useState("");
  const focusedBlockId = useRef<string | null>(null);
  const blockRefs = useRef<Map<string, HTMLElement>>(new Map());

  // Emoji picker
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);

  // History
  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // AI assist
  const [aiMenuOpen, setAiMenuOpen] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  // ── Load workspace + canvases ──────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setCurrentUserId(user.id);

      const { data: membership } = await supabase
        .from("workspace_members").select("workspace_id").eq("user_id", user.id).limit(1).single();
      if (!membership) return;
      setWorkspaceId(membership.workspace_id);

      const { data } = await supabase
        .from("canvases")
        .select("*")
        .eq("workspace_id", membership.workspace_id)
        .order("updated_at", { ascending: false });

      const list: Canvas[] = (data ?? []).map((c: any) => ({
        ...c,
        blocks: Array.isArray(c.blocks) ? c.blocks : [],
      }));
      setCanvases(list);
      setListLoading(false);
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-save ──────────────────────────────────────────────────────────────

  const scheduleSave = useCallback((canvas: Canvas) => {
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current);
    setSaving(true);
    saveTimeoutRef.current = setTimeout(async () => {
      await supabase.from("canvases").update({
        title: canvas.title,
        emoji: canvas.emoji,
        blocks: canvas.blocks,
      }).eq("id", canvas.id);

      // Save history snapshot
      await supabase.from("canvas_history").insert({
        canvas_id: canvas.id,
        title: canvas.title,
        blocks: canvas.blocks,
        created_by: currentUserId,
      });

      setCanvases((prev) => prev.map((c) => c.id === canvas.id ? { ...c, title: canvas.title, emoji: canvas.emoji, blocks: canvas.blocks, updated_at: new Date().toISOString() } : c));
      setSaving(false);
    }, 1200);
  }, [supabase, currentUserId]);

  // ── Canvas mutations ───────────────────────────────────────────────────────

  async function createCanvas() {
    if (!workspaceId || !currentUserId) return;
    const { data, error } = await supabase.from("canvases").insert({
      workspace_id: workspaceId,
      created_by: currentUserId,
      title: "Untitled",
      emoji: "📄",
      blocks: [newBlock("text")],
    }).select().single();

    if (error || !data) { toast.error("Failed to create workspace"); return; }
    const c: Canvas = { ...data, blocks: data.blocks ?? [] };
    setCanvases((prev) => [c, ...prev]);
    setActive(c);
    undoStack.current = [];
    redoStack.current = [];
  }

  async function deleteCanvas(id: string) {
    await supabase.from("canvases").delete().eq("id", id);
    setCanvases((prev) => prev.filter((c) => c.id !== id));
    if (active?.id === id) setActive(null);
    toast.success("Workspace deleted");
  }

  // ── Block mutations ────────────────────────────────────────────────────────

  function pushUndo() {
    if (!active) return;
    undoStack.current = [...undoStack.current.slice(-49), { title: active.title, blocks: JSON.parse(JSON.stringify(active.blocks)) }];
    redoStack.current = [];
  }

  function undo() {
    if (!active || undoStack.current.length === 0) return;
    const prev = undoStack.current.pop()!;
    redoStack.current = [...redoStack.current, { title: active.title, blocks: JSON.parse(JSON.stringify(active.blocks)) }];
    const updated = { ...active, ...prev };
    setActive(updated);
    scheduleSave(updated);
  }

  function redo() {
    if (!active || redoStack.current.length === 0) return;
    const next = redoStack.current.pop()!;
    undoStack.current = [...undoStack.current, { title: active.title, blocks: JSON.parse(JSON.stringify(active.blocks)) }];
    const updated = { ...active, ...next };
    setActive(updated);
    scheduleSave(updated);
  }

  function updateBlocks(blocks: Block[]) {
    if (!active) return;
    pushUndo();
    const updated = { ...active, blocks };
    setActive(updated);
    scheduleSave(updated);
  }

  function updateBlock(id: string, patch: Partial<Block>) {
    if (!active) return;
    const blocks = active.blocks.map((b) => b.id === id ? { ...b, ...patch } : b);
    const updated = { ...active, blocks };
    setActive(updated);
    scheduleSave(updated);
  }

  function addBlockAfter(afterId: string, type: BlockType = "text") {
    if (!active) return;
    pushUndo();
    const idx = active.blocks.findIndex((b) => b.id === afterId);
    const block = newBlock(type);
    const blocks = [...active.blocks.slice(0, idx + 1), block, ...active.blocks.slice(idx + 1)];
    const updated = { ...active, blocks };
    setActive(updated);
    scheduleSave(updated);
    // Focus new block
    setTimeout(() => blockRefs.current.get(block.id)?.focus(), 30);
  }

  function deleteBlock(id: string) {
    if (!active || active.blocks.length <= 1) return;
    pushUndo();
    const idx = active.blocks.findIndex((b) => b.id === id);
    const blocks = active.blocks.filter((b) => b.id !== id);
    const updated = { ...active, blocks };
    setActive(updated);
    scheduleSave(updated);
    // Focus previous block
    const prevId = active.blocks[Math.max(0, idx - 1)]?.id;
    if (prevId) setTimeout(() => blockRefs.current.get(prevId)?.focus(), 30);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active: dragActive, over } = event;
    if (!active || !over || dragActive.id === over.id) return;
    const oldIndex = active.blocks.findIndex((b) => b.id === dragActive.id);
    const newIndex = active.blocks.findIndex((b) => b.id === over.id);
    updateBlocks(arrayMove(active.blocks, oldIndex, newIndex));
  }

  // ── Slash menu ─────────────────────────────────────────────────────────────

  function openSlashMenu(rect: DOMRect, blockId: string) {
    setSlashFilter("");
    setSlashMenu({ x: rect.left, y: rect.bottom + 4, blockId });
  }

  function insertBlockType(type: BlockType) {
    if (!slashMenu) return;
    const blockId = (slashMenu as any).blockId as string;
    // Clear the slash from the current block
    updateBlock(blockId, { content: "", type });
    setSlashMenu(null);
    setTimeout(() => blockRefs.current.get(blockId)?.focus(), 30);
  }

  const filteredMenu = BLOCK_MENU.filter((b) =>
    !slashFilter || b.label.toLowerCase().includes(slashFilter.toLowerCase())
  );

  // ── History ────────────────────────────────────────────────────────────────

  async function loadHistory() {
    if (!active) return;
    setHistoryLoading(true);
    const { data } = await supabase
      .from("canvas_history")
      .select("id, title, blocks, created_at")
      .eq("canvas_id", active.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setHistory((data ?? []).map((h: any) => ({ ...h, blocks: h.blocks ?? [] })));
    setHistoryLoading(false);
  }

  function restoreVersion(entry: HistoryEntry) {
    if (!active) return;
    pushUndo();
    const updated = { ...active, title: entry.title, blocks: entry.blocks };
    setActive(updated);
    scheduleSave(updated);
    setHistoryOpen(false);
    toast.success("Version restored");
  }

  // ── AI assist ─────────────────────────────────────────────────────────────

  async function aiAction(action: "summarize" | "expand" | "professional" | "casual") {
    if (!active) return;
    setAiLoading(true);
    setAiMenuOpen(false);
    try {
      const text = active.blocks
        .filter((b) => b.type === "text" || b.type === "h1" || b.type === "h2" || b.type === "h3")
        .map((b) => b.content).join("\n");

      const prompts: Record<typeof action, string> = {
        summarize:    `Summarise the following document into key bullet points:\n\n${text}`,
        expand:       `Expand and enrich the following text with more detail and examples:\n\n${text}`,
        professional: `Rewrite the following in a polished, professional tone:\n\n${text}`,
        casual:       `Rewrite the following in a friendly, casual tone:\n\n${text}`,
      };

      const result = await fetch("/api/ai/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ channelId: "__canvas__", _prompt: prompts[action], _direct: true }),
      });

      // Fallback: call openrouter directly via a mini endpoint
      const res = await fetch("/api/ai/canvas-assist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, text }),
      });
      const { result: aiText } = await res.json();

      if (aiText) {
        pushUndo();
        const aiBlock = newBlock("callout");
        aiBlock.content = `✨ AI (${action}):\n${aiText}`;
        const updated = { ...active, blocks: [...active.blocks, aiBlock] };
        setActive(updated);
        scheduleSave(updated);
        toast.success("AI result added as a callout block");
      }
    } catch {
      toast.error("AI assist failed");
    } finally {
      setAiLoading(false);
    }
  }

  // ── Filtered list ──────────────────────────────────────────────────────────

  const filteredCanvases = search.trim()
    ? canvases.filter((c) =>
        c.title.toLowerCase().includes(search.toLowerCase()) ||
        c.blocks.some((b) => b.content.toLowerCase().includes(search.toLowerCase()))
      )
    : canvases;

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full overflow-hidden" style={{ color: "var(--t-fg)" }}>

      {/* ── Left panel: canvas list ── */}
      <div
        className="w-64 flex flex-col shrink-0 border-r overflow-hidden"
        style={{ background: "var(--t-sidebar)", borderColor: "var(--t-border)" }}
      >
        {/* Header */}
        <div className="px-4 pt-8 pb-3 shrink-0">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold" style={{ color: "var(--t-fg)" }}>Workspaces</h2>
            <button
              onClick={createCanvas}
              className="p-1.5 rounded-lg transition-colors"
              style={{ color: "var(--t-accent)" }}
              title="New workspace"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
          {/* Search */}
          <div
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg"
            style={{ background: "var(--t-raised)", border: "1px solid var(--t-border)" }}
          >
            <Search className="w-3 h-3 shrink-0" style={{ color: "var(--t-fg-3)" }} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search…"
              className="flex-1 bg-transparent text-xs focus:outline-none"
              style={{ color: "var(--t-fg)", caretColor: "var(--t-accent)" }}
            />
          </div>
        </div>

        {/* Canvas list */}
        <div className="flex-1 overflow-y-auto px-2 pb-4">
          {listLoading ? (
            <div className="flex justify-center py-6">
              <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--t-accent) transparent transparent transparent" }} />
            </div>
          ) : filteredCanvases.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <FileText className="w-7 h-7 mx-auto mb-2 opacity-30" />
              <p className="text-xs" style={{ color: "var(--t-fg-3)" }}>
                {search ? "No results" : "No workspaces yet"}
              </p>
              {!search && (
                <button
                  onClick={createCanvas}
                  className="mt-3 text-xs font-medium"
                  style={{ color: "var(--t-accent)" }}
                >
                  Create one →
                </button>
              )}
            </div>
          ) : filteredCanvases.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setActive({ ...c });
                undoStack.current = [];
                redoStack.current = [];
              }}
              className="group w-full flex items-center gap-2.5 px-2.5 py-2 rounded-xl text-left transition-colors mb-0.5"
              style={{
                background: active?.id === c.id ? `color-mix(in srgb, var(--t-accent) 12%, transparent)` : "transparent",
                color: active?.id === c.id ? "var(--t-fg)" : "var(--t-fg-2)",
              }}
              onMouseEnter={(e) => { if (active?.id !== c.id) (e.currentTarget as HTMLButtonElement).style.background = "color-mix(in srgb, var(--t-accent) 6%, transparent)"; }}
              onMouseLeave={(e) => { if (active?.id !== c.id) (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
            >
              <span className="text-base shrink-0">{c.emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium truncate">{c.title || "Untitled"}</p>
                <p className="text-[10px] mt-0.5 truncate" style={{ color: "var(--t-fg-3)" }}>
                  {new Date(c.updated_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                </p>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); deleteCanvas(c.id); }}
                className="p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:text-red-400"
                style={{ color: "var(--t-fg-3)" }}
                title="Delete"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </button>
          ))}
        </div>
      </div>

      {/* ── Right panel: editor ── */}
      {active ? (
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Toolbar */}
          <div
            className="px-6 pt-8 pb-3 shrink-0 flex items-center gap-2"
            style={{ borderBottom: "1px solid var(--t-border)" }}
          >
            {/* Emoji picker */}
            <div className="relative">
              <button
                onClick={() => setEmojiPickerOpen((o) => !o)}
                className="text-2xl w-9 h-9 flex items-center justify-center rounded-lg hover:bg-white/5 transition-colors"
              >
                {active.emoji}
              </button>
              {emojiPickerOpen && (
                <div
                  className="absolute top-full left-0 mt-1 z-50 p-2 rounded-xl grid grid-cols-5 gap-1"
                  style={{ background: "var(--t-raised)", border: "1px solid var(--t-border)", boxShadow: "0 16px 40px rgba(0,0,0,0.4)" }}
                >
                  {EMOJIS.map((em) => (
                    <button
                      key={em}
                      onClick={() => {
                        const updated = { ...active, emoji: em };
                        setActive(updated);
                        scheduleSave(updated);
                        setEmojiPickerOpen(false);
                      }}
                      className="w-8 h-8 text-lg flex items-center justify-center rounded-lg hover:bg-white/10 transition-colors"
                    >
                      {em}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Title */}
            <input
              value={active.title}
              onChange={(e) => {
                const updated = { ...active, title: e.target.value };
                setActive(updated);
                scheduleSave(updated);
              }}
              placeholder="Untitled"
              className="flex-1 bg-transparent text-lg font-bold focus:outline-none"
              style={{ color: "var(--t-fg)" }}
            />

            {/* Undo / Redo */}
            <button onClick={undo} disabled={undoStack.current.length === 0} title="Undo" className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-colors" style={{ color: "var(--t-fg-2)" }}>
              <Undo2 className="w-4 h-4" />
            </button>
            <button onClick={redo} disabled={redoStack.current.length === 0} title="Redo" className="p-1.5 rounded-lg hover:bg-white/5 disabled:opacity-30 transition-colors" style={{ color: "var(--t-fg-2)" }}>
              <Redo2 className="w-4 h-4" />
            </button>

            {/* AI assist */}
            <div className="relative">
              <button
                onClick={() => setAiMenuOpen((o) => !o)}
                disabled={aiLoading}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: "color-mix(in srgb, var(--t-accent) 12%, transparent)", color: "var(--t-accent)" }}
              >
                {aiLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                AI
                <ChevronDown className="w-3 h-3" />
              </button>
              {aiMenuOpen && (
                <div
                  className="absolute top-full right-0 mt-1 w-44 z-50 rounded-xl overflow-hidden"
                  style={{ background: "var(--t-raised)", border: "1px solid var(--t-border)", boxShadow: "0 16px 40px rgba(0,0,0,0.4)" }}
                >
                  {(["summarize","expand","professional","casual"] as const).map((a) => (
                    <button
                      key={a}
                      onClick={() => aiAction(a)}
                      className="w-full text-left px-3 py-2 text-xs capitalize transition-colors hover:bg-white/5"
                      style={{ color: "var(--t-fg-2)" }}
                    >
                      {a === "summarize" ? "Summarise" : a === "expand" ? "Expand" : a === "professional" ? "Professional tone" : "Casual tone"}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* History */}
            <button
              onClick={() => { setHistoryOpen((o) => !o); if (!historyOpen) loadHistory(); }}
              className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
              style={{ color: historyOpen ? "var(--t-accent)" : "var(--t-fg-2)" }}
              title="Version history"
            >
              <History className="w-4 h-4" />
            </button>

            {/* Save indicator */}
            <div className="ml-1 flex items-center gap-1 text-[10px]" style={{ color: "var(--t-fg-3)" }}>
              {saving ? <><Loader2 className="w-3 h-3 animate-spin" /> Saving…</> : <span className="opacity-50">Saved</span>}
            </div>
          </div>

          <div className="flex flex-1 overflow-hidden">
            {/* Block editor */}
            <div className="flex-1 overflow-y-auto px-12 py-6" onClick={() => setSlashMenu(null)}>
              <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                <SortableContext items={active.blocks.map((b) => b.id)} strategy={verticalListSortingStrategy}>
                  <div className="max-w-3xl mx-auto space-y-0.5">
                    {active.blocks.map((block, index) => (
                      <SortableBlock key={block.id} id={block.id}>
                        <BlockEditor
                          block={block}
                          index={index}
                          onChange={(patch) => updateBlock(block.id, patch)}
                          onDelete={() => deleteBlock(block.id)}
                          onAddAfter={() => addBlockAfter(block.id)}
                          onSlashKey={(rect) => openSlashMenu(rect, block.id)}
                          onFocus={() => { focusedBlockId.current = block.id; }}
                          inputRef={(el) => {
                            if (el) blockRefs.current.set(block.id, el);
                            else blockRefs.current.delete(block.id);
                          }}
                        />
                      </SortableBlock>
                    ))}
                  </div>
                </SortableContext>
              </DndContext>

              {/* Add block button */}
              <div className="max-w-3xl mx-auto mt-3">
                <button
                  onClick={() => {
                    pushUndo();
                    const block = newBlock("text");
                    const updated = { ...active, blocks: [...active.blocks, block] };
                    setActive(updated);
                    scheduleSave(updated);
                    setTimeout(() => blockRefs.current.get(block.id)?.focus(), 30);
                  }}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs transition-colors hover:bg-white/5"
                  style={{ color: "var(--t-fg-3)" }}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add a block
                </button>
              </div>
            </div>

            {/* History panel */}
            {historyOpen && (
              <div
                className="w-64 shrink-0 flex flex-col border-l overflow-hidden"
                style={{ borderColor: "var(--t-border)", background: "var(--t-sidebar)" }}
              >
                <div className="flex items-center justify-between px-4 py-3 border-b shrink-0" style={{ borderColor: "var(--t-border)" }}>
                  <div className="flex items-center gap-2">
                    <Clock className="w-3.5 h-3.5" style={{ color: "var(--t-accent)" }} />
                    <span className="text-xs font-semibold" style={{ color: "var(--t-fg)" }}>History</span>
                  </div>
                  <button onClick={() => setHistoryOpen(false)} className="p-1 rounded hover:bg-white/10 transition-colors" style={{ color: "var(--t-fg-3)" }}>
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-1">
                  {historyLoading ? (
                    <div className="flex justify-center py-4">
                      <div className="w-4 h-4 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--t-accent) transparent transparent transparent" }} />
                    </div>
                  ) : history.length === 0 ? (
                    <p className="text-xs text-center py-4" style={{ color: "var(--t-fg-3)" }}>No history yet</p>
                  ) : history.map((h) => (
                    <div
                      key={h.id}
                      className="p-2.5 rounded-xl border transition-colors"
                      style={{ background: "var(--t-raised)", borderColor: "var(--t-border)" }}
                    >
                      <p className="text-xs font-medium truncate" style={{ color: "var(--t-fg)" }}>{h.title || "Untitled"}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "var(--t-fg-3)" }}>
                        {new Date(h.created_at).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                      <button
                        onClick={() => restoreVersion(h)}
                        className="mt-1.5 flex items-center gap-1 text-[10px] font-medium transition-colors"
                        style={{ color: "var(--t-accent)" }}
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        Restore
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Empty state */
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl"
            style={{ background: "color-mix(in srgb, var(--t-accent) 12%, transparent)" }}
          >
            📄
          </div>
          <div className="text-center">
            <h3 className="text-base font-semibold mb-1" style={{ color: "var(--t-fg)" }}>No workspace open</h3>
            <p className="text-sm" style={{ color: "var(--t-fg-3)" }}>Select one from the list or create a new one</p>
          </div>
          <button
            onClick={createCanvas}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors"
            style={{ background: "var(--t-accent)", color: "#000" }}
          >
            <Plus className="w-4 h-4" />
            New Workspace
          </button>
        </div>
      )}

      {/* Slash menu */}
      {slashMenu && (
        <>
          <div className="fixed inset-0 z-[100]" onClick={() => setSlashMenu(null)} />
          <div
            className="fixed z-[101] rounded-xl overflow-hidden w-64 max-h-72 overflow-y-auto"
            style={{
              top: slashMenu.y,
              left: slashMenu.x,
              background: "var(--t-raised)",
              border: "1px solid var(--t-border)",
              boxShadow: "0 16px 48px rgba(0,0,0,0.4)",
            }}
          >
            <div className="p-2 border-b" style={{ borderColor: "var(--t-border)" }}>
              <input
                autoFocus
                value={slashFilter}
                onChange={(e) => setSlashFilter(e.target.value)}
                placeholder="Filter blocks…"
                className="w-full bg-transparent text-xs focus:outline-none"
                style={{ color: "var(--t-fg)" }}
              />
            </div>
            {filteredMenu.map((item) => (
              <button
                key={item.type}
                onClick={() => insertBlockType(item.type)}
                className="w-full flex items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-white/5"
                style={{ color: "var(--t-fg-2)" }}
              >
                <span className="shrink-0" style={{ color: "var(--t-accent)" }}>{item.icon}</span>
                <div>
                  <p className="text-xs font-medium" style={{ color: "var(--t-fg)" }}>{item.label}</p>
                  <p className="text-[10px]" style={{ color: "var(--t-fg-3)" }}>{item.description}</p>
                </div>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
