/**
 * Tauri environment utilities.
 *
 * All Tauri-specific APIs must go through these helpers so the app degrades
 * gracefully when running in a plain browser (e.g. Vercel deployment).
 */

/** Returns true only when running inside a Tauri desktop shell. */
export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

/**
 * Starts the native window drag on pointer-down.
 * Safe to use as an `onPointerDown` handler — does nothing in a browser.
 */
export async function startWindowDrag(): Promise<void> {
  if (!isTauri()) return;
  const { getCurrentWindow } = await import("@tauri-apps/api/window");
  getCurrentWindow().startDragging();
}
