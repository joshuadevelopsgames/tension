# Supabase project setup (do this once)

You have to create the project in the Supabase dashboard; then you can link the repo and push migrations.

## 1. Create the project

1. Go to **[supabase.com](https://supabase.com)** and sign in (or sign up).
2. **New project** → pick an org (or create one).
3. **Name** e.g. `slack-mimic`, **Database password** (save it somewhere), **Region** (closest to you).
4. Wait for the project to finish provisioning.

## 2. Enable Auth (Email)

1. In the project: **Authentication** → **Providers**.
2. **Email** is on by default. Optionally turn off "Confirm email" if you want instant sign-in for dev.

## 3. Get API keys

1. **Settings** (gear) → **API**.
2. Copy:
   - **Project URL**
   - **anon public** (under "Project API keys")

## 4. Link repo and run migrations (CLI)

From the repo root:

```bash
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_REF
npx supabase db push
```

`YOUR_PROJECT_REF` is in the project URL: `https://abcdefgh.supabase.co` → ref is `abcdefgh`. Or use the project ID from **Settings → General**.

If you don’t use the CLI, in the Supabase dashboard open **SQL Editor**, create a new query, paste the contents of `supabase/migrations/001_core.sql`, and run it.

## 5. Env and run app

```bash
cp .env.local.example .env.local
```

Edit `.env.local` and set:

- `NEXT_PUBLIC_SUPABASE_URL` = Project URL from step 3  
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = anon public key from step 3  

Then:

```bash
npm run dev
```

Open http://localhost:3000, sign up a user, then in Supabase **SQL Editor** run the seed pattern from `supabase/seed.sql` (create a workspace, add your user as member, create channels).
