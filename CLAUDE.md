# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Tension** is a Slack-like team messaging app built with Next.js (web) and Tauri 2 (macOS desktop). It uses Supabase for auth, database, and real-time messaging, and Google Gemini for an AI assistant bot.

## Commands

```bash
# Development
npm run dev          # Start Next.js dev server (web)
npm run tauri dev    # Start Tauri desktop app (requires Rust toolchain)

# Build
npm run build        # Next.js production build
npm run tauri build  # Build macOS desktop app (sets TAURI_BUILD=true internally)

# Code quality
npm run lint         # ESLint with flat config (eslint.config.mjs)
```

**Supabase local dev:**
```bash
supabase start       # Start local Supabase (Docker)
supabase db reset    # Reset DB and re-run all migrations + seed
supabase migration new <name>  # Create a new migration
```

No test suite is configured.

## Architecture

### Dual deployment targets
`next.config.ts` conditionally switches to `output: 'export'` (static) when `TAURI_BUILD=true`, enabling the same Next.js codebase to run on Vercel (web) and inside the Tauri desktop shell.

### App Router structure
- `src/app/(app)/layout.tsx` — App shell; loads workspace, channels, and DMs on the server side; wraps content in `AppShell`
- `src/app/(app)/channel/ChannelView.tsx` — Channel messages + composer with Supabase Realtime subscription
- `src/app/(app)/dm/DMView.tsx` — DM conversation view (same pattern as channel)
- `src/app/api/ai/chat/route.ts` — Single Gemini 2.0 Flash call; parallel DB fetches for context (recent messages, members, knowledge base)
- `src/app/page.tsx` — Auth check + redirect to first channel; includes retry loop for workspace auto-provisioning delay

### Supabase patterns
- **Client-side:** `src/lib/supabase/client.ts` (browser client with SSR cookies)
- **Server-side:** `src/lib/supabase/server.ts` (server client for API routes and RSCs)
- Real-time subscriptions use `supabase.channel()` with `on('postgres_changes', ...)` — see ChannelView and DMView for the pattern
- The AI bot is a special user with fixed UUID `00000000-0000-0000-0000-000000000001`; its DM is auto-created on app load

### Database migrations
All schema lives in `supabase/migrations/`. Apply with `supabase db reset` locally or push with `supabase db push`. Key tables:
- `messages` — shared by channel and DM messages; has `channel_id` OR `dm_conversation_id`, optional `parent_id` for threads, `ai_source` flag
- `dm_conversations` + `dm_participants` — DM schema
- `tension_knowledge` — RAG-style knowledge base for AI context
- RLS is enforced everywhere; service role key is required in API routes that need to bypass RLS (AI chat endpoint)

### Tauri integration
`src/lib/tauri.ts` wraps all Tauri APIs with `isTauri()` guard for graceful browser degradation. Always use these wrappers rather than importing Tauri directly.

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
NEXT_PUBLIC_APP_URL          # Web deployment URL
GEMINI_API_KEY               # Google Generative AI
SUPABASE_SERVICE_ROLE_KEY    # Required for AI route (bypasses RLS)
TAURI_BUILD=true             # Set automatically during desktop builds
```

## Key Conventions

- **Path alias:** `@/*` maps to `src/*`
- **Styling:** Tailwind CSS 4 with dark theme throughout; use `clsx` + `tailwind-merge` via the `cn()` utility pattern
- **Types:** Shared TypeScript types in `src/lib/types.ts` (Channel, Message, Workspace, etc.)
- **Toasts:** Use `sonner` via `ToasterProvider`; the provider is in the root layout
- **Modals:** Use `ModalPortal` component to render outside the component tree
- **Message grouping:** Consecutive messages from the same sender collapse timestamps — preserve this logic when editing message rendering
