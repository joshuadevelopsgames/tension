"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { HeaderSearch } from "./HeaderSearch";
import { CreateChannelModal } from "./CreateChannelModal";
import { NewDMModal } from "./NewDMModal";
import { WorkspaceMembersModal } from "./WorkspaceMembersModal";
import { NotificationBell } from "./NotificationBell";
import { startWindowDrag } from "@/lib/tauri";
import { ProfileModal } from "./ProfileModal";
import { Bookmark, Plus, Settings, Users, LogOut, Sparkles, Sun, Moon, LayoutTemplate } from "lucide-react";
import { StatusBar } from "./StatusBar";
import { useTheme } from "./ThemeProvider";
import { useState, useEffect, useRef, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { HuddleProvider } from "@/context/HuddleContext";
import { HuddleWidget } from "./HuddleWidget";
import { STATUS_COLORS, STATUS_OPTIONS } from "@/lib/constants";

function ModeToggle() {
  const { mode, toggleMode } = useTheme();
  return (
    <button
      onClick={toggleMode}
      title={mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      className="relative p-2 rounded-lg hover:bg-white/5 text-zinc-400 hover:text-zinc-200 transition-colors"
    >
      {mode === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
    </button>
  );
}

function StatusBarWrapper({ workspaceName, channels }: { workspaceName: string; channels: { id: string; name: string; slug: string }[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeChannelId = pathname === "/channel" ? searchParams.get("id") : null;
  const activeChannel = activeChannelId ? channels.find((c) => c.id === activeChannelId) : null;
  return <StatusBar workspaceName={workspaceName} channelName={activeChannel?.name} />;
}

type DMItem = {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string | null;
};

function SidebarContent({
  workspaceName,
  workspaceId,
  workspaceSlug,
  currentUserId,
  channels,
  dms: initialDMs,
  setProfileOpen,
}: {
  workspaceName: string;
  workspaceId: string;
  workspaceSlug: string;
  currentUserId: string;
  channels: { id: string; name: string; slug: string }[];
  dms: DMItem[];
  setProfileOpen: (v: boolean) => void;
}) {
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [isNewDMOpen, setIsNewDMOpen] = useState(false);
  const [isMembersOpen, setIsMembersOpen] = useState(false);
  const [allChannels, setAllChannels] = useState(channels);
  const [dms, setDMs] = useState<DMItem[]>(initialDMs);
  const [myProfile, setMyProfile] = useState<{ full_name: string | null; avatar_url: string | null; status: string | null; status_emoji: string | null; status_message: string | null } | null>(null);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const [customStatusEmoji, setCustomStatusEmoji] = useState("");
  const [customStatusMessage, setCustomStatusMessage] = useState("");
  const [statusDuration, setStatusDuration] = useState<number | null>(null); // minutes, null = forever
  const [emojiPickerOpen, setEmojiPickerOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();

    // Auto-clear expired status
    const expiresAt = localStorage.getItem(`status_expires:${currentUserId}`);
    if (expiresAt && Date.now() > Number(expiresAt)) {
      localStorage.removeItem(`status_expires:${currentUserId}`);
      supabase.from("users").update({ status_emoji: null, status_message: null }).eq("id", currentUserId).then(() => {});
    }

    supabase.from("users").select("full_name, avatar_url, status, status_emoji, status_message").eq("id", currentUserId).single()
      .then(({ data }) => {
        if (data) {
          setMyProfile(data);
          setCustomStatusEmoji(data.status_emoji ?? "");
          setCustomStatusMessage(data.status_message ?? "");
        }
      });
  }, [currentUserId]);

  // Unread badge tracking
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  // Ambient activity orbs — channels with very recent messages
  const [recentlyActive, setRecentlyActive] = useState<Set<string>>(new Set());
  const orbTimeoutsRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Presence — online user IDs
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());

  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeChannelId = pathname === "/channel" ? searchParams.get("id") : null;
  const activeDmId = pathname === "/dm" ? searchParams.get("id") : null;

  // Clear unread + activity orb when navigating to a channel/DM
  useEffect(() => {
    const viewedId = activeChannelId || activeDmId;
    if (!viewedId) return;
    setUnreadCounts((prev) => { const n = { ...prev }; delete n[viewedId]; return n; });
    setRecentlyActive((prev) => { const n = new Set(prev); n.delete(viewedId); return n; });
    // Also cancel the orb timeout so it doesn't re-add later
    const t = orbTimeoutsRef.current.get(viewedId);
    if (t) { clearTimeout(t); orbTimeoutsRef.current.delete(viewedId); }
  }, [activeChannelId, activeDmId]);

  // Subscribe to new messages and increment unread for inactive channels/DMs
  useEffect(() => {
    const supabase = createClient();
    const sub = supabase
      .channel(`sidebar:${workspaceId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages", filter: `workspace_id=eq.${workspaceId}` },
        (payload) => {
          const msg = payload.new as { sender_id: string; channel_id: string | null; dm_conversation_id: string | null };
          const id: string | null = msg.channel_id || msg.dm_conversation_id || null;
          if (!id) return;

          // Ambient orb: light up the channel for 5 minutes regardless of who sent it
          const existing = orbTimeoutsRef.current.get(id);
          if (existing) clearTimeout(existing);
          setRecentlyActive((prev) => new Set(prev).add(id));
          const t = setTimeout(() => {
            setRecentlyActive((prev) => { const n = new Set(prev); n.delete(id); return n; });
            orbTimeoutsRef.current.delete(id);
          }, 5 * 60 * 1000);
          orbTimeoutsRef.current.set(id, t);

          // Unread badge only for others' messages in inactive channels
          if (msg.sender_id === currentUserId) return;
          if (id === activeChannelId || id === activeDmId) return;
          setUnreadCounts((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
        }
      )
      .subscribe();
    return () => {
      supabase.removeChannel(sub);
      orbTimeoutsRef.current.forEach(clearTimeout);
    };
  }, [workspaceId, currentUserId, activeChannelId, activeDmId]);

  // Supabase Realtime presence — track who's online in this workspace
  useEffect(() => {
    if (!currentUserId) return;
    const supabase = createClient();
    const ch = supabase.channel(`presence:${workspaceId}`, { config: { presence: { key: currentUserId } } });
    ch.on("presence", { event: "sync" }, () => {
      const state = ch.presenceState<{ userId: string }>();
      setOnlineUsers(new Set(Object.keys(state)));
    })
    .on("presence", { event: "join" }, ({ key }) => {
      setOnlineUsers((prev) => new Set(prev).add(key));
    })
    .on("presence", { event: "leave" }, ({ key }) => {
      setOnlineUsers((prev) => { const n = new Set(prev); n.delete(key); return n; });
    })
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await ch.track({ userId: currentUserId, online_at: new Date().toISOString() });
      }
    });
    return () => { supabase.removeChannel(ch); };
  }, [workspaceId, currentUserId]);

  function handleChannelCreated(channel: { id: string; name: string; slug: string }) {
    setAllChannels((prev) => [...prev, channel].sort((a, b) => a.name.localeCompare(b.name)));
  }

  function handleDMCreated(dm: { id: string; otherUserId: string; otherUserName: string }) {
    setDMs((prev) => {
      if (prev.some((d) => d.id === dm.id)) return prev;
      return [...prev, { ...dm, otherUserAvatar: null }];
    });
  }

  return (
    <>
      <nav className="flex-1 overflow-y-auto p-3 space-y-6">
        {/* Channels */}
        <div>
          <div className="flex items-center justify-between mb-2 px-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 select-none">Channels</p>
            <button
              onClick={() => setIsCreateChannelOpen(true)}
              title="Create channel"
              className="p-0.5 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          <ul className="space-y-0.5">
            {allChannels.map((ch) => {
              const count = unreadCounts[ch.id] ?? 0;
              const active = recentlyActive.has(ch.id);
              const isCurrent = ch.id === activeChannelId;
              return (
                <li key={ch.id}>
                  <Link
                    href={`/channel?id=${ch.id}`}
                    className={`flex items-center gap-2 py-1.5 rounded-r-lg text-sm font-medium transition-colors border-l-[3px] pl-2 pr-2 ${
                      isCurrent
                        ? "border-[var(--t-accent)] text-white bg-white/[0.08]"
                        : count > 0
                        ? "border-transparent text-zinc-100 hover:bg-white/5"
                        : "border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
                    }`}
                  >
                    <span className="text-zinc-600 font-normal">#</span>
                    <span className="flex-1 truncate">{ch.name}</span>
                    {active && count === 0 && (
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--t-accent)] animate-orb shrink-0" title="Active" />
                    )}
                    {count > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--t-accent)]/80 text-[10px] font-bold text-white flex items-center justify-center leading-none">
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {/* Direct Messages */}
        <div>
          <div className="flex items-center justify-between mb-2 px-2">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 select-none">Direct Messages</p>
            <button
              onClick={() => setIsNewDMOpen(true)}
              title="New direct message"
              className="p-0.5 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          </div>
          {dms.length === 0 ? (
            <button
              onClick={() => setIsNewDMOpen(true)}
              className="w-full px-2 py-1 text-xs text-zinc-600 hover:text-zinc-400 text-left transition-colors"
            >
              + Start a conversation
            </button>
          ) : (
          <ul className="space-y-0.5">
              {dms.map((dm) => {
                const isAI = dm.otherUserId === "00000000-0000-0000-0000-000000000001";
                const initials = dm.otherUserName.slice(0, 2).toUpperCase();
                const count = unreadCounts[dm.id] ?? 0;
                const active = recentlyActive.has(dm.id);
                const isOnline = !isAI && onlineUsers.has(dm.otherUserId);
                return (
                  <li key={dm.id}>
                    <Link
                      href={`/dm?id=${dm.id}`}
                      className={`flex items-center gap-2 py-1.5 rounded-r-lg text-sm font-medium transition-colors border-l-[3px] pl-2 pr-2 ${
                        dm.id === activeDmId
                          ? "border-[var(--t-accent)] text-white bg-white/[0.08]"
                          : count > 0
                          ? "border-transparent text-zinc-100 hover:bg-white/5"
                          : "border-transparent text-zinc-400 hover:text-zinc-100 hover:bg-white/5"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <div className={`w-5 h-5 rounded-full border border-[var(--t-border)] flex items-center justify-center text-[9px] font-semibold overflow-hidden ${
                          isAI
                            ? "bg-[var(--t-accent)] text-white"
                            : "bg-[var(--t-accent)]/20 text-[var(--t-accent)]"
                        }`}>
                          {isAI ? (
                            <Sparkles className="w-2.5 h-2.5" />
                          ) : dm.otherUserAvatar ? (
                            <img src={dm.otherUserAvatar} alt={dm.otherUserName} className="w-full h-full object-cover" />
                          ) : (
                            initials
                          )}
                        </div>
                        {isOnline && (
                          <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-emerald-500 border border-[var(--t-surface)] animate-presence" />
                        )}
                      </div>
                      <span className="flex-1 truncate">{dm.otherUserName}</span>
                      {active && count === 0 && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[var(--t-accent)] animate-orb shrink-0" title="Active" />
                      )}
                      {count > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--t-accent)]/80 text-[10px] font-bold text-white flex items-center justify-center leading-none">
                          {count > 99 ? "99+" : count}
                        </span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </nav>

      <div className="p-3 space-y-2">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMembersOpen(true)}
            className="flex-1 flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded-lg text-xs font-medium text-zinc-400 transition-colors"
          >
            <Users className="w-4 h-4" />
            <span>Members</span>
          </button>
          <Link
            href="/workspaces"
            className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Workspaces"
          >
            <LayoutTemplate className="w-4 h-4" />
          </Link>
          <Link
            href="/saved"
            className="flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded-lg text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
            title="Saved messages"
          >
            <Bookmark className="w-4 h-4" />
          </Link>
        </div>

        {/* Profile card */}
        {(() => {
          return (
            <div className="relative mt-1">
              {/* Status picker popover */}
              {statusPickerOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-52 bg-[var(--t-raised)] border border-[var(--t-border)] rounded-xl z-50" style={{boxShadow:'0px 24px 48px rgba(0,0,0,0.5)'}}>
                  {/* Custom status */}
                  <div className="p-2 border-b border-[var(--t-border)]">
                    <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-wider px-1 mb-1.5">Custom Status</p>
                    <div className="flex items-center gap-1.5">
                      {/* Emoji picker button */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() => setEmojiPickerOpen((o) => !o)}
                          className={`w-9 h-9 flex items-center justify-center rounded-md border text-lg transition-colors ${emojiPickerOpen ? "border-[var(--t-accent)]/50 bg-[var(--t-accent)]/10" : "border-[var(--t-border)] bg-[var(--t-surface)]/60 hover:border-[var(--t-accent)]/30"}`}
                        >
                          {customStatusEmoji || "😊"}
                        </button>
                        {emojiPickerOpen && (
                          <div className="absolute top-full left-0 mt-1 bg-[var(--t-raised)]/90 backdrop-blur-xl border border-[var(--t-border)] rounded-xl p-2 grid grid-cols-6 gap-0.5 z-[9999] w-48 max-h-48 overflow-y-auto" style={{boxShadow:'0px 24px 48px rgba(0,0,0,0.5)'}}>
                            {["😊","😄","😂","😅","🤔","🤩","😎","🥳","😴","🤒","😤","🥹",
                              "🔥","✅","🚀","💯","👀","💡","⚡","🎯","📌","⚠️","🏆","✨",
                              "👍","👎","❤️","🎉","💪","🫡","🙏","💀","🤝","👋","🫶","🎊",
                              "☕","🍕","🎸","⚽","🌴","🏖️","🌙","☀️","🌧️","❄️","🌈","🎁"].map((e) => (
                              <button
                                key={e}
                                type="button"
                                onClick={() => { setCustomStatusEmoji(e); setEmojiPickerOpen(false); }}
                                className="w-7 h-7 flex items-center justify-center text-base rounded hover:bg-white/10 transition-colors"
                              >
                                {e}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <input
                        value={customStatusMessage}
                        onChange={(e) => setCustomStatusMessage(e.target.value)}
                        placeholder="What are you up to?"
                        className="flex-1 bg-[var(--t-surface)] border border-[var(--t-border)] rounded-md px-2 py-1.5 text-xs placeholder:text-zinc-500 focus:outline-none focus:border-[var(--t-accent)]/50" style={{ color: "var(--t-fg)" }}
                      />
                    </div>
                    {/* Duration picker */}
                    <div className="flex gap-1 mt-1.5 flex-wrap">
                      {([null, 30, 60, 240] as (number | null)[]).map((mins) => (
                        <button
                          key={mins ?? "forever"}
                          type="button"
                          onClick={() => setStatusDuration(mins)}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${statusDuration === mins ? "bg-[var(--t-accent)] text-white" : "bg-white/5 text-zinc-500 hover:bg-white/10 hover:text-zinc-300"}`}
                        >
                          {mins === null ? "Forever" : mins < 60 ? `${mins}m` : `${mins / 60}h`}
                        </button>
                      ))}
                    </div>
                    <button
                      onClick={async () => {
                        const supabase = createClient();
                        await supabase.from("users").update({ status_emoji: customStatusEmoji || null, status_message: customStatusMessage || null }).eq("id", currentUserId);
                        setMyProfile((p) => p ? { ...p, status_emoji: customStatusEmoji || null, status_message: customStatusMessage || null } : p);
                        if (statusDuration) {
                          localStorage.setItem(`status_expires:${currentUserId}`, String(Date.now() + statusDuration * 60 * 1000));
                        } else {
                          localStorage.removeItem(`status_expires:${currentUserId}`);
                        }
                        setStatusPickerOpen(false);
                      }}
                      className="mt-1.5 w-full py-1 bg-[var(--t-accent)]/80 hover:bg-[var(--t-accent)] text-white text-[11px] font-medium rounded-md transition-colors"
                    >
                      Set Status
                    </button>
                  </div>
                  {/* Availability */}
                  <div className="py-1">
                    {STATUS_OPTIONS.map((opt) => (
                      <button
                        key={opt.value}
                        onClick={async () => {
                          setStatusPickerOpen(false);
                          const supabase = createClient();
                          await supabase.from("users").update({ status: opt.value }).eq("id", currentUserId);
                          setMyProfile((p) => p ? { ...p, status: opt.value } : p);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium transition-colors hover:bg-white/5"
                        style={{ color: myProfile?.status === opt.value ? "var(--t-fg)" : "var(--t-fg-2)" }}
                      >
                        <span className={`w-2 h-2 rounded-full shrink-0 ${opt.color}`} />
                        {opt.label}
                        {myProfile?.status === opt.value && <span className="ml-auto text-[var(--t-accent)]">✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-1">
                {/* Profile info — click to open status picker */}
                <button
                  onClick={() => setStatusPickerOpen((o) => !o)}
                  className="flex-1 flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-full bg-[var(--t-accent)]/25 border border-[var(--t-border)] flex items-center justify-center text-xs font-semibold text-[var(--t-accent)] overflow-hidden">
                      {myProfile?.avatar_url ? (
                        <img src={myProfile.avatar_url} alt={myProfile.full_name ?? ""} className="w-full h-full object-cover" />
                      ) : (
                        (myProfile?.full_name ?? currentUserId).slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--t-sidebar)] ${STATUS_COLORS[myProfile?.status ?? "offline"] ?? "bg-zinc-500"}`} />
                  </div>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-semibold text-zinc-200 truncate leading-tight">
                      {myProfile?.full_name ?? "You"}
                    </p>
                    <p className="text-[10px] text-zinc-500 capitalize leading-tight mt-0.5">
                      {myProfile?.status ?? "offline"}
                    </p>
                  </div>
                </button>

                {/* Settings icon — separate button with submenu */}
                <div className="relative">
                  <button
                    onClick={() => { setStatusPickerOpen(false); setSettingsMenuOpen((o) => !o); }}
                    title="Settings"
                    className="p-2 rounded-lg hover:bg-white/5 text-zinc-600 hover:text-zinc-300 transition-colors shrink-0"
                  >
                    <Settings className="w-3.5 h-3.5" />
                  </button>
                  {settingsMenuOpen && (
                    <div className="absolute bottom-full right-0 mb-2 w-44 bg-[var(--t-raised)]/90 backdrop-blur-xl border border-[var(--t-border)] rounded-xl overflow-hidden z-50" style={{boxShadow:'0px 24px 48px rgba(0,0,0,0.5)'}}>
                      <button
                        onClick={() => { setSettingsMenuOpen(false); setProfileOpen(true); }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-zinc-300 hover:bg-white/5 hover:text-white transition-colors"
                      >
                        <Settings className="w-3.5 h-3.5" />
                        Edit Profile
                      </button>
                      <div className="h-px bg-white/5 mx-2" />
                      <button
                        onClick={async () => {
                          setSettingsMenuOpen(false);
                          const supabase = createClient();
                          await supabase.auth.signOut();
                          router.push("/login");
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        Log Out
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })()}
      </div>


      <CreateChannelModal
        isOpen={isCreateChannelOpen}
        onClose={() => setIsCreateChannelOpen(false)}
        workspaceId={workspaceId}
        onChannelCreated={handleChannelCreated}
      />
      <NewDMModal
        isOpen={isNewDMOpen}
        onClose={() => setIsNewDMOpen(false)}
        workspaceId={workspaceId}
        currentUserId={currentUserId}
        onDMCreated={handleDMCreated}
      />
      <WorkspaceMembersModal
        isOpen={isMembersOpen}
        onClose={() => setIsMembersOpen(false)}
        workspaceId={workspaceId}
        workspaceSlug={workspaceSlug}
        currentUserId={currentUserId}
      />
    </>
  );
}

export function AppShell({
  workspaceName,
  workspaceSlug,
  workspaceId,
  currentUserId,
  channels,
  dms,
  children,
}: {
  workspaceName: string;
  workspaceSlug: string;
  workspaceId: string;
  currentUserId: string;
  channels: { id: string; name: string; slug: string }[];
  dms: DMItem[];
  children: React.ReactNode;
}) {
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  return (
    <HuddleProvider currentUserId={currentUserId} workspaceId={workspaceId}>
    <div className="flex flex-col h-screen text-zinc-200 overflow-hidden font-sans border border-[var(--t-border)] shadow-2xl bg-[var(--t-surface)] rounded-xl">
      {/* Top Header Bar — no border, tonal shift only */}
      <div
        onPointerDown={startWindowDrag}
        className="h-10 w-full shrink-0 bg-[var(--t-header)] flex items-center px-4 select-none cursor-grab active:cursor-grabbing z-50 relative"
      >
        <div className="pl-16 text-[11px] font-bold tracking-widest uppercase select-none" style={{ color: "var(--t-accent)" }}>Tension</div>

        {/* Search bar — centred in the header */}
        <div className="absolute left-1/2 -translate-x-1/2">
          <HeaderSearch channels={channels} />
        </div>

        <div className="ml-auto flex items-center gap-1">
          <ModeToggle />
          <NotificationBell currentUserId={currentUserId} />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative z-20">
        <aside className="w-64 flex flex-col bg-[var(--t-sidebar)] relative z-20">
          <div className="h-12 flex items-center px-4 shrink-0 select-none">
            <h1 className="font-semibold text-zinc-100 text-sm truncate">{workspaceName}</h1>
          </div>
          <Suspense fallback={null}>
            <SidebarContent
              workspaceName={workspaceName}
              workspaceSlug={workspaceSlug}
              workspaceId={workspaceId}
              currentUserId={currentUserId}
              channels={channels}
              dms={dms}
              setProfileOpen={setIsProfileOpen}
            />
          </Suspense>
        </aside>
        <main className="flex-1 flex flex-col min-w-0 bg-[var(--t-surface)] relative">
          <div className="flex-1 overflow-hidden flex flex-col relative z-20">
            {children}
          </div>
          <Suspense fallback={null}>
            <StatusBarWrapper workspaceName={workspaceName} channels={channels} />
          </Suspense>
        </main>
      </div>

      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      <HuddleWidget />
    </div>
    </HuddleProvider>
  );
}
