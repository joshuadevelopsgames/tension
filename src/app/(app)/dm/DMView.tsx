"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { ChevronDown, Send, Sparkles } from "lucide-react";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import { DateSeparator, isDifferentDay } from "@/components/DateSeparator";

const TENSION_AI_USER_ID = "00000000-0000-0000-0000-000000000001";

type Message = {
  id: string;
  body: string;
  sender_id: string;
  created_at: string;
  parent_id: string | null;
};

type DMParticipant = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
};

export function DMView({
  dmId,
  participants,
  initialMessages,
  currentUserId,
}: {
  dmId: string;
  participants: DMParticipant[];
  initialMessages: Message[];
  currentUserId: string;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [aiThinking, setAiThinking] = useState(false);
  const supabase = createClient();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const lastSentDraftRef = useRef<string | null>(null);
  const typingChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const typingTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const currentUserRef = useRef<string>(currentUserId);
  const [otherTimezone, setOtherTimezone] = useState<string | null>(null);

  const myTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const otherParticipants = participants.filter((p) => p.user_id !== currentUserId);
  const otherName =
    otherParticipants.map((p) => p.full_name || `User ${p.user_id.slice(0, 4)}`).join(", ") || "Unknown";
  const isAIChat = participants.some(p => p.user_id === TENSION_AI_USER_ID);

  // Fetch other participant's timezone
  useEffect(() => {
    const otherId = otherParticipants[0]?.user_id;
    if (!otherId) return;
    supabase.from("users").select("timezone").eq("id", otherId).single()
      .then(({ data }) => {
        if (data?.timezone && data.timezone !== myTimezone) setOtherTimezone(data.timezone);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dmId]);

  // Build a lookup of userId → display info
  const userMap = new Map(
    participants.map((p) => [
      p.user_id,
      {
        name: p.full_name || `User ${p.user_id.slice(0, 4)}`,
        initials: (p.full_name || p.user_id).slice(0, 2).toUpperCase(),
        avatar_url: p.avatar_url,
      },
    ])
  );

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Typing broadcast
  useEffect(() => {
    const ch = supabase.channel(`typing:dm:${dmId}`);
    typingChannelRef.current = ch;
    ch.on("broadcast", { event: "typing" }, ({ payload }: { payload: { userId: string; name: string } }) => {
      const { userId, name } = payload;
      if (userId === currentUserRef.current) return;
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
  }, [dmId, supabase]);

  function handleTyping() {
    if (!typingChannelRef.current) return;
    const me = participants.find((p) => p.user_id === currentUserId);
    const name = me?.full_name || "Someone";
    typingChannelRef.current.send({ type: "broadcast", event: "typing", payload: { userId: currentUserId, name } });
  }

  function handleScroll() {
    const el = scrollContainerRef.current;
    if (!el) return;
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120);
  }

  useEffect(() => {
    const sub = supabase
      .channel(`dm:${dmId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `dm_conversation_id=eq.${dmId}`,
        },
        (payload) => {
          const newMsg = payload.new as Message;
          setMessages((prev) => {
            if (prev.some((m) => m.id === newMsg.id)) return prev;
            if (prev.some((m) => m.body === newMsg.body && m.created_at === newMsg.created_at)) return prev;
            return [...prev, newMsg];
          });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [dmId, supabase]);

  async function send() {
    const toSend = draft.trim();
    if (!toSend || toSend === lastSentDraftRef.current) return;

    setDraft("");
    lastSentDraftRef.current = toSend;

    const realId = crypto.randomUUID();
    const optimistic: Message = {
      id: realId,
      body: toSend,
      sender_id: currentUserId,
      created_at: new Date().toISOString(),
      parent_id: null,
    };
    setMessages((prev) => [...prev, optimistic]);

    const { data: w } = await supabase
      .from("workspace_members")
      .select("workspace_id")
      .eq("user_id", currentUserId)
      .limit(1)
      .single();

    if (!w?.workspace_id) {
      setMessages((prev) => prev.filter((m) => m.id !== realId));
      return;
    }

    let targetDmId = dmId;

    // Handle temporary AI DM ID
    if (dmId === "temp-ai-dm") {
      const { data: conv, error: convError } = await supabase
        .from("dm_conversations")
        .insert({ workspace_id: w.workspace_id })
        .select("id")
        .single();
      
      if (convError || !conv) {
        setMessages((prev) => prev.filter((m) => m.id !== realId));
        console.error("Failed to create real AI DM:", convError);
        return;
      }

      const { error: partError } = await supabase.from("dm_participants").insert([
        { dm_conversation_id: conv.id, user_id: currentUserId },
        { dm_conversation_id: conv.id, user_id: TENSION_AI_USER_ID },
      ]);

      if (partError) {
        setMessages((prev) => prev.filter((m) => m.id !== realId));
        console.error("Failed to add participants to real AI DM:", partError);
        return;
      }

      targetDmId = conv.id;
    }

    const { data, error } = await supabase
      .from("messages")
      .insert({
        id: realId,
        workspace_id: w.workspace_id,
        sender_id: currentUserId,
        dm_conversation_id: targetDmId,
        body: toSend,
      })
      .select()
      .single();

    if (error) {
      setMessages((prev) => prev.filter((m) => m.id !== realId));
    } else {
      setMessages((prev) => prev.map((m) => (m.id === realId ? (data as Message) : m)));
    }

    // If chatting with Tension AI, trigger the AI response
    if (isAIChat && !error && w.workspace_id) {
      setAiThinking(true);
      try {
        const history = messages.slice(-5).map(m => ({
          role: m.sender_id === currentUserId ? "user" : "assistant",
          content: m.body
        }));

        await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            message: toSend, 
            dmId: targetDmId, 
            workspaceId: w.workspace_id,
            history 
          }),
        });
      } catch (e) {
        console.error("AI chat error:", e);
      } finally {
        setAiThinking(false);
        // If we just created the conversation, navigate to the real ID so refreshes work
        if (dmId === "temp-ai-dm" && targetDmId !== "temp-ai-dm") {
          const params = new URLSearchParams(window.location.search);
          params.set("id", targetDmId);
          window.history.replaceState(null, "", `${window.location.pathname}?${params.toString()}`);
        }
      }
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <header className="px-6 py-4 pt-10 flex items-center gap-3 shrink-0 border-b border-white/5 select-none">
        <div className="flex -space-x-2">
          {otherParticipants.slice(0, 3).map((p) => {
            const info = userMap.get(p.user_id);
            const isTensionBot = p.user_id === TENSION_AI_USER_ID;
            return (
              <div
                key={p.user_id}
                className={`w-7 h-7 rounded-full border border-white/10 flex items-center justify-center text-xs font-semibold overflow-hidden ${
                  isTensionBot
                    ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white"
                    : "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-300"
                }`}
              >
                {isTensionBot ? (
                  <Sparkles className="w-3.5 h-3.5" />
                ) : p.avatar_url ? (
                  <img src={p.avatar_url} alt={info?.name} className="w-full h-full object-cover" />
                ) : (
                  info?.initials
                )}
              </div>
            );
          })}
        </div>
        <div>
          <h2 className="font-semibold text-zinc-100 text-sm">{otherName}</h2>
          {isAIChat && <p className="text-[10px] text-indigo-400 font-medium">AI Assistant · powered by Gemini</p>}
        </div>
      </header>

      <div className="relative flex-1 min-h-0 overflow-hidden">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto"
        >
        <div className="flex flex-col justify-end min-h-full px-6 py-4">
        {messages.length === 0 ? (
          <div className="flex-1 flex items-center justify-center py-16">
            <div className="text-center">
              <div className="flex justify-center -space-x-2 mb-3">
                {otherParticipants.slice(0, 2).map((p) => {
                  const info = userMap.get(p.user_id);
                  return (
                    <div
                      key={p.user_id}
                      className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border-2 border-zinc-900 flex items-center justify-center text-base font-semibold text-indigo-300 overflow-hidden"
                    >
                      {p.avatar_url ? (
                        <img src={p.avatar_url} alt={info?.name} className="w-full h-full object-cover" />
                      ) : (
                        info?.initials
                      )}
                    </div>
                  );
                })}
              </div>
              <p className="text-zinc-400 text-sm font-medium">{otherName}</p>
              <p className="text-zinc-600 text-xs mt-1">This is the beginning of your conversation.</p>
            </div>
          </div>
        ) : null}

        {messages.map((m, i) => {
            const prev = messages[i - 1] ?? null;
            const showDate = !prev || isDifferentDay(prev.created_at, m.created_at);
            const time = new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
            const info = userMap.get(m.sender_id) ?? {
              name: `User ${m.sender_id.slice(0, 4)}`,
              initials: m.sender_id.slice(0, 2).toUpperCase(),
              avatar_url: null,
            };
            const isGrouped =
              !showDate &&
              i > 0 &&
              messages[i - 1].sender_id === m.sender_id &&
              new Date(m.created_at).getTime() - new Date(messages[i - 1].created_at).getTime() <= 3600000;

            if (isGrouped) {
              return (
                <div key={m.id}>
                {showDate && <DateSeparator date={m.created_at} />}
                <div className="flex gap-4 group mt-1 hover:bg-white/[0.02] -mx-4 px-4 py-0.5 rounded-sm">
                  <div className="w-8 shrink-0 text-right">
                    <span className="text-[10px] font-medium text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap block mt-1">
                      {time}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <MarkdownMessage body={m.body} />
                  </div>
                </div>
                </div>
              );
            }

            return (
              <div key={m.id}>
              {showDate && <DateSeparator date={m.created_at} />}
              <div className="flex gap-4 group mt-4 hover:bg-white/[0.02] -mx-4 px-4 py-1 rounded-sm">
                <div className="w-8 h-8 rounded shrink-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-xs font-semibold text-indigo-300 select-none mt-0.5 overflow-hidden">
                  {info.avatar_url ? (
                    <img src={info.avatar_url} alt={info.name} className="w-full h-full object-cover" />
                  ) : (
                    info.initials
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-[13px] font-semibold text-zinc-200">{info.name}</span>
                    <span className="text-[10px] font-medium text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">
                      {time}
                    </span>
                  </div>
                  <MarkdownMessage body={m.body} />
                </div>
              </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
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
        {aiThinking ? (
          <div className="flex items-center gap-2 text-[11px] text-indigo-400">
            <Sparkles className="w-3 h-3 animate-pulse" />
            <span>Tension AI is thinking…</span>
          </div>
        ) : typingUsers.size > 0 ? (
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
        ) : null}
      </div>

      {/* Timezone banner */}
      {otherTimezone && (() => {
        try {
          const theirTime = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", timeZone: otherTimezone });
          const tzLabel = otherTimezone.replace(/_/g, " ").split("/").pop();
          return (
            <div className="px-4 pb-1 shrink-0">
              <p className="text-[11px] text-zinc-600 flex items-center gap-1">
                <span>🕐</span>
                <span><span className="text-zinc-500 font-medium">{otherName.split(" ")[0]}</span> is in {tzLabel} — it's <span className="text-zinc-500 font-medium">{theirTime}</span> there
                </span>
              </p>
            </div>
          );
        } catch { return null; }
      })()}

      <div className="p-4 pt-2 shrink-0">
        <form
          onSubmit={(e) => { e.preventDefault(); send(); }}
          className="flex items-end gap-2 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl p-1 shadow-inner focus-within:border-white/20 focus-within:bg-black/60 transition-colors"
        >
          <input
            type="text"
            value={draft}
            onChange={(e) => { setDraft(e.target.value); lastSentDraftRef.current = null; handleTyping(); }}
            placeholder={`Message ${otherName}`}
            className="flex-1 bg-transparent px-3 py-2.5 text-[14px] text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!draft.trim()}
            className="p-2 mb-0.5 mr-0.5 rounded-lg bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-white/5 disabled:hover:text-zinc-400 transition-colors"
          >
            <Send className="w-[18px] h-[18px]" />
          </button>
        </form>
      </div>
    </div>
  );
}
