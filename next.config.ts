import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Static export is only needed for Tauri desktop builds.
  // When deploying to Vercel, TAURI_BUILD is not set, so full Next.js mode is used.
  ...(process.env.TAURI_BUILD === "true" ? { output: "export" } : {}),
};

export default nextConfig;
