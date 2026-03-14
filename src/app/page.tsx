"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { startWindowDrag } from "@/lib/tauri";

export default function Home() {
  const router = useRouter();

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
        // Fallback if something failed critically with the trigger
        console.error("Workspace auto-provisioning timed out.");
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
    </div>
  );
}
