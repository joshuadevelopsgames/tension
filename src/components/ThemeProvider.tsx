"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_THEME, type ThemeId } from "@/lib/themes";

type Mode = "dark" | "light";

type ThemeCtx = {
  theme: ThemeId;
  setTheme: (t: ThemeId) => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  toggleMode: () => void;
};

const ThemeContext = createContext<ThemeCtx>({
  theme: DEFAULT_THEME,
  setTheme: () => {},
  mode: "dark",
  setMode: () => {},
  toggleMode: () => {},
});

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  // Lazy initialisers — read localStorage on first render so React state
  // already matches what the blocking <script> applied to <html>.
  const [theme, setThemeState] = useState<ThemeId>(() => {
    if (typeof window === "undefined") return DEFAULT_THEME;
    return (localStorage.getItem("tension-theme") as ThemeId) || DEFAULT_THEME;
  });
  const [mode, setModeState] = useState<Mode>(() => {
    if (typeof window === "undefined") return "dark";
    return (localStorage.getItem("tension-mode") as Mode) || "dark";
  });

  // Sync attributes once on mount (covers any edge-case where the blocking
  // script hasn't fired, e.g. CSP-blocked or running in pure SSR).
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    document.documentElement.setAttribute("data-mode", mode);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setTheme(t: ThemeId) {
    setThemeState(t);
    localStorage.setItem("tension-theme", t);
    document.documentElement.setAttribute("data-theme", t);
  }

  function setMode(m: Mode) {
    setModeState(m);
    localStorage.setItem("tension-mode", m);
    document.documentElement.setAttribute("data-mode", m);
  }

  function toggleMode() {
    setMode(mode === "dark" ? "light" : "dark");
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme, mode, setMode, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
