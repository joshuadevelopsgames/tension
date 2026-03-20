"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { Loader2, MessageSquare, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/Modal";
import { displayName } from "@/lib/utils";

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

    // Find or create DM conversation
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
        setCreating(null);
        onClose();
        router.push(`/dm?id=${existing.dm_conversation_id}`);
        return;
      }
    }

    const { data: conv, error } = await supabase
      .from("dm_conversations")
      .insert({ workspace_id: workspaceId })
      .select("id")
      .single();

    if (error || !conv) {
      setCreating(null);
      return;
    }

    await supabase.from("dm_participants").insert([
      { dm_conversation_id: conv.id, user_id: currentUserId },
      { dm_conversation_id: conv.id, user_id: member.user_id },
    ]);

    const name = displayName(member);
    onDMCreated({ id: conv.id, otherUserId: member.user_id, otherUserName: name });
    setCreating(null);
    onClose();
    router.push(`/dm?id=${conv.id}`);
  }

  const filtered = members.filter((m) =>
    displayName(m).toLowerCase().includes(query.toLowerCase())
  );

  if (!isOpen) return null;

  return (
    <Modal title="New Direct Message" onClose={onClose}>
      {/* Search */}
      <div className="p-3" style={{ borderBottom: "1px solid var(--t-border)" }}>
        <div className="relative">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
            style={{ color: "var(--t-fg-3)" }}
          />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            autoFocus
            placeholder="Search teammates…"
            className="w-full rounded-lg pl-8 pr-3 py-2 text-sm focus:outline-none transition-colors"
            style={{
              background: "var(--t-surface)",
              border: "1px solid var(--t-border)",
              color: "var(--t-fg)",
            }}
          />
        </div>
      </div>

      {/* Member list */}
      <div className="overflow-y-auto max-h-72">
        {loading ? (
          <div className="p-8 flex justify-center">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: "var(--t-fg-3)" }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="p-6 text-center text-sm" style={{ color: "var(--t-fg-3)" }}>
            {query ? "No members match your search." : "No other members in this workspace."}
          </div>
        ) : (
          <ul className="p-2 space-y-0.5">
            {filtered.map((m) => {
              const name = displayName(m);
              const initials = name.slice(0, 2).toUpperCase();
              const isCreating = creating === m.user_id;
              return (
                <li key={m.user_id}>
                  <button
                    onClick={() => handleSelect(m)}
                    disabled={!!creating}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors disabled:opacity-60 hover:bg-white/5"
                  >
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 overflow-hidden"
                      style={{
                        background: "color-mix(in srgb, var(--t-accent) 15%, transparent)",
                        color: "var(--t-accent)",
                        border: "1px solid var(--t-border)",
                      }}
                    >
                      {m.avatar_url ? (
                        <img src={m.avatar_url} alt={name} className="w-full h-full object-cover" />
                      ) : (
                        initials
                      )}
                    </div>
                    <span className="text-sm font-medium truncate" style={{ color: "var(--t-fg)" }}>
                      {name}
                    </span>
                    {isCreating ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin ml-auto shrink-0" style={{ color: "var(--t-fg-3)" }} />
                    ) : (
                      <MessageSquare className="w-3.5 h-3.5 ml-auto shrink-0 opacity-0 group-hover:opacity-100" style={{ color: "var(--t-fg-3)" }} />
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
