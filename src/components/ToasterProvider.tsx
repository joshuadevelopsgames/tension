"use client";

import { Toaster as Sonner } from "sonner";

export function ToasterProvider() {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group-[.toaster]:!bg-[var(--t-raised)] group-[.toaster]:!text-[var(--t-fg)] group-[.toaster]:!border-[var(--t-border)] group-[.toaster]:shadow-2xl group-[.toaster]:rounded-xl font-sans",
          description: "group-[.toast]:!text-[var(--t-fg-2)]",
          actionButton: "group-[.toast]:!bg-[var(--t-accent)] group-[.toast]:!text-white group-[.toast]:font-semibold",
          cancelButton: "group-[.toast]:!bg-[var(--t-surface)] group-[.toast]:!text-[var(--t-fg-2)]",
          success: "group-[.toaster]:!text-emerald-400",
          error: "group-[.toaster]:!text-red-400",
          icon: "group-[.toaster]:!text-[var(--t-fg-2)]",
        },
      }}
    />
  );
}
