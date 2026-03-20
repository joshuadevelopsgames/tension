"use client";

import { useState, useRef, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-500",
  away: "bg-amber-500",
  busy: "bg-red-500",
  offline: "bg-zinc-500",
};

export function UserHoverCard({
  userId,
  displayName,
  currentUserId,
  workspaceId,
  onProfileClick,
  children,
}: {
  userId: string;
  displayName?: string | null;
  currentUserId?: string | null;
  workspaceId?: string | null;
  onProfileClick?: (userId: string) => void;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<{
    full_name: string | null;
    avatar_url: string | null;
    bio: string | null;
    status: string | null;
    status_emoji: string | null;
    status_message: string | null;
  } | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fetchedRef = useRef(false);
  const router = useRouter();
  const supabase = createClient();

  function startOpen() {
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => {
      setOpen(true);
      if (!fetchedRef.current) {
        fetchedRef.current = true;
        supabase
          .from("users")
          .select("full_name, avatar_url, bio, status, status_emoji, status_message")
          .eq("id", userId)
          .single()
          .then(({ data }) => { if (data) setProfile(data); });
      }
    }, 300);
  }

  function startClose() {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    closeTimeoutRef.current = setTimeout(() => setOpen(false), 150);
  }

  useEffect(() => () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
  }, []);

  async function handleClick() {
    if (onProfileClick) { onProfileClick(userId); return; }
    if (!currentUserId || !workspaceId || userId === currentUserId) return;
    const { data: existing } = await supabase
      .from("dm_participants")
      .select("dm_conversation_id")
      .eq("user_id", currentUserId)
      .in("dm_conversation_id",
        supabase.from("dm_participants").select("dm_conversation_id").eq("user_id", userId) as any
      )
      .limit(1)
      .maybeSingle();

    if (existing?.dm_conversation_id) {
      router.push(`/dm?id=${existing.dm_conversation_id}`);
      return;
    }

    const { data: conv } = await supabase
      .from("dm_conversations")
      .insert({ workspace_id: workspaceId })
      .select("id")
      .single();
    if (!conv) return;
    await supabase.from("dm_participants").insert([
      { dm_conversation_id: conv.id, user_id: currentUserId },
      { dm_conversation_id: conv.id, user_id: userId },
    ]);
    router.push(`/dm?id=${conv.id}`);
  }

  const name = profile?.full_name || displayName || `User`;
  const isSelf = userId === currentUserId;

  return (
    <span className="relative inline-block" onMouseEnter={startOpen} onMouseLeave={startClose}>
      <button
        type="button"
        onClick={handleClick}
        className={`text-[13px] font-semibold text-zinc-200 hover:text-white hover:underline underline-offset-2 transition-colors ${!isSelf ? "cursor-pointer" : "cursor-default"}`}
      >
        {children}
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-1.5 z-[9999] w-56 bg-zinc-800 border border-white/10 rounded-xl shadow-2xl p-3 pointer-events-none"
          onMouseEnter={startOpen}
          onMouseLeave={startClose}
        >
          <div className="flex items-center gap-2.5">
            <div className="relative shrink-0">
              <div className="w-9 h-9 rounded-full bg-zinc-700 flex items-center justify-center overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-sm font-semibold text-zinc-400">{name.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              {profile?.status && (
                <span className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-zinc-800 ${STATUS_COLORS[profile.status] ?? "bg-zinc-500"}`} />
              )}
            </div>
            <div className="min-w-0">
              <p className="text-[13px] font-semibold text-zinc-100 truncate">{name}</p>
              {(profile?.status_emoji || profile?.status_message) && (
                <p className="text-[11px] text-zinc-400 truncate">
                  {profile.status_emoji} {profile.status_message}
                </p>
              )}
              {!profile?.status_message && profile?.bio && (
                <p className="text-[11px] text-zinc-500 truncate">{profile.bio}</p>
              )}
            </div>
          </div>
        </div>
      )}
    </span>
  );
}
