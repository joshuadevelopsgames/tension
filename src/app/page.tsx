"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { startWindowDrag } from "@/lib/tauri";

export default function Home() {
  const router = useRouter();
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    async function redirectCorrectly() {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/login");
        return;
      }

      // Retry loop to handle the split-second delay of Postgres triggers creating the default workspace
      let retries = 0;
      let targetChannelId = null;

      while (retries < 5 && !targetChannelId) {
        const { data: memberships } = await supabase
          .from("workspace_members")
          .select("workspace_id")
          .eq("user_id", session.user.id)
          .limit(1);

        const workspaceId = memberships?.[0]?.workspace_id;

        if (workspaceId) {
          const { data: channel } = await supabase
            .from("channels")
            .select("id")
            .eq("workspace_id", workspaceId)
            .limit(1);

          if (channel?.[0]?.id) {
            targetChannelId = channel[0].id;
            break;
          }
        }

        // Wait 400ms before checking again if trigger hasn't finished yet
        await new Promise((r) => setTimeout(r, 400));
        retries++;
      }

      if (targetChannelId) {
        router.replace(`/channel?id=${targetChannelId}`);
      } else {
        console.error("Workspace auto-provisioning timed out.");
        setTimedOut(true);
      }
    }
    redirectCorrectly();
  }, [router]);

  return (
    <div className="flex h-screen text-zinc-500 overflow-hidden font-sans border border-white/10 shadow-2xl bg-zinc-950 rounded-xl items-center justify-center">
      <div
        onPointerDown={startWindowDrag}
        className="absolute top-0 left-0 right-0 h-10 w-full z-10 select-none cursor-grab active:cursor-grabbing"
      />
      {timedOut && (
        <div className="text-center px-6">
          <p className="text-zinc-300 text-sm font-medium mb-1">Something went wrong</p>
          <p className="text-zinc-600 text-xs mb-4">Workspace setup timed out. Try refreshing.</p>
          <button
            onClick={() => { setTimedOut(false); router.refresh(); }}
            className="text-xs px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-md text-zinc-400 hover:text-zinc-200 transition-colors"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}
