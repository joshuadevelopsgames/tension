"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { UpdateChecker } from "@/components/UpdateChecker";
import { startWindowDrag } from "@/lib/tauri";

type DMItem = {
  id: string;
  otherUserId: string;
  otherUserName: string;
  otherUserAvatar: string | null;
};

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [workspaceName, setWorkspaceName] = useState("Workspace");
  const [workspaceSlug, setWorkspaceSlug] = useState("");
  const [workspaceId, setWorkspaceId] = useState("");
  const [currentUserId, setCurrentUserId] = useState("");
  const [channels, setChannels] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [dms, setDMs] = useState<DMItem[]>([]);
  const [hasWorkspace, setHasWorkspace] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const supabase = createClient();
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          router.push("/login");
          return;
        }

        const userId = session.user.id;
        setCurrentUserId(userId);

        const { data: memberships } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", userId)
          .limit(1);

        const wsId = memberships?.[0]?.workspace_id;
        if (!wsId) {
          setHasWorkspace(false);
          setLoading(false);
          return;
        }

        // Load workspace + channels in parallel
        const [wsResult, channelsResult, myDMsResult] = await Promise.all([
          supabase.from("workspaces").select("name, slug").eq("id", wsId).single(),
          supabase.from("channels").select("id, name, slug").eq("workspace_id", wsId).order("name"),
          supabase.from("dm_participants").select("dm_conversation_id").eq("user_id", userId),
        ]);

        if (wsResult.error) throw wsResult.error;
        if (channelsResult.error) throw channelsResult.error;
        if (myDMsResult.error) throw myDMsResult.error;

        setWorkspaceId(wsId);
        if (wsResult.data) {
          setWorkspaceName(wsResult.data.name);
          setWorkspaceSlug(wsResult.data.slug ?? "");
        }
        if (channelsResult.data) setChannels(channelsResult.data);

        // Load DM conversations — get other participants' info
        const myConvIds = (myDMsResult.data ?? []).map((r: any) => r.dm_conversation_id);
        const dmItems: DMItem[] = [];

        if (myConvIds.length > 0) {
          const { data: others, error: othersError } = await supabase
            .from("dm_participants")
            .select("dm_conversation_id, user_id, users(full_name, avatar_url)")
            .in("dm_conversation_id", myConvIds)
            .neq("user_id", userId);

          if (othersError) throw othersError;

          (others ?? []).forEach((row: any) => {
            dmItems.push({
              id: row.dm_conversation_id,
              otherUserId: row.user_id,
              otherUserName: row.users?.full_name ?? `User ${row.user_id.slice(0, 4)}`,
              otherUserAvatar: row.users?.avatar_url ?? null,
            });
          });
        }

        // Ensure a Tension AI DM always exists — auto-create if not
        const TENSION_AI_ID = "00000000-0000-0000-0000-000000000001";
        const hasTensionDM = dmItems.some((d) => d.otherUserId === TENSION_AI_ID);
        if (!hasTensionDM) {
          try {
            const { data: conv, error: convError } = await supabase
              .from("dm_conversations")
              .insert({ workspace_id: wsId })
              .select("id")
              .single();

            if (convError) throw convError;

            if (conv?.id) {
              const { error: partError } = await supabase.from("dm_participants").insert([
                { dm_conversation_id: conv.id, user_id: userId },
                { dm_conversation_id: conv.id, user_id: TENSION_AI_ID },
              ]);
              if (partError) throw partError;

              dmItems.unshift({ 
                id: conv.id, 
                otherUserId: TENSION_AI_ID, 
                otherUserName: "Tension AI", 
                otherUserAvatar: null 
              });
            }
          } catch (err: any) {
            console.error("Failed to auto-create Tension AI DM:", err?.message || err);
            // Fallback: manually push it to the list so user sees it
            dmItems.unshift({ 
               id: "temp-ai-dm", 
               otherUserId: TENSION_AI_ID, 
               otherUserName: "Tension AI", 
               otherUserAvatar: null 
            });
          }
        }

        setDMs(dmItems);
        setLoading(false);
      } catch (error: any) {
        console.error("Fatal error in loadData:", error?.message || error);
        setLoading(false); // Clear loading even on error so user doesn't get stuck
      }
    }

    loadData();
  }, [router]);

  if (loading) {
    return (
      <div className="flex flex-col h-screen text-zinc-500 overflow-hidden font-sans border border-white/10 shadow-2xl bg-zinc-950 rounded-xl text-sm">
        <div
          onPointerDown={startWindowDrag}
          className="h-10 w-full shrink-0 border-b border-white/5 bg-zinc-900 flex items-center px-4 select-none cursor-grab active:cursor-grabbing z-50 relative"
        >
          <div className="pl-16 text-[11px] font-medium text-zinc-500 tracking-wide">Tension</div>
        </div>
        <div className="flex-1 flex items-center justify-center">
          Loading...
        </div>
      </div>
    );
  }

  if (!hasWorkspace) {
    return (
      <div className="flex flex-col h-screen text-zinc-500 overflow-hidden font-sans border border-white/10 shadow-2xl bg-zinc-950 rounded-xl text-sm">
        <div
          onPointerDown={startWindowDrag}
          className="h-10 w-full shrink-0 border-b border-white/5 bg-zinc-900 flex items-center px-4 select-none cursor-grab active:cursor-grabbing z-50 relative"
        >
          <div className="pl-16 text-[11px] font-medium text-zinc-500 tracking-wide">Tension</div>
        </div>
        <div className="flex-1 flex flex-col items-center justify-center">
          <p>No workspace. Run seed or create one.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <AppShell
        workspaceName={workspaceName}
        workspaceSlug={workspaceSlug}
        workspaceId={workspaceId}
        currentUserId={currentUserId}
        channels={channels}
        dms={dms}
      >
        {children}
      </AppShell>
      <UpdateChecker />
    </>
  );
}
