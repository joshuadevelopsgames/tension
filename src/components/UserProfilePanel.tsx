"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { X, MessageSquare, Clock } from "lucide-react";
import { useRouter } from "next/navigation";

const STATUS_COLORS: Record<string, string> = {
  active:  "bg-emerald-500",
  away:    "bg-amber-500",
  busy:    "bg-red-500",
  offline: "bg-zinc-500",
};

const STATUS_LABELS: Record<string, string> = {
  active:  "Active",
  away:    "Away",
  busy:    "Busy",
  offline: "Offline",
};

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

function getLocalTime(timezone: string | null): string {
  if (!timezone) return "";
  try {
    return new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).format(new Date());
  } catch {
    return "";
  }
}

export function UserProfilePanel({
  userId,
  currentUserId,
  workspaceId,
  onClose,
}: {
  userId: string;
  currentUserId: string | null;
  workspaceId: string | null;
  onClose: () => void;
}) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [localTime, setLocalTime] = useState("");
  const router = useRouter();

  useEffect(() => {
    setLoading(true);
    const supabase = createClient();
    supabase
      .from("users")
      .select("id, full_name, avatar_url, bio, status, status_emoji, status_message, timezone")
      .eq("id", userId)
      .single()
      .then(({ data }) => {
        if (data) {
          setProfile(data as UserProfile);
          setLocalTime(getLocalTime(data.timezone));
        }
        setLoading(false);
      });
  }, [userId]);

  // Refresh local time every minute
  useEffect(() => {
    if (!profile?.timezone) return;
    const t = setInterval(() => setLocalTime(getLocalTime(profile.timezone)), 60000);
    return () => clearInterval(t);
  }, [profile?.timezone]);

  async function handleMessage() {
    if (!currentUserId || !workspaceId || userId === currentUserId) return;
    const supabase = createClient();

    const { data: existing } = await supabase
      .from("dm_participants")
      .select("dm_conversation_id")
      .eq("user_id", currentUserId)
      .in(
        "dm_conversation_id",
        supabase.from("dm_participants").select("dm_conversation_id").eq("user_id", userId) as any
      )
      .limit(1)
      .maybeSingle();

    if (existing?.dm_conversation_id) {
      router.push(`/dm?id=${existing.dm_conversation_id}`);
      onClose();
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
    onClose();
  }

  const name = profile?.full_name || "User";
  const initials = name.slice(0, 2).toUpperCase();
  const isSelf = userId === currentUserId;

  return (
    <div className="w-72 flex flex-col bg-[var(--t-surface)] border-l border-[var(--t-border)] shrink-0">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--t-border)]">
        <span className="text-xs font-semibold text-zinc-400 tracking-wide">Profile</span>
        <button onClick={onClose} className="p-1 rounded hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-5 h-5 rounded-full border-2 border-[var(--t-accent)] border-t-transparent animate-spin" />
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {/* Avatar + name hero */}
          <div className="pb-5 border-b border-[var(--t-border)]">
            {/* Full-width avatar */}
            <div className="relative w-full aspect-square bg-[var(--t-raised)] overflow-hidden">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-6xl font-bold text-zinc-400">{initials}</span>
                </div>
              )}
              {/* Status dot over avatar */}
              {profile?.status && (
                <span className={`absolute bottom-3 right-3 w-4 h-4 rounded-full border-2 border-[var(--t-raised)] ${STATUS_COLORS[profile.status] ?? "bg-zinc-500"}`} />
              )}
            </div>

            <div className="px-5 pt-4">
            <h3 className="text-base font-bold text-white leading-tight">{name}</h3>

            {/* Bio as role badge */}
            {profile?.bio && (
              <span className="inline-block mt-1.5 px-2 py-0.5 rounded-md bg-[var(--t-accent)]/15 border border-[var(--t-accent)]/30 text-[11px] font-semibold text-[var(--t-accent)] tracking-wide">
                {profile.bio}
              </span>
            )}

            {/* Status */}
            <div className="mt-3 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full shrink-0 ${STATUS_COLORS[profile?.status ?? "offline"]}`} />
              <span className="text-xs text-zinc-400">
                {STATUS_LABELS[profile?.status ?? "offline"]}
                {(profile?.status_emoji || profile?.status_message) && (
                  <span className="ml-1 text-zinc-300">
                    {profile?.status_emoji} {profile?.status_message}
                  </span>
                )}
              </span>
            </div>

            {/* Local time */}
            {localTime && (
              <div className="mt-2 flex items-center gap-2 text-xs text-zinc-500">
                <Clock className="w-3 h-3 shrink-0" />
                <span>{localTime} local time</span>
              </div>
            )}
            </div>
          </div>

          {/* Actions */}
          {!isSelf && currentUserId && (
            <div className="px-4 py-4">
              <button
                onClick={handleMessage}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-sm font-semibold transition-colors"
                style={{ background: "var(--t-accent)", color: "#000" }}
              >
                <MessageSquare className="w-4 h-4" />
                Message
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
