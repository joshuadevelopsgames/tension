"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { X, Copy, Check, Loader2, ChevronDown, UserMinus } from "lucide-react";
import { ModalPortal } from "@/components/ModalPortal";

type Member = {
  id: string; // workspace_members.id
  user_id: string;
  role: "owner" | "admin" | "member";
  full_name: string | null;
  avatar_url: string | null;
};

const ROLES = ["owner", "admin", "member"] as const;

export function WorkspaceMembersModal({
  isOpen,
  onClose,
  workspaceId,
  workspaceSlug,
  currentUserId,
}: {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  workspaceSlug: string;
  currentUserId: string;
}) {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState<string>("member");
  const [copied, setCopied] = useState(false);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const supabase = createClient();

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || (typeof window !== "undefined" ? window.location.origin : "");
  const inviteLink = `${baseUrl}/join?workspace=${workspaceSlug}`;

  useEffect(() => {
    if (!isOpen) return;
    async function load() {
      setLoading(true);
      const { data } = await supabase
        .from("workspace_members")
        .select("id, user_id, role, users(full_name, avatar_url)")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });

      const mapped: Member[] = (data ?? []).map((row: any) => ({
        id: row.id,
        user_id: row.user_id,
        role: row.role,
        full_name: row.users?.full_name ?? null,
        avatar_url: row.users?.avatar_url ?? null,
      }));
      setMembers(mapped);

      const myEntry = mapped.find((m) => m.user_id === currentUserId);
      setCurrentUserRole(myEntry?.role ?? "member");
      setLoading(false);
    }
    load();
  }, [isOpen, workspaceId, currentUserId, supabase]);

  async function changeRole(memberId: string, newRole: "owner" | "admin" | "member") {
    await supabase.from("workspace_members").update({ role: newRole }).eq("id", memberId);
    setMembers((prev) => prev.map((m) => m.id === memberId ? { ...m, role: newRole } : m));
  }

  async function removeMember(memberId: string) {
    await supabase.from("workspace_members").delete().eq("id", memberId);
    setMembers((prev) => prev.filter((m) => m.id !== memberId));
    setConfirmRemoveId(null);
  }

  function copyInviteLink() {
    navigator.clipboard.writeText(inviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  const canManageRoles = currentUserRole === "owner" || currentUserRole === "admin";

  if (!isOpen) return null;

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">Workspace Members</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-md text-zinc-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Invite link */}
        <div className="p-4 border-b border-white/5">
          <p className="text-[11px] font-semibold text-zinc-400 uppercase tracking-wider mb-2">Invite Link</p>
          <div className="flex items-center gap-2 bg-black/20 border border-white/10 rounded-lg px-3 py-2">
            <span className="flex-1 text-xs text-zinc-400 font-mono truncate">{inviteLink}</span>
            <button
              onClick={copyInviteLink}
              className="shrink-0 p-1 rounded hover:bg-white/10 text-zinc-400 hover:text-zinc-200 transition-colors"
              title="Copy invite link"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
          <p className="text-[11px] text-zinc-600 mt-1.5">Share this link so teammates can join.</p>
        </div>

        {/* Member list */}
        <div className="overflow-y-auto max-h-80">
          {loading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
            </div>
          ) : (
            <ul className="p-3 space-y-1">
              {members.map((m) => {
                const name = m.full_name || `User ${m.user_id.slice(0, 4)}`;
                const initials = name.slice(0, 2).toUpperCase();
                const isCurrentUser = m.user_id === currentUserId;
                return (
                  <li key={m.id} className="flex items-center gap-3 px-2 py-2 rounded-lg hover:bg-white/5">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-xs font-semibold text-indigo-300 shrink-0 overflow-hidden">
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt={name} className="w-full h-full object-cover" />
                      ) : initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-200 truncate">
                        {name} {isCurrentUser && <span className="text-zinc-500 text-xs">(you)</span>}
                      </p>
                    </div>
                    {canManageRoles && !isCurrentUser ? (
                      <div className="flex items-center gap-1.5">
                        <div className="relative">
                          <select
                            value={m.role}
                            onChange={(e) => changeRole(m.id, e.target.value as any)}
                            className="appearance-none bg-black/30 border border-white/10 rounded-md pl-2 pr-6 py-1 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500/50 cursor-pointer"
                          >
                            {ROLES.map((r) => (
                              <option key={r} value={r}>{r}</option>
                            ))}
                          </select>
                          <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-500 pointer-events-none" />
                        </div>
                        {m.role !== "owner" && (
                          confirmRemoveId === m.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => removeMember(m.id)}
                                className="px-2 py-1 bg-red-600 hover:bg-red-500 text-white text-[10px] font-medium rounded transition-colors"
                              >
                                Remove
                              </button>
                              <button
                                onClick={() => setConfirmRemoveId(null)}
                                className="px-2 py-1 bg-zinc-700 hover:bg-zinc-600 text-zinc-300 text-[10px] font-medium rounded transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setConfirmRemoveId(m.id)}
                              className="p-1 rounded hover:bg-red-500/20 text-zinc-600 hover:text-red-400 transition-colors"
                              title="Remove from workspace"
                            >
                              <UserMinus className="w-3.5 h-3.5" />
                            </button>
                          )
                        )}
                      </div>
                    ) : (
                      <span className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${
                        m.role === "owner" ? "bg-amber-500/15 text-amber-400" :
                        m.role === "admin" ? "bg-indigo-500/15 text-indigo-400" :
                        "bg-zinc-800 text-zinc-500"
                      }`}>
                        {m.role}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
    </ModalPortal>
  );
}
