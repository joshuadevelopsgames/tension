import { useEffect, useRef } from "react";
import { isTauri } from "@/lib/tauri";
import { toast } from "sonner";
import { Download, Sparkles } from "lucide-react";

export function UpdateChecker() {
  const updateFoundRef = useRef(false);

  useEffect(() => {
    if (!isTauri() || updateFoundRef.current) return;

    // Check for updates 4 seconds after launch
    const t = setTimeout(async () => {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const result = await check();
        
        if (result?.available && !updateFoundRef.current) {
          updateFoundRef.current = true;
          
          toast.custom((t) => (
            <div className="flex flex-col gap-3 bg-zinc-900 border border-white/10 p-4 rounded-xl shadow-2xl min-w-[320px] animate-in fade-in slide-in-from-bottom-4 duration-300">
              <div className="flex gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
                  <Download className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-zinc-100 flex items-center gap-2">
                    New Update Available
                    <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded-full uppercase tracking-tighter">v{result.version}</span>
                  </h3>
                  <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed">
                    A newer version of Tension is ready. Refresh now to get the latest features!
                  </p>
                </div>
              </div>
              
              <div className="flex gap-2 mt-1">
                <button
                  onClick={async () => {
                    toast.dismiss(t);
                    const toastId = toast.loading("Downloading update...", {
                      description: "Tension will restart once the update is ready.",
                    });
                    
                    try {
                      await result.downloadAndInstall();
                      toast.success("Update installed!", { id: toastId });
                      const { relaunch } = await import("@tauri-apps/plugin-process");
                      await relaunch();
                    } catch (err) {
                      toast.error("Update failed. Please try again later.", { id: toastId });
                    }
                  }}
                  className="flex-1 bg-white text-zinc-950 px-3 py-2 rounded-lg text-xs font-bold hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Update Now
                </button>
                <button
                  onClick={() => toast.dismiss(t)}
                  className="px-3 py-2 rounded-lg bg-white/5 text-zinc-400 hover:bg-white/10 hover:text-zinc-200 text-xs font-medium transition-colors"
                >
                  Later
                </button>
              </div>
            </div>
          ), {
            duration: Infinity, // Keep it visible until action or close
            id: "app-update-found",
          });
        }
      } catch (err: any) {
        // Silently ignore "valid release JSON" errors — they just mean no releases exist yet
        if (!err?.toString().includes("valid release JSON")) {
          console.error("Update check failed:", err);
        }
      }
    }, 4000);

    return () => clearTimeout(t);
  }, []);

  return null;
}
