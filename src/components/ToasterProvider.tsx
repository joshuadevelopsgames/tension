"use client";

import { Toaster as Sonner } from "sonner";

export function ToasterProvider() {
  return (
    <Sonner
      theme="dark"
      className="toaster group"
      toastOptions={{
        classNames: {
          toast: "group-[.toaster]:bg-zinc-900 group-[.toaster]:text-zinc-100 group-[.toaster]:border-white/10 group-[.toaster]:shadow-2xl group-[.toaster]:rounded-xl font-sans",
          description: "group-[.toast]:text-zinc-400",
          actionButton: "group-[.toast]:bg-indigo-600 group-[.toast]:text-zinc-100 group-[.toast]:font-semibold",
          cancelButton: "group-[.toast]:bg-zinc-800 group-[.toast]:text-zinc-400",
        },
      }}
    />
  );
}
