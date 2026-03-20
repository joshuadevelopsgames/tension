"use client";

import { useState, useEffect } from "react";

type OGData = {
  title?: string | null;
  description?: string | null;
  image?: string | null;
  siteName?: string | null;
  url?: string;
};

const URL_REGEX = /https?:\/\/[^\s"'<>)]+/g;

function extractFirstUrl(text: string): string | null {
  const match = text.match(URL_REGEX);
  return match?.[0] ?? null;
}

export function LinkPreview({ body }: { body: string }) {
  const [og, setOg] = useState<OGData | null>(null);
  const url = extractFirstUrl(body);

  useEffect(() => {
    if (!url) return;
    let cancelled = false;
    fetch(`/api/og?url=${encodeURIComponent(url)}`)
      .then((r) => r.json())
      .then((data: OGData & { error?: string }) => {
        if (!cancelled && !data.error && (data.title || data.description)) {
          setOg(data);
        }
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [url]);

  if (!og || (!og.title && !og.description)) return null;

  const domain = (() => {
    try { return new URL(url!).hostname.replace("www.", ""); } catch { return ""; }
  })();

  return (
    <a
      href={url!}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 flex items-start gap-3 max-w-sm bg-[var(--t-raised)]/60 border border-[var(--t-border)] rounded-xl p-3 hover:bg-[var(--t-raised)]/80 transition-colors group overflow-hidden no-underline block"
    >
      {og.image && (
        <img
          src={og.image}
          alt=""
          className="w-16 h-16 object-cover rounded-lg shrink-0 bg-[var(--t-raised)]"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
        />
      )}
      <div className="flex-1 min-w-0">
        {(og.siteName || domain) && (
          <p className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider mb-0.5">
            {og.siteName || domain}
          </p>
        )}
        {og.title && (
          <p className="text-xs font-semibold text-zinc-200 group-hover:text-white transition-colors line-clamp-2 leading-tight">
            {og.title}
          </p>
        )}
        {og.description && (
          <p className="text-[11px] text-zinc-500 mt-0.5 line-clamp-2 leading-relaxed">
            {og.description}
          </p>
        )}
      </div>
    </a>
  );
}
