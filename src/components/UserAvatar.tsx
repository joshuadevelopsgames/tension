"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { MessageSquare, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { STATUS_COLORS } from "@/lib/constants";
import { displayName as formatDisplayName } from "@/lib/utils";

type UserProfile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  status: string | null;
  status_emoji: string | null;
  status_message: string | null;
  timezone: string | null;
};

export function UserAvatar({
  userId,
  displayName,
  avatarUrl,
  size = "md",
  showStatus = false,
  workspaceId,
  currentUserId,
}: {
  userId: string;
  displayName?: string;
  avatarUrl?: string | null;
  size?: "sm" | "md" | "lg";
  showStatus?: boolean;
  workspaceId?: string;
  currentUserId?: string;
}) {
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const supabase = createBrowserClient();

  const initials = (displayName || userId).slice(0, 2).toUpperCase();

  const sizeClasses = {
    sm: "w-5 h-5 text-[9px]",
    md: "w-8 h-8 text-xs",
    lg: "w-12 h-12 text-base",
  };

  async function handleClick() {
    setOpen((o) => !o);
    if (!profile && !loading) {
      setLoading(true);
      const { data } = await supabase
        .from("users")
        .select("id, full_name, avatar_url, bio, status, status_emoji, status_message, timezone")
        .eq("id", userId)
        .single();
      setProfile(data ?? null);
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  async function startDM() {
    if (!workspaceId || !currentUserId || currentUserId === userId) return;
    const supabase = createBrowserClient();

    const { data: myConvs } = await supabase.from("dm_participants").select("dm_conversation_id").eq("user_id", currentUserId);
    const myIds = (myConvs ?? []).map((r: any) => r.dm_conversation_id);

    if (myIds.length > 0) {
      const { data: existing } = await supabase.from("dm_participants")
        .select("dm_conversation_id").eq("user_id", userId).in("dm_conversation_id", myIds).limit(1).single();
      if (existing?.dm_conversation_id) {
        setOpen(false);
        router.push(`/dm?id=${existing.dm_conversation_id}`);
        return;
      }
    }

    const { data: conv } = await supabase.from("dm_conversations").insert({ workspace_id: workspaceId }).select("id").single();
    if (!conv) return;
    await supabase.from("dm_participants").insert([
      { dm_conversation_id: conv.id, user_id: currentUserId },
      { dm_conversation_id: conv.id, user_id: userId },
    ]);
    setOpen(false);
    router.push(`/dm?id=${conv.id}`);
  }

  const statusColor = profile?.status ? STATUS_COLORS[profile.status] ?? "bg-zinc-500" : null;

  return (
    <div className="relative inline-block" ref={popoverRef}>
      <button
        onClick={handleClick}
        className={`${sizeClasses[size]} rounded-full shrink-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center font-semibold text-indigo-300 select-none overflow-hidden hover:border-indigo-500/40 transition-colors relative`}
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt={displayName} className="w-full h-full object-cover" />
        ) : initials}
        {showStatus && statusColor && (
          <span className={`absolute bottom-0 right-0 w-2 h-2 rounded-full border border-zinc-900 ${statusColor}`} />
        )}
      </button>

      {open && (
        <div className="absolute left-full top-0 ml-2 w-64 bg-zinc-900 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden">
          {/* Cover / header */}
          <div className="h-16 bg-gradient-to-br from-indigo-900/40 to-purple-900/40 relative">
            <button
              onClick={() => setOpen(false)}
              className="absolute top-2 right-2 p-1 rounded hover:bg-black/20 text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Avatar (overlapping) */}
          <div className="px-4 pb-4 -mt-8 relative">
            <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500/30 to-purple-500/30 border-2 border-zinc-900 flex items-center justify-center text-xl font-semibold text-indigo-300 overflow-hidden mb-3">
              {(profile?.avatar_url || avatarUrl) ? (
                <img src={profile?.avatar_url ?? avatarUrl ?? ""} alt={profile?.full_name ?? displayName} className="w-full h-full object-cover" />
              ) : (initials)}
            </div>

            {loading ? (
              <p className="text-xs text-zinc-500">Loading…</p>
            ) : (
              <>
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-semibold text-zinc-100">{formatDisplayName(profile ?? { id: userId, full_name: displayName ?? null })}</p>
                  {profile?.status && (
                    <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[profile.status] ?? "bg-zinc-500"}`} title={profile.status} />
                  )}
                </div>

                {/* Custom status message */}
                {(profile?.status_emoji || profile?.status_message) && (
                  <p className="text-xs text-zinc-400 mb-1">
                    {profile.status_emoji} {profile.status_message}
                  </p>
                )}

                {/* Local time */}
                {profile?.timezone && (() => {
                  try {
                    const localTime = new Date().toLocaleTimeString([], {
                      hour: "2-digit", minute: "2-digit",
                      timeZone: profile.timezone,
                    });
                    return (
                      <p className="text-[11px] text-zinc-500 mb-1.5 flex items-center gap-1">
                        <span>🕐</span> {localTime} local time
                      </p>
                    );
                  } catch { return null; }
                })()}

                {profile?.bio && <p className="text-xs text-zinc-400 mt-0.5 mb-2">{profile.bio}</p>}
                {workspaceId && currentUserId && currentUserId !== userId && (
                  <button
                    onClick={startDM}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-medium rounded-lg transition-colors mt-2"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    Message
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
