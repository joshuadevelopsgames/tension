/** Single source of truth for status colours, options, and emoji picker. */

export const STATUS_EMOJIS = [
  "😊","😄","😂","😅","🤔","🤩","😎","🥳","😴","🤒","😤","🥹",
  "🔥","✅","🚀","💯","👀","💡","⚡","🎯","📌","⚠️","🏆","✨",
  "👍","👎","❤️","🎉","💪","🫡","🙏","💀","🤝","👋","🫶","🎊",
  "☕","🍕","🎸","⚽","🌴","🏖️","🌙","☀️","🌧️","❄️","🌈","🎁",
] as const;

/** Tailwind bg class for each status value */
export const STATUS_COLORS: Record<string, string> = {
  active:  "bg-emerald-500",
  away:    "bg-amber-500",
  busy:    "bg-red-500",
  offline: "bg-zinc-500",
};

export const STATUS_OPTIONS = [
  { value: "active",  label: "Active",  color: "bg-emerald-500" },
  { value: "away",    label: "Away",    color: "bg-amber-500" },
  { value: "busy",    label: "Busy",    color: "bg-red-500" },
  { value: "offline", label: "Offline", color: "bg-zinc-500" },
] as const;

export type StatusValue = typeof STATUS_OPTIONS[number]["value"];
