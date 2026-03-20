export const THEMES = {
  obsidian: {
    name: "Obsidian",
    description: "Deep charcoal — the original",
    swatches: ["#0a0a0a", "#111111", "#2dd4bf"],
  },
  submerged: {
    name: "Submerged",
    description: "Midnight navy blue",
    swatches: ["#0c1324", "#151b2d", "#4edea3"],
  },
  void: {
    name: "Void",
    description: "Luminescent deep violet",
    swatches: ["#0f0d1a", "#1a1628", "#a78bfa"],
  },
  gilded: {
    name: "Gilded",
    description: "Warm obsidian & brushed gold",
    swatches: ["#110e0b", "#231f1c", "#f59e0b"],
  },
  terminal: {
    name: "Terminal",
    description: "Monospace. Pure black. Green.",
    swatches: ["#000000", "#0a0a0a", "#22c55e"],
  },
  crimson: {
    name: "Crimson Onyx",
    description: "Pure black with surgical crimson",
    swatches: ["#050505", "#0e0e0e", "#dc2626"],
  },
} as const;

export type ThemeId = keyof typeof THEMES;
export const DEFAULT_THEME: ThemeId = "submerged";
