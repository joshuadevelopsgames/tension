"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { LinkPreview } from "@/components/LinkPreview";

/**
 * Renders message body text as inline-friendly Markdown.
 *
 * Styling philosophy: subtle, fits the dark zinc UI. Block-level elements
 * (headings, blockquotes, code blocks, lists) are lightly styled so they don't
 * feel out-of-place inside a chat bubble. Inline code uses a monospace pill.
 */
import { Sparkles } from "lucide-react";

const URL_REGEX = /https?:\/\/[^\s"'<>)]+/g;
function hasUrl(text: string) { return URL_REGEX.test(text); }

export function MarkdownMessage({ body, aiSource }: { body: string, aiSource?: 'tension' | 'gemini' }) {
  return (
    <div className="markdown-message text-[14px] leading-relaxed text-zinc-300">
      {aiSource === 'gemini' && (
        <div className="flex items-center gap-1.5 mb-2 px-2 py-1 rounded-md w-fit" style={{ background: "color-mix(in srgb, var(--t-accent) 10%, transparent)", border: "1px solid color-mix(in srgb, var(--t-accent) 25%, transparent)" }}>
          <Sparkles className="w-3 h-3" style={{ color: "var(--t-accent)" }} />
          <span className="text-[10px] font-bold uppercase tracking-tight" style={{ color: "var(--t-accent)" }}>AI Response</span>
        </div>
      )}
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          // Paragraphs — keep them inline-ish, no big margins
          p({ children }) {
            return <p className="mb-1 last:mb-0 whitespace-pre-wrap">{children}</p>;
          },

          // Headings — slightly bolder, de-emphasised size
          h1({ children }) {
            return <p className="text-base font-bold text-zinc-100 mt-2 mb-1">{children}</p>;
          },
          h2({ children }) {
            return <p className="text-[15px] font-bold text-zinc-100 mt-2 mb-1">{children}</p>;
          },
          h3({ children }) {
            return <p className="text-[14px] font-semibold text-zinc-200 mt-1 mb-0.5">{children}</p>;
          },

          // Bold / Italic / Strikethrough
          strong({ children }) {
            return <strong className="font-semibold text-zinc-100">{children}</strong>;
          },
          em({ children }) {
            return <em className="italic text-zinc-300">{children}</em>;
          },
          del({ children }) {
            return <del className="line-through text-zinc-500">{children}</del>;
          },

          // Inline code
          code({ children, className }) {
            // Block code fences have a className like "language-js"
            const isBlock = !!className;
            if (isBlock) {
              return (
                <code className={`block bg-black/40 border border-white/10 rounded-lg px-3 py-2 my-2 text-[12px] font-mono whitespace-pre overflow-x-auto ${className ?? ""}`} style={{ color: "var(--t-accent)" }}>
                  {children}
                </code>
              );
            }
            return (
              <code className="bg-black/40 border border-white/10 rounded px-1.5 py-0.5 text-[12px] font-mono" style={{ color: "var(--t-accent)" }}>
                {children}
              </code>
            );
          },

          // Code block wrapper — suppress the default <pre> padding
          pre({ children }) {
            return <pre className="not-prose overflow-x-auto">{children}</pre>;
          },

          // Blockquote
          blockquote({ children }) {
            return (
              <blockquote className="border-l-2 pl-3 my-1 italic" style={{ borderColor: "color-mix(in srgb, var(--t-accent) 50%, transparent)", color: "var(--t-fg-2)" }}>
                {children}
              </blockquote>
            );
          },

          // Lists
          ul({ children }) {
            return <ul className="list-disc list-inside my-1 space-y-0.5 text-zinc-300">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-inside my-1 space-y-0.5 text-zinc-300">{children}</ol>;
          },
          li({ children }) {
            return <li className="text-zinc-300">{children}</li>;
          },

          // Horizontal rule
          hr() {
            return <hr className="border-white/10 my-2" />;
          },

          // Links — open in browser (Tauri-safe)
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2 transition-colors" style={{ color: "var(--t-accent)" }}
              >
                {children}
              </a>
            );
          },

          // GFM: tables
          table({ children }) {
            return (
              <div className="overflow-x-auto my-2">
                <table className="text-[12px] border-collapse w-full">{children}</table>
              </div>
            );
          },
          thead({ children }) {
            return <thead className="border-b border-white/10">{children}</thead>;
          },
          tr({ children }) {
            return <tr className="border-b border-white/5">{children}</tr>;
          },
          th({ children }) {
            return <th className="px-3 py-1 text-left font-semibold text-zinc-200">{children}</th>;
          },
          td({ children }) {
            return <td className="px-3 py-1 text-zinc-400">{children}</td>;
          },
        }}
      >
        {body}
      </ReactMarkdown>
      {hasUrl(body) && <LinkPreview body={body} />}
    </div>
  );
}
