"use client";

import { useEffect, useState } from "react";
import { useTheme } from "@/components/ThemeProvider";
import { THEMES } from "@/lib/themes";
import { createClient } from "@/lib/supabase/client";

function useClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    function tick() {
      setTime(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }
    tick();
    const t = setInterval(tick, 10000);
    return () => clearInterval(t);
  }, []);
  return time;
}

function useRealtimeStatus() {
  const [status, setStatus] = useState<"connecting" | "connected" | "disconnected">("connecting");
  useEffect(() => {
    const supabase = createClient();
    const ch = supabase.channel("statusbar-ping")
      .subscribe((s) => {
        if (s === "SUBSCRIBED") setStatus("connected");
        else if (s === "CLOSED" || s === "CHANNEL_ERROR") setStatus("disconnected");
        else setStatus("connecting");
      });
    return () => { supabase.removeChannel(ch); };
  }, []);
  return status;
}

export function StatusBar({ workspaceName, channelName }: { workspaceName?: string; channelName?: string }) {
  const { theme } = useTheme();
  const time = useClock();
  const realtimeStatus = useRealtimeStatus();

  const statusDot =
    realtimeStatus === "connected"    ? "bg-emerald-500" :
    realtimeStatus === "connecting"   ? "bg-amber-500 animate-pulse" :
                                        "bg-red-500";
  const statusLabel =
    realtimeStatus === "connected"    ? "LIVE" :
    realtimeStatus === "connecting"   ? "CONNECTING" :
                                        "OFFLINE";

  const themeName = THEMES[theme].name.toUpperCase();

  return (
    <div
      className="h-5 shrink-0 flex items-center justify-between px-4 select-none"
      style={{
        background: "var(--t-header)",
        borderTop: "1px solid var(--t-border)",
        fontSize: "10px",
        letterSpacing: "0.06em",
        fontWeight: 500,
      }}
    >
      {/* Left — workspace + channel */}
      <div className="flex items-center gap-3 text-zinc-600">
        {workspaceName && <span>{workspaceName.toUpperCase()}</span>}
        {channelName && (
          <>
            <span className="text-zinc-700">›</span>
            <span className="text-zinc-500">#{channelName.toUpperCase()}</span>
          </>
        )}
      </div>

      {/* Right — status indicators */}
      <div className="flex items-center gap-3 text-zinc-600">
        <span>{themeName}</span>
        <span className="text-zinc-700">|</span>
        <span className="flex items-center gap-1.5">
          <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusDot}`} />
          {statusLabel}
        </span>
        <span className="text-zinc-700">|</span>
        <span>{time}</span>
      </div>
    </div>
  );
}
