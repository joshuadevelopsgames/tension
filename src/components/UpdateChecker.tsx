"use client";

import { useEffect, useState } from "react";
import { isTauri } from "@/lib/tauri";
import { Download, X } from "lucide-react";

export function UpdateChecker() {
  const [update, setUpdate] = useState<any>(null);
  const [dismissed, setDismissed] = useState(false);
  const [installing, setInstalling] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;

    // Check for updates 4 seconds after launch so it doesn't block the UI
    const t = setTimeout(async () => {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const result = await check();
        if (result?.available) setUpdate(result);
      } catch {
        // Updater not configured yet or no internet — silently ignore
      }
    }, 4000);

    return () => clearTimeout(t);
  }, []);

  if (!update || dismissed) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[300] bg-zinc-800 border border-white/10 rounded-2xl px-4 py-3 shadow-2xl flex items-center gap-3 max-w-sm">
      <Download className="w-4 h-4 text-indigo-400 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-zinc-100">Update available — v{update.version}</p>
        <p className="text-[11px] text-zinc-500 mt-0.5">Restart to install the latest version.</p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <button
          onClick={async () => {
            setInstalling(true);
            try {
              await update.downloadAndInstall();
              const { relaunch } = await import("@tauri-apps/plugin-process");
              await relaunch();
            } catch {
              setInstalling(false);
            }
          }}
          disabled={installing}
          className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-[11px] disabled:opacity-50 transition-colors whitespace-nowrap"
        >
          {installing ? "Installing…" : "Update"}
        </button>
        <button
          onClick={() => setDismissed(true)}
          className="p-1 rounded-lg hover:bg-white/10 text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
