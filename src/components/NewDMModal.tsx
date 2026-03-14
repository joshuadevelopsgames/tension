"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, X, MessageSquare, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { ModalPortal } from "@/components/ModalPortal";

type WorkspaceMember = {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
};

export function NewDMModal({
  isOpen,
  onClose,
  workspaceId,
  currentUserId,
  onDMCreated,
}: {
  isOpen: boolean;
  onClose: () => void;
  workspaceId: string;
  currentUserId: string;
  onDMCreated: (dm: { id: string; otherUserId: string; otherUserName: string }) => void;
}) {
  const router = useRouter();
  const [members, setMembers] = useState<WorkspaceMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (!isOpen) return;
    async function loadMembers() {
      setLoading(true);
      const supabase = createClient();
      const { data } = await supabase
        .from("workspace_members")
        .select("user_id, users(full_name, avatar_url)")
        .eq("workspace_id", workspaceId)
        .neq("user_id", currentUserId);

      const mapped: WorkspaceMember[] = (data ?? []).map((row: any) => ({
        user_id: row.user_id,
        full_name: row.users?.full_name ?? null,
        avatar_url: row.users?.avatar_url ?? null,
      }));
      setMembers(mapped);
      setLoading(false);
    }
    loadMembers();
    setQuery("");
  }, [isOpen, workspaceId, currentUserId]);

  async function handleSelect(member: WorkspaceMember) {
    if (creating) return;
    setCreating(member.user_id);

    const supabase = createClient();

    // Check if a DM already exists between these two users in this workspace
    const { data: myConvs } = await supabase
      .from("dm_participants")
      .select("dm_conversation_id")
      .eq("user_id", currentUserId);

    const myConvIds = (myConvs ?? []).map((r: any) => r.dm_conversation_id);

    if (myConvIds.length > 0) {
      const { data: existing } = await supabase
        .from("dm_participants")
        .select("dm_conversation_id")
        .eq("user_id", member.user_id)
        .in("dm_conversation_id", myConvIds)
        .limit(1)
        .single();

      if (existing?.dm_conversation_id) {
        // DM already exists — just navigate to it
        setCreating(null);
        onClose();
        router.push(`/dm?id=${existing.dm_conversation_id}`);
        return;
      }
    }

    // Create a new DM conversation
    const { data: conv, error } = await supabase
      .from("dm_conversations")
      .insert({ workspace_id: workspaceId })
      .select("id")
      .single();

    if (error || !conv) {
      setCreating(null);
      return;
    }

    // Add both participants
    await supabase.from("dm_participants").insert([
      { dm_conversation_id: conv.id, user_id: currentUserId },
      { dm_conversation_id: conv.id, user_id: member.user_id },
    ]);

    const displayName = member.full_name || `User ${member.user_id.slice(0, 4)}`;
    onDMCreated({ id: conv.id, otherUserId: member.user_id, otherUserName: displayName });
    setCreating(null);
    onClose();
    router.push(`/dm?id=${conv.id}`);
  }

  const filtered = members.filter((m) =>
    (m.full_name ?? "").toLowerCase().includes(query.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <ModalPortal>
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-sm shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-white/5">
          <h2 className="text-sm font-semibold text-white">New Direct Message</h2>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-md text-zinc-400 hover:text-white transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-3 border-b border-white/5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-zinc-500 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              autoFocus
              placeholder="Search teammates..."
              className="w-full bg-black/20 border border-white/10 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-indigo-500/50 transition-colors"
            />
          </div>
        </div>

        <div className="overflow-y-auto max-h-72">
          {loading ? (
            <div className="p-8 flex justify-center">
              <Loader2 className="w-5 h-5 animate-spin text-zinc-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-6 text-center text-sm text-zinc-600">
              {query ? "No members match your search." : "No other members in this workspace."}
            </div>
          ) : (
            <ul className="p-2 space-y-0.5">
              {filtered.map((m) => {
                const name = m.full_name || `User ${m.user_id.slice(0, 4)}`;
                const initials = name.slice(0, 2).toUpperCase();
                const isCreating = creating === m.user_id;
                return (
                  <li key={m.user_id}>
                    <button
                      onClick={() => handleSelect(m)}
                      disabled={!!creating}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-white/5 text-left transition-colors disabled:opacity-60"
                    >
                      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-indigo-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center text-xs font-semibold text-indigo-300 shrink-0 overflow-hidden">
                        {m.avatar_url ? (
                          <img src={m.avatar_url} alt={name} className="w-full h-full object-cover" />
                        ) : (
                          initials
                        )}
                      </div>
                      <span className="text-sm font-medium text-zinc-200 truncate">{name}</span>
                      {isCreating && <Loader2 className="w-3.5 h-3.5 animate-spin text-zinc-500 ml-auto shrink-0" />}
                      {!isCreating && (
                        <MessageSquare className="w-3.5 h-3.5 text-zinc-600 ml-auto shrink-0 opacity-0 group-hover:opacity-100" />
                      )}
                    </button>
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
