# Apply migrations to your new Supabase project

Use **one** of these methods.

## Option A: Supabase CLI (after linking)

1. Link the project (use the project ref from your project URL: `https://XXXX.supabase.co` → ref is `XXXX`):
   ```bash
   npx supabase link --project-ref YOUR_PROJECT_REF
   ```
2. Push migrations:
   ```bash
   npx supabase db push
   ```

## Option B: SQL Editor in dashboard

1. Open your project in [Supabase Dashboard](https://supabase.com/dashboard) → **SQL Editor**.
2. New query → paste the full contents of **`supabase/migrations/001_core.sql`**.
3. Run the query.

Then add your first workspace and channels (see **`supabase/seed.sql`** for the pattern) and set **Settings → API** URL + anon key in `.env.local`.
