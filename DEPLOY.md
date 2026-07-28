# Everloom Deployment Guide

This guide walks through deploying Everloom to Vercel.

## Prerequisites

1. **Supabase project** — Create at [https://supabase.com](https://supabase.com)
   - Get your project URL (e.g., `https://your-project.supabase.co`)
   - Get your anonymous API key (`VITE_SUPABASE_ANON_KEY`) from Settings → API
   - Run migrations to initialize the database schema (see [Database Setup](#database-setup) below)

2. **GitHub account** — Fork or push the repo to GitHub

3. **Vercel account** — Sign up at [https://vercel.com](https://vercel.com)

## Database Setup

Before deploying to Vercel, your Supabase project must have the schema initialized:

1. In Supabase dashboard, go to **SQL Editor**
2. Create a new query and copy the migration SQL from `packages/database/migrations/001_everloom_initial.sql`
3. Run the migration to create all tables and enable RLS

Alternatively, if you have the `supabase` CLI:

```bash
# Install Supabase CLI
npm install -g supabase

# Link to your project and run migrations
supabase link --project-id your-project-id
supabase migration up
```

## Deploying to Vercel

### Step 1: Create a Vercel Project

1. Go to [https://vercel.com/new](https://vercel.com/new)
2. Import the GitHub repo (select the root directory)
3. Vercel auto-detects the `vercel.json` config

### Step 2: Configure Environment Variables

In the Vercel project dashboard, add these **Environment Variables**:

| Variable | Value |
|----------|-------|
| `VITE_SUPABASE_URL` | Your Supabase project URL (e.g., `https://your-project.supabase.co`) |
| `VITE_SUPABASE_ANON_KEY` | Your anonymous API key from Supabase Settings → API |

**Important**: Both variables must be available at **build time** (not just runtime) because Vite bakes them into the bundle.

### Step 3: Deploy

1. Click **Deploy**
2. Vercel builds the monorepo:
   - Installs dependencies with `pnpm install`
   - Builds all packages with `turbo run build`
   - Compiles React app with Vite → `apps/web/dist`
3. The app is deployed to `your-project.vercel.app`

## Verifying the Deployment

1. Navigate to your Vercel URL
2. Click **"Play as Guest"** to start a new game
3. Confirm the diorama, node buttons, and Bench panel load correctly
4. Gather from a node (Pine Tree, Campfire, etc.) to test engine loop and state sync

## Troubleshooting

### Build Fails: "Cannot find module '@everloom/engine'"

**Cause**: Workspace dependency in `packages/gamedata/package.json` not installed.  
**Fix**: Ensure `vercel.json` uses `pnpm install` (not `npm install`).

### "White screen" or "Failed to fetch Supabase"

**Cause**: Environment variables not set at build time, or Supabase project unreachable.  
**Fix**:
1. Verify `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` are set in Vercel dashboard
2. Check Supabase project is running (not paused)
3. Rebuild deployment: **Deployments** → **⋯** → **Redeploy**

### Supabase RLS Denies Reads

**Cause**: RLS policies not enabled or tables created without policies.  
**Fix**: Ensure `001_everloom_initial.sql` was run in full. Check Supabase **Authentication** → **Policies** to confirm `el_player_state` allows anonymous reads.

## Continuous Deployment

Once deployed, every push to `main` (or your configured branch) auto-redeploys:

1. GitHub repo → Vercel sees the commit
2. Vercel re-runs `pnpm build`
3. New version deployed to the same URL

## Local Development

For local development (before deploy):

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Start dev server
pnpm dev

# Open http://localhost:5174
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `apps/web/.env.local` for local Supabase testing.

---

**Questions?** Check the [README.md](README.md) or review `vercel.json` for the full Vercel config.
