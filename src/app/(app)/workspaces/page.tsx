"use client";

import { Suspense } from "react";
import { WorkspacesView } from "./WorkspacesView";

function WorkspacesSkeleton() {
  return (
    <div className="flex h-full overflow-hidden animate-pulse">
      {/* Canvas list sidebar */}
      <div
        className="w-64 shrink-0 flex flex-col gap-2 p-3"
        style={{ borderRight: "1px solid var(--t-border)", background: "var(--t-sidebar)" }}
      >
        <div className="h-8 rounded-lg" style={{ background: "var(--t-raised)" }} />
        {[...Array(5)].map((_, i) => (
          <div
            key={i}
            className="h-9 rounded-lg"
            style={{ background: "var(--t-raised)", opacity: 0.3 + i * 0.12 }}
          />
        ))}
      </div>
      {/* Editor area */}
      <div className="flex-1 p-10 space-y-4">
        <div className="h-8 w-56 rounded-lg" style={{ background: "var(--t-raised)" }} />
        <div className="h-4 w-full rounded" style={{ background: "var(--t-raised)", opacity: 0.5 }} />
        <div className="h-4 w-3/4 rounded" style={{ background: "var(--t-raised)", opacity: 0.35 }} />
        <div className="h-4 w-5/6 rounded" style={{ background: "var(--t-raised)", opacity: 0.45 }} />
        <div className="h-4 w-2/3 rounded" style={{ background: "var(--t-raised)", opacity: 0.3 }} />
      </div>
    </div>
  );
}

export default function WorkspacesPage() {
  return (
    <Suspense fallback={<WorkspacesSkeleton />}>
      <WorkspacesView />
    </Suspense>
  );
}
