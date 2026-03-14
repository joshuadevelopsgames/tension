"use client";

function formatDateLabel(date: Date): string {
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const msgDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());

  if (msgDay.getTime() === today.getTime()) return "Today";
  if (msgDay.getTime() === yesterday.getTime()) return "Yesterday";

  return date.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });
}

export function DateSeparator({ date }: { date: string }) {
  const label = formatDateLabel(new Date(date));
  return (
    <div className="flex items-center gap-3 my-3 select-none">
      <div className="flex-1 h-px bg-white/5" />
      <span className="text-[11px] font-medium text-zinc-500 shrink-0">{label}</span>
      <div className="flex-1 h-px bg-white/5" />
    </div>
  );
}

/** Returns true if two ISO timestamp strings fall on different calendar days */
export function isDifferentDay(a: string, b: string): boolean {
  const da = new Date(a);
  const db = new Date(b);
  return (
    da.getFullYear() !== db.getFullYear() ||
    da.getMonth() !== db.getMonth() ||
    da.getDate() !== db.getDate()
  );
}
