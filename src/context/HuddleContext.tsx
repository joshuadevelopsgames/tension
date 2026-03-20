"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

type HuddleState = {
  roomName: string | null;
  token: string | null;
  displayName: string | null;
  userId: string | null;
  isMinimized: boolean;
  isConnecting: boolean;
  startHuddle: (roomName: string, userId: string, displayName: string) => Promise<void>;
  endHuddle: () => void;
  toggleMinimize: () => void;
};

const HuddleContext = createContext<HuddleState>({
  roomName: null,
  token: null,
  displayName: null,
  userId: null,
  isMinimized: false,
  isConnecting: false,
  startHuddle: async () => {},
  endHuddle: () => {},
  toggleMinimize: () => {},
});

export function HuddleProvider({ children }: { children: ReactNode }) {
  const [roomName, setRoomName] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const startHuddle = useCallback(async (room: string, uid: string, name: string) => {
    // If already in this room, just un-minimize
    if (roomName === room) {
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
    } finally {
      setIsConnecting(false);
    }
  }, [roomName]);

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

  return (
    <HuddleContext.Provider value={{ roomName, token, displayName, userId, isMinimized, isConnecting, startHuddle, endHuddle, toggleMinimize }}>
      {children}
    </HuddleContext.Provider>
  );
}

export function useHuddle() {
  return useContext(HuddleContext);
}
