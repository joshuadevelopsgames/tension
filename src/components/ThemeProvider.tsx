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
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);
  const [mode, setModeState] = useState<Mode>("dark");

  useEffect(() => {
    const saved = (localStorage.getItem("tension-theme") as ThemeId) || DEFAULT_THEME;
    const savedMode = (localStorage.getItem("tension-mode") as Mode) || "dark";
    setThemeState(saved);
    setModeState(savedMode);
    document.documentElement.setAttribute("data-theme", saved);
    document.documentElement.setAttribute("data-mode", savedMode);
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
