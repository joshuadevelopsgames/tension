import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/** Merge Tailwind classes without conflicts — use everywhere class merging is needed. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Consistent display name for any user-like object.
 * Falls back through: full_name → handle → "User XXXX"
 */
export function displayName(
  user: { full_name?: string | null; handle?: string | null; id?: string | null } | null | undefined
): string {
  if (!user) return "Unknown";
  return user.full_name ?? user.handle ?? `User ${(user.id ?? "????").slice(0, 4)}`;
}
