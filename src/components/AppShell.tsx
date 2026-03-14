"use client";

import Link from "next/link";
import { usePathname, useSearchParams, useRouter } from "next/navigation";
import { CommandPalette } from "./CommandPalette";
import { CreateChannelModal } from "./CreateChannelModal";
import { NewDMModal } from "./NewDMModal";
import { WorkspaceMembersModal } from "./WorkspaceMembersModal";
import { NotificationBell } from "./NotificationBell";
import { startWindowDrag } from "@/lib/tauri";
import { ProfileModal } from "./ProfileModal";
import { Plus, Settings, Users, LogOut, Sparkles } from "lucide-react";
import { useState, useEffect, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";

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
  const [myProfile, setMyProfile] = useState<{ full_name: string | null; avatar_url: string | null; status: string | null } | null>(null);
  const [statusPickerOpen, setStatusPickerOpen] = useState(false);
  const [settingsMenuOpen, setSettingsMenuOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const supabase = createClient();
    supabase.from("users").select("full_name, avatar_url, status").eq("id", currentUserId).single()
      .then(({ data }) => setMyProfile(data ?? null));
  }, [currentUserId]);

  // Unread badge tracking
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({});
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const activeChannelId = pathname === "/channel" ? searchParams.get("id") : null;
  const activeDmId = pathname === "/dm" ? searchParams.get("id") : null;

  // Clear unread when navigating to a channel/DM
  useEffect(() => {
    if (activeChannelId) {
      setUnreadCounts((prev) => { const n = { ...prev }; delete n[activeChannelId]; return n; });
    }
    if (activeDmId) {
      setUnreadCounts((prev) => { const n = { ...prev }; delete n[activeDmId]; return n; });
    }
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
          const msg = payload.new as any;
          if (msg.sender_id === currentUserId) return; // own messages don't create badges
          const id: string | null = msg.channel_id || msg.dm_conversation_id || null;
          if (!id) return;
          // Skip if currently viewing this channel/DM
          if (id === activeChannelId || id === activeDmId) return;
          setUnreadCounts((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, [workspaceId, currentUserId, activeChannelId, activeDmId]);

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
              return (
                <li key={ch.id}>
                  <Link
                    href={`/channel?id=${ch.id}`}
                    className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium hover:bg-white/10 transition-colors ${count > 0 ? "text-zinc-100" : "text-zinc-400 hover:text-zinc-100"}`}
                  >
                    <span className="text-zinc-600 font-normal">#</span>
                    <span className="flex-1 truncate">{ch.name}</span>
                    {count > 0 && (
                      <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-500 text-[10px] font-bold text-white flex items-center justify-center leading-none">
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
                return (
                  <li key={dm.id}>
                    <Link
                      href={`/dm?id=${dm.id}`}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded-md text-sm font-medium hover:bg-white/10 transition-colors ${count > 0 ? "text-zinc-100" : "text-zinc-400 hover:text-zinc-100"}`}
                    >
                      <div className={`w-5 h-5 rounded-full border border-white/10 flex items-center justify-center text-[9px] font-semibold shrink-0 overflow-hidden ${
                        isAI
                          ? "bg-gradient-to-br from-indigo-600 to-violet-600 text-white"
                          : "bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-400"
                      }`}>
                        {isAI ? (
                          <Sparkles className="w-2.5 h-2.5" />
                        ) : dm.otherUserAvatar ? (
                          <img src={dm.otherUserAvatar} alt={dm.otherUserName} className="w-full h-full object-cover" />
                        ) : (
                          initials
                        )}
                      </div>
                      <span className="flex-1 truncate">{dm.otherUserName}</span>
                      {count > 0 && (
                        <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-indigo-500 text-[10px] font-bold text-white flex items-center justify-center leading-none">
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

      <div className="p-3 border-t border-white/5 space-y-2">
        <button
          onClick={() => document.dispatchEvent(new KeyboardEvent("keydown", { key: "k", metaKey: true, bubbles: true }))}
          className="w-full flex items-center justify-between px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/5 rounded-lg text-xs font-medium text-zinc-300 transition-colors"
        >
          <span>Search</span>
          <span className="px-1.5 py-0.5 rounded bg-black/40 text-zinc-500 font-mono text-[10px]">⌘K</span>
        </button>
        <button
          onClick={() => setIsMembersOpen(true)}
          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-white/5 rounded-lg text-xs font-medium text-zinc-400 transition-colors"
        >
          <Users className="w-4 h-4" />
          <span>Members</span>
        </button>

        {/* Profile card */}
        {(() => {
          const STATUS_OPTIONS = [
            { value: "active",  label: "Active",  color: "bg-emerald-500" },
            { value: "away",    label: "Away",    color: "bg-amber-500" },
            { value: "busy",    label: "Busy",    color: "bg-red-500" },
            { value: "offline", label: "Offline", color: "bg-zinc-500" },
          ] as const;
          const statusColors: Record<string, string> = { active: "bg-emerald-500", away: "bg-amber-500", busy: "bg-red-500", offline: "bg-zinc-500" };

          return (
            <div className="relative mt-1">
              {/* Status picker popover */}
              {statusPickerOpen && (
                <div className="absolute bottom-full left-0 mb-2 w-44 bg-zinc-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
                  {STATUS_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      onClick={async () => {
                        setStatusPickerOpen(false);
                        const supabase = createClient();
                        await supabase.from("users").update({ status: opt.value }).eq("id", currentUserId);
                        setMyProfile((p) => p ? { ...p, status: opt.value } : p);
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs font-medium transition-colors hover:bg-white/5 ${myProfile?.status === opt.value ? "text-white" : "text-zinc-400"}`}
                    >
                      <span className={`w-2 h-2 rounded-full shrink-0 ${opt.color}`} />
                      {opt.label}
                      {myProfile?.status === opt.value && <span className="ml-auto text-indigo-400">✓</span>}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-1">
                {/* Profile info — click to open status picker */}
                <button
                  onClick={() => setStatusPickerOpen((o) => !o)}
                  className="flex-1 flex items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-white/5 transition-colors"
                >
                  <div className="relative shrink-0">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border border-white/10 flex items-center justify-center text-xs font-semibold text-indigo-300 overflow-hidden">
                      {myProfile?.avatar_url ? (
                        <img src={myProfile.avatar_url} alt={myProfile.full_name ?? ""} className="w-full h-full object-cover" />
                      ) : (
                        (myProfile?.full_name ?? currentUserId).slice(0, 2).toUpperCase()
                      )}
                    </div>
                    <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-zinc-900 ${statusColors[myProfile?.status ?? "offline"] ?? "bg-zinc-500"}`} />
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
                    <div className="absolute bottom-full right-0 mb-2 w-44 bg-zinc-800 border border-white/10 rounded-xl shadow-2xl overflow-hidden z-50">
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
    <div className="flex flex-col h-screen text-zinc-200 overflow-hidden font-sans border border-white/10 shadow-2xl bg-zinc-950 rounded-xl">
      {/* Top Header Bar */}
      <div
        onPointerDown={startWindowDrag}
        className="h-10 w-full shrink-0 border-b border-white/5 bg-zinc-900 flex items-center px-4 select-none cursor-grab active:cursor-grabbing z-50 relative"
      >
        <div className="pl-16 text-[11px] font-medium text-zinc-500 tracking-wide">Tension</div>
        <div className="ml-auto flex items-center gap-1">
          <NotificationBell currentUserId={currentUserId} />
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden relative z-20">
        <aside className="w-64 flex flex-col border-r border-white/5 bg-zinc-900 relative z-20">
          <div className="h-12 flex items-center px-4 border-b border-white/5 shrink-0 select-none">
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
        <main className="flex-1 flex flex-col min-w-0 bg-zinc-950 relative">
          <div className="flex-1 overflow-hidden flex flex-col relative z-20">
            {children}
          </div>
        </main>
      </div>

      <CommandPalette channels={channels} />
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </div>
  );
}
