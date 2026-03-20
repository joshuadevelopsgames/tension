"use client";

import { useEffect, useRef, useState } from "react";
import {
  LiveKitRoom,
  VideoConference,
  GridLayout,
  ParticipantTile,
  RoomAudioRenderer,
  ControlBar,
  useTracks,
  useParticipants,
  useLocalParticipant,
} from "@livekit/components-react";
import "@livekit/components-styles";
import { Track } from "livekit-client";
import { Maximize2, Minimize2, Mic, MicOff, Video, VideoOff, PhoneOff, Users } from "lucide-react";
import { useHuddle } from "@/context/HuddleContext";

// ── Minimal controls used inside the PiP ────────────────────────────────────
function PipControls({ onExpand, onEnd }: { onExpand: () => void; onEnd: () => void }) {
  const { localParticipant } = useLocalParticipant();
  const [micEnabled, setMicEnabled] = useState(true);
  const [camEnabled, setCamEnabled] = useState(true);

  function toggleMic() {
    const next = !micEnabled;
    localParticipant.setMicrophoneEnabled(next);
    setMicEnabled(next);
  }

  function toggleCam() {
    const next = !camEnabled;
    localParticipant.setCameraEnabled(next);
    setCamEnabled(next);
  }

  return (
    <div className="flex items-center gap-1 px-2 py-1.5 shrink-0" style={{ borderTop: "1px solid var(--t-border)" }}>
      <button
        onClick={toggleMic}
        title={micEnabled ? "Mute mic" : "Unmute mic"}
        className="p-1.5 rounded-lg transition-colors"
        style={{ background: micEnabled ? "var(--t-raised)" : "rgba(239,68,68,0.2)", color: micEnabled ? "var(--t-fg-2)" : "#f87171" }}
      >
        {micEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
      </button>
      <button
        onClick={toggleCam}
        title={camEnabled ? "Turn off camera" : "Turn on camera"}
        className="p-1.5 rounded-lg transition-colors"
        style={{ background: camEnabled ? "var(--t-raised)" : "rgba(239,68,68,0.2)", color: camEnabled ? "var(--t-fg-2)" : "#f87171" }}
      >
        {camEnabled ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
      </button>
      <button
        onClick={onExpand}
        title="Expand"
        className="p-1.5 rounded-lg transition-colors"
        style={{ background: "var(--t-raised)", color: "var(--t-fg-2)" }}
      >
        <Maximize2 className="w-3.5 h-3.5" />
      </button>
      <button
        onClick={onEnd}
        title="End call"
        className="p-1.5 rounded-lg transition-colors ml-auto"
        style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}
      >
        <PhoneOff className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ── Tiny video grid for PiP ──────────────────────────────────────────────────
function PipVideoGrid() {
  const tracks = useTracks(
    [{ source: Track.Source.Camera, withPlaceholder: true }],
    { onlySubscribed: false }
  );
  const participants = useParticipants();

  return (
    <div className="flex-1 min-h-0 overflow-hidden relative">
      {tracks.length === 0 ? (
        <div className="h-full flex items-center justify-center">
          <div className="flex flex-col items-center gap-2">
            <Users className="w-6 h-6" style={{ color: "var(--t-accent)" }} />
            <span className="text-[11px]" style={{ color: "var(--t-fg-3)" }}>Waiting for others…</span>
          </div>
        </div>
      ) : (
        <GridLayout tracks={tracks} style={{ height: "100%" }}>
          <ParticipantTile />
        </GridLayout>
      )}
      {/* Participant count badge */}
      {participants.length > 0 && (
        <div
          className="absolute top-2 right-2 flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold"
          style={{ background: "var(--t-accent)", color: "#000" }}
        >
          <Users className="w-2.5 h-2.5" />
          {participants.length}
        </div>
      )}
    </div>
  );
}

// ── Full expanded overlay ────────────────────────────────────────────────────
function ExpandedOverlay({ onMinimize, onEnd }: { onMinimize: () => void; onEnd: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col"
      style={{ background: "var(--t-surface)" }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-4 py-2 shrink-0"
        style={{ borderBottom: "1px solid var(--t-border)", background: "var(--t-header)" }}
      >
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-xs font-semibold" style={{ color: "var(--t-fg)" }}>Huddle</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={onMinimize}
            className="p-1.5 rounded-lg hover:bg-white/5 transition-colors"
            style={{ color: "var(--t-fg-2)" }}
            title="Minimise"
          >
            <Minimize2 className="w-4 h-4" />
          </button>
          <button
            onClick={onEnd}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
            style={{ background: "rgba(239,68,68,0.15)", color: "#f87171" }}
          >
            <PhoneOff className="w-3.5 h-3.5" />
            End
          </button>
        </div>
      </div>

      {/* LiveKit full conference UI */}
      <div className="flex-1 min-h-0">
        <VideoConference />
      </div>
    </div>
  );
}

// ── Draggable PiP container ──────────────────────────────────────────────────
function DraggablePip({ onEnd, onExpand }: { onEnd: () => void; onExpand: () => void }) {
  const dragRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: 0, y: 0 });
  const dragging = useRef(false);
  const startPos = useRef({ mx: 0, my: 0, ex: 0, ey: 0 });

  // Initial position — bottom-right
  useEffect(() => {
    const el = dragRef.current;
    if (!el) return;
    const pw = el.parentElement?.clientWidth ?? window.innerWidth;
    const ph = el.parentElement?.clientHeight ?? window.innerHeight;
    posRef.current = { x: pw - el.offsetWidth - 16, y: ph - el.offsetHeight - 16 };
    el.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
  }, []);

  function onMouseDown(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("button")) return;
    dragging.current = true;
    startPos.current = { mx: e.clientX, my: e.clientY, ex: posRef.current.x, ey: posRef.current.y };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }

  function onMouseMove(e: MouseEvent) {
    if (!dragging.current || !dragRef.current) return;
    const dx = e.clientX - startPos.current.mx;
    const dy = e.clientY - startPos.current.my;
    posRef.current = { x: startPos.current.ex + dx, y: startPos.current.ey + dy };
    dragRef.current.style.transform = `translate(${posRef.current.x}px, ${posRef.current.y}px)`;
  }

  function onMouseUp() {
    dragging.current = false;
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
  }

  return (
    <div
      ref={dragRef}
      onMouseDown={onMouseDown}
      className="fixed top-0 left-0 z-[9000] flex flex-col rounded-2xl overflow-hidden shadow-2xl cursor-grab active:cursor-grabbing select-none"
      style={{
        width: 260,
        height: 220,
        background: "var(--t-raised)",
        border: "1px solid var(--t-border)",
        boxShadow: "0 24px 64px rgba(0,0,0,0.6)",
      }}
    >
      {/* Live indicator */}
      <div
        className="flex items-center gap-1.5 px-3 py-1.5 shrink-0"
        style={{ borderBottom: "1px solid var(--t-border)", background: "var(--t-sidebar)" }}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
        <span className="text-[10px] font-semibold tracking-wide" style={{ color: "var(--t-accent)" }}>HUDDLE</span>
      </div>

      <PipVideoGrid />
      <PipControls onExpand={onExpand} onEnd={onEnd} />
    </div>
  );
}

// ── Root widget — renders nothing when no active call ────────────────────────
export function HuddleWidget() {
  const { roomName, token, isMinimized, endHuddle, toggleMinimize } = useHuddle();

  if (!roomName || !token) return null;

  const serverUrl = process.env.NEXT_PUBLIC_LIVEKIT_URL!;

  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect={true}
      video={true}
      audio={true}
      onDisconnected={endHuddle}
    >
      <RoomAudioRenderer />

      {isMinimized ? (
        <DraggablePip onEnd={endHuddle} onExpand={toggleMinimize} />
      ) : (
        <ExpandedOverlay onMinimize={toggleMinimize} onEnd={endHuddle} />
      )}
    </LiveKitRoom>
  );
}
