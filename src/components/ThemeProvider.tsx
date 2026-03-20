"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { DEFAULT_THEME, type ThemeId } from "@/lib/themes";

type ThemeCtx = { theme: ThemeId; setTheme: (t: ThemeId) => void };
const ThemeContext = createContext<ThemeCtx>({ theme: DEFAULT_THEME, setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<ThemeId>(DEFAULT_THEME);

  // Apply on mount from localStorage
  useEffect(() => {
    const saved = (localStorage.getItem("tension-theme") as ThemeId) || DEFAULT_THEME;
    setThemeState(saved);
    document.documentElement.setAttribute("data-theme", saved);
  }, []);

  function setTheme(t: ThemeId) {
    setThemeState(t);
    localStorage.setItem("tension-theme", t);
    document.documentElement.setAttribute("data-theme", t);
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
