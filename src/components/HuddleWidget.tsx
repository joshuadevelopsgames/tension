"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import {
  LiveKitRoom,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  useTracks,
  useParticipants,
  useLocalParticipant,
  useConnectionState,
  useRoomContext,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track, ConnectionState } from "livekit-client";
import {
  Maximize2, Minimize2, Mic, MicOff, Video, VideoOff,
  PhoneOff, Phone, PhoneIncoming, Users, Loader2,
} from "lucide-react";
import { useHuddle } from "@/context/HuddleContext";

// ── Controls bar (used in both PiP and expanded views) ──────────────────────
function Controls({
  onEnd,
  onToggleSize,
  isExpanded,
}: {
  onEnd: () => void;
  onToggleSize: () => void;
  isExpanded: boolean;
}) {
  const { localParticipant } = useLocalParticipant();
  const [micOn, setMicOn] = useState(false);
  const [camOn, setCamOn] = useState(false);

  // Sync initial state from participant once available
  useEffect(() => {
    if (!localParticipant) return;
    setMicOn(localParticipant.isMicrophoneEnabled);
    setCamOn(localParticipant.isCameraEnabled);

    const handler = () => {
      setMicOn(localParticipant.isMicrophoneEnabled);
      setCamOn(localParticipant.isCameraEnabled);
    };
    localParticipant.on("trackMuted", handler);
    localParticipant.on("trackUnmuted", handler);
    localParticipant.on("trackPublished", handler);
    return () => {
      localParticipant.off("trackMuted", handler);
      localParticipant.off("trackUnmuted", handler);
      localParticipant.off("trackPublished", handler);
    };
  }, [localParticipant]);

  async function toggleMic() {
    await localParticipant.setMicrophoneEnabled(!micOn);
    setMicOn(!micOn);
  }

  async function toggleCam() {
    await localParticipant.setCameraEnabled(!camOn);
    setCamOn(!camOn);
  }

  return (
    <div
      className="flex items-center gap-1.5 px-3 py-2 shrink-0"
      style={{ borderTop: "1px solid var(--t-border)", background: "var(--t-sidebar)" }}
    >
      <button
        onClick={toggleMic}
        title={micOn ? "Mute" : "Unmute"}
        className="p-2 rounded-xl transition-colors text-sm font-medium flex items-center gap-1.5"
        style={{
          background: micOn ? "var(--t-raised)" : "rgba(239,68,68,0.2)",
          color: micOn ? "var(--t-fg-2)" : "#f87171",
        }}
      >
        {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
      </button>

      <button
        onClick={toggleCam}
        title={camOn ? "Camera off" : "Camera on"}
        className="p-2 rounded-xl transition-colors"
        style={{
          background: camOn ? "var(--t-raised)" : "rgba(239,68,68,0.2)",
          color: camOn ? "var(--t-fg-2)" : "#f87171",
        }}
      >
        {camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
      </button>

      <button
        onClick={onToggleSize}
        title={isExpanded ? "Minimise" : "Expand"}
        className="p-2 rounded-xl transition-colors"
        style={{ background: "var(--t-raised)", color: "var(--t-fg-2)" }}
      >
        {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
      </button>

      <button
        onClick={onEnd}
        title="Leave session"
        className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors"
        style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}
      >
        <PhoneOff className="w-3.5 h-3.5" />
        {isExpanded ? "Leave" : ""}
      </button>
    </div>
  );
}

// ── Video grid ───────────────────────────────────────────────────────────────
function VideoGrid({ compact }: { compact?: boolean }) {
  const tracks = useTracks(
    [
      { source: Track.Source.Camera, withPlaceholder: true },
      { source: Track.Source.ScreenShare, withPlaceholder: false },
    ],
    { onlySubscribed: false }
  );
  const participants = useParticipants();

  return (
    <div className="flex-1 min-h-0 relative overflow-hidden" style={{ background: "#000" }}>
      {tracks.length > 0 ? (
        <GridLayout tracks={tracks} style={{ height: "100%", width: "100%" }}>
          <ParticipantTile />
        </GridLayout>
      ) : (
        <div className="h-full flex flex-col items-center justify-center gap-2">
          <Users className="w-8 h-8 opacity-30" style={{ color: "var(--t-accent)" }} />
          <p className="text-xs" style={{ color: "var(--t-fg-3)" }}>
            Connecting…
          </p>
        </div>
      )}

      {/* Participant pill */}
      {participants.length > 0 && (
        <div
          className="absolute top-2 left-2 flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold"
          style={{ background: "rgba(0,0,0,0.6)", color: "#fff", backdropFilter: "blur(4px)" }}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          {participants.length} in session
        </div>
      )}
    </div>
  );
}

// ── Inner component — needs to be inside <LiveKitRoom> ───────────────────────
function SessionInner({
  isMinimized,
  onToggleSize,
  onEnd,
}: {
  isMinimized: boolean;
  onToggleSize: () => void;
  onEnd: () => void;
}) {
  const connectionState = useConnectionState();
  const isConnecting = connectionState === ConnectionState.Connecting || connectionState === ConnectionState.Reconnecting;

  const dragRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const startPos = useRef({ mx: 0, my: 0, ex: 0, ey: 0 });

  useEffect(() => {
    if (!isMinimized) {
      posRef.current = { x: 0, y: 0 };
      return;
    }
    const el = dragRef.current;
    if (!el) return;
    const pw = window.innerWidth;
    const ph = window.innerHeight;
    posRef.current = { x: pw - 280 - 16, y: ph - 240 - 16 };
    el.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
  }, [isMinimized]);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button")) return;
    dragging.current = true;
    startPos.current = { mx: e.clientX, my: e.clientY, ex: posRef.current.x, ey: posRef.current.y };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);

  function onMouseMove(e: MouseEvent) {
    if (!dragging.current || !dragRef.current) return;
    posRef.current = {
      x: startPos.current.ex + e.clientX - startPos.current.mx,
      y: startPos.current.ey + e.clientY - startPos.current.my,
    };
    dragRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
  }

  function onMouseUp() {
    dragging.current = false;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }

  // ── Header shared between both modes ──────────────────────────────────────
  const Header = (
    <div
      className="flex items-center gap-2 px-3 py-2 shrink-0"
      style={{ background: "var(--t-header)", borderBottom: "1px solid var(--t-border)" }}
    >
      {isConnecting ? (
        <Loader2 className="w-3 h-3 animate-spin" style={{ color: "var(--t-accent)" }} />
      ) : (
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
      )}
      <span className="text-[11px] font-semibold tracking-wide flex-1" style={{ color: "var(--t-accent)" }}>
        {isConnecting ? "Connecting…" : "SESSION"}
      </span>
    </div>
  );

  // Portal to document.body so `position:fixed` is always viewport-relative.
  // A parent with `transform` (PiP drag) creates a containing block and would
  // trap the “fullscreen” overlay in the corner after toggling PiP off.
  const ui = isMinimized ? (
    <div
      key="pip"
      ref={dragRef}
      onMouseDown={onMouseDown}
      className="fixed top-0 left-0 z-[9000] flex flex-col rounded-2xl overflow-hidden select-none cursor-grab active:cursor-grabbing"
      style={{
        width: 280,
        height: 240,
        background: "var(--t-raised)",
        border: "1px solid var(--t-border)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.7)",
      }}
    >
      {Header}
      <VideoGrid compact />
      <Controls onEnd={onEnd} onToggleSize={onToggleSize} isExpanded={false} />
    </div>
  ) : (
    <div
      key="full"
      className="fixed inset-0 z-[9000] flex flex-col"
      style={{ background: "var(--t-surface)" }}
    >
      {Header}
      <VideoGrid />
      <Controls onEnd={onEnd} onToggleSize={onToggleSize} isExpanded />
    </div>
  );

  return createPortal(ui, document.body);
}

// ── Root export — renders nothing when no active call ────────────────────────
function IncomingCallBanner() {
  const { incomingInvite, acceptIncomingInvite, dismissIncomingInvite } = useHuddle();
  if (!incomingInvite) return null;

  return createPortal(
    <div
      className="fixed bottom-6 right-6 z-[9999] flex items-center gap-3 px-4 py-3 rounded-2xl shadow-2xl animate-pop-in"
      style={{ background: "var(--t-raised)", border: "1px solid var(--t-border)", minWidth: 260 }}
    >
      <div className="flex items-center justify-center w-9 h-9 rounded-full flex-shrink-0" style={{ background: "color-mix(in srgb, var(--t-accent) 15%, transparent)" }}>
        <PhoneIncoming className="w-4 h-4" style={{ color: "var(--t-accent)" }} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold truncate" style={{ color: "var(--t-fg)" }}>{incomingInvite.fromName}</p>
        <p className="text-[11px]" style={{ color: "var(--t-fg-2)" }}>Inviting you to a session</p>
      </div>
      <button
        onClick={acceptIncomingInvite}
        className="flex items-center justify-center w-8 h-8 rounded-full transition-opacity hover:opacity-80"
        style={{ background: "var(--t-accent)" }}
        title="Accept"
      >
        <Phone className="w-3.5 h-3.5 text-white" />
      </button>
      <button
        onClick={dismissIncomingInvite}
        className="flex items-center justify-center w-8 h-8 rounded-full transition-colors hover:bg-white/10"
        style={{ color: "var(--t-fg-2)" }}
        title="Dismiss"
      >
        <PhoneOff className="w-3.5 h-3.5" />
      </button>
    </div>,
    document.body
  );
}

export function HuddleWidget() {
  const { roomName, token, isMinimized, endHuddle, toggleMinimize } = useHuddle();

  const roomHostClass = isMinimized
    ? "!fixed !top-0 !left-0 !h-0 !min-h-0 !w-0 !min-w-0 overflow-hidden pointer-events-none border-0 p-0 m-0"
    : undefined;

  return (
    <>
      <IncomingCallBanner />
      {roomName && token && (
        <LiveKitRoom
          className={roomHostClass}
          serverUrl={process.env.NEXT_PUBLIC_LIVEKIT_URL!}
          token={token}
          connect={true}
          audio={true}
          video={false}
          onDisconnected={endHuddle}
          onError={(err) => console.error("LiveKit error:", err)}
        >
          <RoomAudioRenderer />
          <SessionInner
            isMinimized={isMinimized}
            onToggleSize={toggleMinimize}
            onEnd={endHuddle}
          />
        </LiveKitRoom>
      )}
    </>
  );
}
