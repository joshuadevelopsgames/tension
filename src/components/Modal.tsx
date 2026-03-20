"use client";

import { X } from "lucide-react";
import { ModalPortal } from "./ModalPortal";

interface ModalProps {
  /** Title shown in the header bar */
  title: string;
  /** Called when backdrop or close button is clicked */
  onClose: () => void;
  /** Modal body content */
  children: React.ReactNode;
  /** Tailwind max-width class, defaults to max-w-sm */
  maxWidth?: string;
}

/**
 * Shared modal shell — backdrop + card + header with close button.
 * Renders via ModalPortal so it escapes any stacking context.
 *
 * Usage:
 *   <Modal title="New DM" onClose={onClose} maxWidth="max-w-md">
 *     <div className="p-4">…content…</div>
 *   </Modal>
 */
export function Modal({ title, onClose, children, maxWidth = "max-w-sm" }: ModalProps) {
  return (
    <ModalPortal>
      <div
        className={`fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4`}
        onClick={onClose}
      >
        <div
          className={`bg-[var(--t-raised)] border border-[var(--t-border)] rounded-2xl w-full ${maxWidth} shadow-2xl overflow-hidden flex flex-col`}
          style={{ boxShadow: "0 24px 64px rgba(0,0,0,0.6)" }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div
            className="flex items-center justify-between px-4 py-3 shrink-0"
            style={{ borderBottom: "1px solid var(--t-border)" }}
          >
            <h2 className="text-sm font-semibold" style={{ color: "var(--t-fg)" }}>
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md transition-colors hover:bg-white/10"
              style={{ color: "var(--t-fg-2)" }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Content — each consumer controls its own padding / layout */}
          {children}
        </div>
      </div>
    </ModalPortal>
  );
}
