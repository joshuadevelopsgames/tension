"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  type ReactNode,
} from "react";
import { createClient } from "@/lib/supabase/client";
import { Phone, X } from "lucide-react";

export type IncomingHuddleInvite = {
  roomName: string;
  fromUserId: string;
  fromName: string;
  kind: "dm" | "channel";
  channelName?: string;
};

type StartHuddleOptions = {
  /** Join from invite — do not broadcast to others */
  silent?: boolean;
  /** DM / group DM: users to ring */
  inviteUserIds?: string[];
  /** Channel session: notify everyone in the workspace */
  channelInfo?: { workspaceId: string; channelId: string; channelName: string };
};

type HuddleState = {
  roomName: string | null;
  token: string | null;
  displayName: string | null;
  userId: string | null;
  isMinimized: boolean;
  isConnecting: boolean;
  incomingInvite: IncomingHuddleInvite | null;
  startHuddle: (
    roomName: string,
    userId: string,
    displayName: string,
    options?: StartHuddleOptions
  ) => Promise<void>;
  endHuddle: () => void;
  toggleMinimize: () => void;
  acceptIncomingInvite: () => Promise<void>;
  dismissIncomingInvite: () => void;
};

const HuddleContext = createContext<HuddleState | null>(null);

async function sendInviteBroadcasts(
  room: string,
  uid: string,
  name: string,
  options?: StartHuddleOptions
) {
  if (!options?.inviteUserIds?.length && !options?.channelInfo) return;

  const supabase = createClient();

  if (options.inviteUserIds?.length) {
    for (const targetId of options.inviteUserIds) {
      if (targetId === uid) continue;
      const ch = supabase.channel(`huddle-invite:${targetId}`);
      await new Promise<void>((resolve) => {
        ch.subscribe((status) => {
          if (status === "SUBSCRIBED") {
            ch.send({
              type: "broadcast",
              event: "invite",
              payload: {
                roomName: room,
                fromUserId: uid,
                fromName: name,
                kind: "dm" as const,
              },
            });
            setTimeout(() => {
              supabase.removeChannel(ch);
              resolve();
            }, 150);
          }
        });
      });
    }
  }

  if (options.channelInfo) {
    const { workspaceId, channelId, channelName } = options.channelInfo;
    const ch = supabase.channel(`huddle:ws:${workspaceId}`);
    await new Promise<void>((resolve) => {
      ch.subscribe((status) => {
        if (status === "SUBSCRIBED") {
          ch.send({
            type: "broadcast",
            event: "invite",
            payload: {
              roomName: room,
              fromUserId: uid,
              fromName: name,
              kind: "channel" as const,
              channelId,
              channelName,
            },
          });
          setTimeout(() => {
            supabase.removeChannel(ch);
            resolve();
          }, 150);
        }
      });
    });
  }
}

export function HuddleProvider({
  children,
  currentUserId,
  workspaceId,
}: {
  children: ReactNode;
  currentUserId: string;
  workspaceId: string;
}) {
  const [roomName, setRoomName] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [incomingInvite, setIncomingInvite] = useState<IncomingHuddleInvite | null>(null);
  const activeRoomRef = useRef<string | null>(null);
  const activeTokenRef = useRef<string | null>(null);
  activeRoomRef.current = roomName;
  activeTokenRef.current = token;

  // DM / 1:1 ring — per-user channel
  useEffect(() => {
    if (!currentUserId) return;
    const supabase = createClient();
    const ch = supabase.channel(`huddle-invite:${currentUserId}`);
    ch.on(
      "broadcast",
      { event: "invite" },
      ({ payload }: { payload: IncomingHuddleInvite }) => {
        if (!payload?.roomName || payload.fromUserId === currentUserId) return;
        if (payload.kind === "channel") return;
        if (payload.roomName === activeRoomRef.current && activeTokenRef.current) return;
        setIncomingInvite({
          roomName: payload.roomName,
          fromUserId: payload.fromUserId,
          fromName: payload.fromName || "Someone",
          kind: "dm",
        });
      }
    ).subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [currentUserId]);

  // Channel session — workspace-wide (client filters self)
  useEffect(() => {
    if (!workspaceId || !currentUserId) return;
    const supabase = createClient();
    const ch = supabase.channel(`huddle:ws:${workspaceId}`);
    ch.on(
      "broadcast",
      { event: "invite" },
      ({
        payload,
      }: {
        payload: IncomingHuddleInvite & { channelId?: string; channelName?: string };
      }) => {
        if (!payload?.roomName || payload.kind !== "channel") return;
        if (payload.fromUserId === currentUserId) return;
        if (payload.roomName === activeRoomRef.current && activeTokenRef.current) return;
        setIncomingInvite({
          roomName: payload.roomName,
          fromUserId: payload.fromUserId,
          fromName: payload.fromName || "Someone",
          kind: "channel",
          channelName: payload.channelName,
        });
      }
    ).subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [workspaceId, currentUserId]);

  const startHuddle = useCallback(
    async (room: string, uid: string, name: string, options?: StartHuddleOptions) => {
      if (roomName === room && token) {
        setIsMinimized(false);
        return;
      }

      setIsConnecting(true);
      try {
        const res = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomName: room, participantName: name, userId: uid }),
        });

        if (!res.ok) throw new Error("Failed to get token");

        const { token: jwt } = await res.json();
        setRoomName(room);
        setToken(jwt);
        setDisplayName(name);
        setUserId(uid);
        setIsMinimized(false);

        if (!options?.silent) {
          await sendInviteBroadcasts(room, uid, name, options);
        }
      } finally {
        setIsConnecting(false);
      }
    },
    [roomName, token]
  );

  const endHuddle = useCallback(() => {
    setRoomName(null);
    setToken(null);
    setDisplayName(null);
    setUserId(null);
    setIsMinimized(false);
  }, []);

  const toggleMinimize = useCallback(() => {
    setIsMinimized((v) => !v);
  }, []);

  const dismissIncomingInvite = useCallback(() => {
    setIncomingInvite(null);
  }, []);

  const acceptIncomingInvite = useCallback(async () => {
    if (!incomingInvite || !currentUserId) return;
    const inv = incomingInvite;
    setIncomingInvite(null);

    const supabase = createClient();
    const { data: profile } = await supabase
      .from("users")
      .select("full_name")
      .eq("id", currentUserId)
      .single();
    const name = profile?.full_name?.trim() || "Someone";

    await startHuddle(inv.roomName, currentUserId, name, { silent: true });
  }, [incomingInvite, currentUserId, startHuddle]);

  return (
    <HuddleContext.Provider
      value={{
        roomName,
        token,
        displayName,
        userId,
        isMinimized,
        isConnecting,
        incomingInvite,
        startHuddle,
        endHuddle,
        toggleMinimize,
        acceptIncomingInvite,
        dismissIncomingInvite,
      }}
    >
      {children}
      {incomingInvite && (
        <div className="fixed inset-0 z-[9500] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fade-in">
          <div
            className="w-full max-w-sm rounded-2xl border border-[var(--t-border)] bg-[var(--t-raised)] p-6 shadow-2xl animate-pop-in"
            style={{ boxShadow: "var(--t-shadow-high)" }}
          >
            <div className="flex justify-center mb-4">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center ring-4 ring-[var(--t-accent)]/30 animate-pulse"
                style={{ background: "color-mix(in srgb, var(--t-accent) 20%, transparent)" }}
              >
                <Phone className="w-8 h-8" style={{ color: "var(--t-accent)" }} />
              </div>
            </div>
            <p className="text-center text-sm font-semibold text-zinc-100 mb-1">
              Incoming session
            </p>
            <p className="text-center text-xs text-zinc-400 mb-6">
              {incomingInvite.kind === "channel" && incomingInvite.channelName
                ? `${incomingInvite.fromName} started a session in #${incomingInvite.channelName}`
                : `${incomingInvite.fromName} is inviting you to join`}
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={dismissIncomingInvite}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium text-zinc-400 hover:bg-white/5 border border-white/10 transition-colors"
              >
                <X className="w-4 h-4" />
                Decline
              </button>
              <button
                type="button"
                onClick={() => void acceptIncomingInvite()}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white transition-colors"
                style={{
                  background: "var(--t-accent)",
                  boxShadow: "0 4px 20px color-mix(in srgb, var(--t-accent) 35%, transparent)",
                }}
              >
                Join
              </button>
            </div>
          </div>
        </div>
      )}
    </HuddleContext.Provider>
  );
}

export function useHuddle() {
  const ctx = useContext(HuddleContext);
  if (!ctx) {
    throw new Error("useHuddle must be used within HuddleProvider");
  }
  return ctx;
}
