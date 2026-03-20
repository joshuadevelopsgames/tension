"use client";

import { Suspense } from "react";
import { WorkspacesView } from "./WorkspacesView";

export default function WorkspacesPage() {
  return (
    <Suspense fallback={
      <div className="flex h-full items-center justify-center" style={{ color: "var(--t-fg-3)" }}>
        <div className="w-5 h-5 rounded-full border-2 border-t-transparent animate-spin" style={{ borderColor: "var(--t-accent) transparent transparent transparent" }} />
      </div>
    }>
      <WorkspacesView />
    </Suspense>
  );
}
