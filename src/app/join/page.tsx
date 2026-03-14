"use client";

import { useEffect, useState, Suspense } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function JoinContent() {
  const searchParams = useSearchParams();
  const workspaceSlug = searchParams.get("workspace");
  const router = useRouter();
  const [status, setStatus] = useState<"loading" | "joining" | "error" | "success">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!workspaceSlug) {
      setStatus("error");
      setMessage("Invalid invite link — no workspace specified.");
      return;
    }

    async function join() {
      setStatus("joining");
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push(`/login?next=/join?workspace=${workspaceSlug}`);
        return;
      }

      // Find workspace by slug
      const { data: workspace } = await supabase
        .from("workspaces")
        .select("id, name")
        .eq("slug", workspaceSlug)
        .single();

      if (!workspace) {
        setStatus("error");
        setMessage("Workspace not found. The invite link may be invalid or expired.");
        return;
      }

      // Check if already a member
      const { data: existing } = await supabase
        .from("workspace_members")
        .select("id")
        .eq("workspace_id", workspace.id)
        .eq("user_id", user.id)
        .single();

      if (existing) {
        setStatus("success");
        setMessage(`You're already in ${workspace.name}. Redirecting…`);
        setTimeout(() => router.push("/"), 1500);
        return;
      }

      // Join
      const { error } = await supabase.from("workspace_members").insert({
        workspace_id: workspace.id,
        user_id: user.id,
        role: "member",
      });

      if (error) {
        setStatus("error");
        setMessage("Failed to join workspace. Please try again.");
        return;
      }

      setStatus("success");
      setMessage(`Welcome to ${workspace.name}! Redirecting…`);
      setTimeout(() => router.push("/"), 1500);
    }

    join();
  }, [workspaceSlug, router]);

  return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center p-6">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-8 max-w-sm w-full text-center shadow-2xl">
        {status === "loading" || status === "joining" ? (
          <>
            <Loader2 className="w-8 h-8 animate-spin text-indigo-400 mx-auto mb-4" />
            <p className="text-zinc-300 text-sm">{status === "joining" ? "Joining workspace…" : "Loading…"}</p>
          </>
        ) : status === "success" ? (
          <>
            <div className="w-12 h-12 rounded-full bg-green-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-green-400 text-2xl">✓</span>
            </div>
            <p className="text-zinc-200 text-sm font-medium">{message}</p>
          </>
        ) : (
          <>
            <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
              <span className="text-red-400 text-2xl">✕</span>
            </div>
            <p className="text-zinc-200 text-sm font-medium mb-4">{message}</p>
            <button
              onClick={() => router.push("/")}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
            >
              Go Home
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function JoinPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
      </div>
    }>
      <JoinContent />
    </Suspense>
  );
}
