# 🚀 Everloom — Deploy to Vercel in 5 minutes

## What's new (Graphics Overhaul v0.1)
- ✅ **Character doubled in size** (64×128 pixels) with better proportions & animations
- ✅ **Node sprites massively upgraded** (60-84px) — trees, ore, water, campfire with pixel-art detail
- ✅ **Smooth character walking** — glides to nodes over 0.8s with eased transition
- ✅ **Always-visible inventory bar** — right-side panel shows 0-10 items at all times
- ✅ **Better animations** — arm/leg swings wider, chop/mine/fish more pronounced
- ✅ **iOS ready** — responsive touch-friendly buttons, portrait layout

## Deploy to Vercel (5 minutes)

### Step 1: Initialize Git & Push to GitHub
```bash
cd D:\Downloads\Everloom

# Initialize git
git init
git add .
git commit -m "Everloom v0.1: Graphics overhaul + always-visible inventory + smooth character walk

- Enlarged character sprite (64x128) with improved proportions
- Upgraded node sprites: trees, ore, water, campfire (60-84px)
- Smooth character walk animations (0.8s eased transition)
- Always-visible right-side inventory bar
- Improved animation keyframes (wider swings, better poses)
- iOS-responsive design with touch-friendly UI

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"

# Create GitHub repo at https://github.com/new
# Then:
git remote add origin https://github.com/YOUR_USERNAME/everloom.git
git branch -M main
git push -u origin main
```

### Step 2: Create Vercel Project
1. Go to https://vercel.com/new
2. Select **Import from Git**
3. Sign in with GitHub
4. Select your `everloom` repo
5. Vercel auto-detects the monorepo config (`vercel.json`)
6. Click **Deploy**

### Step 3: Add Environment Variables in Vercel Dashboard
After deployment starts, go to **Project Settings** → **Environment Variables**:

| Name | Value |
|------|-------|
| `VITE_SUPABASE_URL` | `https://xduatzadnsujldtqjtvs.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | `sb_publishable_J-17Xs3MhzDedLIf6q8T2g_wVGRCDYK` |

*(These are already configured for development; Vercel will use them for production)*

### Step 4: Trigger Redeploy
1. Vercel Dashboard → **Deployments** tab
2. Click the failed/building deployment
3. Click **Redeploy** (now that env vars are set)
4. **Wait 2-3 minutes** for build to complete

### ✅ You're Live!
Your Vercel URL will be: `https://everloom-XXXXX.vercel.app`

**Test on mobile**: Visit the URL on iOS/Android to verify responsive design & touch buttons.

---

## Troubleshooting

**Build fails: "Cannot find module @everloom/engine"**
→ Ensure `vercel.json` has `"buildCommand": "pnpm run build"`

**White screen on deploy**
→ Check Environment Variables are set in Vercel dashboard
→ Rebuild the deployment after adding them

**Supabase not syncing**
→ Verify RLS policies are enabled (check DEPLOY.md)

---

## What's Ready for Testing
- **Zones 1-3**: Meadowrest (safe), Bramblewood (locked - get 10 copper ore + 10 tin ore to unlock), Ashen Delve (locked)
- **Gathering**: Pine, Willow, Oak, Charwood trees + Copper/Tin/Iron ore + Fishing + **Campfire** (new!)
- **Crafting**: Recipes visible in Bench panel (cooking now requires campfire charges)
- **Inventory**: Always-on right sidebar showing item grid
- **UI**: Compact OSRS-style tab strip (bottom-right), panels at 58% height

## Next Steps (v0.2+)
- Forge node + full smithing mechanics
- Zone 2 downstream travel animation
- Kenney sprite atlas (currently inline SVG)
- Weekly contracts → Motes system

---

**Deployed!** Share the Vercel URL to start testing. 🎮
