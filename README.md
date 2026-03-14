# Slack for Marketing

Slack-like app for marketing teams: channels, DMs, threads, plus marketing-specific tags (client/campaign) and future AI features. See [PRODUCT.md](./PRODUCT.md) for scope and AI advantage ideas.

## Stack

- Next.js 16 (App Router), TypeScript, Tailwind
- Supabase: Auth, Postgres, Realtime

## Setup

1. **Supabase** — Follow **[SETUP.md](./SETUP.md)** (create project at [supabase.com](https://supabase.com), then link + push migrations or run `supabase/migrations/001_core.sql` in SQL Editor).

2. **Env**
   - Copy `.env.local.example` to `.env.local`.
   - Set `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

3. **Run**
   - `npm install && npm run dev`
   - Open http://localhost:3000 → redirects to `/login`. Sign up a user.
   - In Supabase SQL Editor, run the seed pattern from `supabase/seed.sql` (create a workspace, add your user as member, create channels). Then refresh the app.

## What’s included

- Workspaces, channels (with optional `client_tag` / `campaign_tag`), DMs schema
- Realtime messages in channel view
- Login + middleware auth
- Dark UI shell (sidebar + channel view + composer)

## Next (see PRODUCT.md)

- Threads UI, file uploads, search
- AI: summarization, draft replies, semantic search, digests
