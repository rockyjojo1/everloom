# Everloom world clarity, mastery, and cloud handoff

## Delivered

- Ground tools use persistent, high-contrast world labels.
- Mara and the player have distinct nameplates; Mara's showcase weapons are hidden.
- Trees, ore, and fishing shoals remain visible while their action timer rests.
- The active tutorial route is drawn automatically and follows objective changes.
- The player's real equipped tool or weapon is attached to the animated right hand.
- Fresh saves begin with name and colour-theme character creation.
- Save version 5 migrates version 1-4 saves without losing progress.
- Skills show every action mastery, current rank, next-rank XP, and speed benefit.
- Active gathering shows mastery rank and XP beside the action timer.
- Optional Supabase email accounts, manual upload/load, and opt-in autosave are implemented.
- Vercel now publishes `apps/game/dist`, not the obsolete `apps/web/dist`.

## Cloud activation

The only connected Supabase project found during implementation was `Budget Planning` (`xduatzadnsujldtqjtvs`). It was not changed.

Create or select a dedicated Everloom Supabase project, then:

1. Apply `supabase/migrations/001_everloom_initial.sql` and `002_cloud_saves.sql` in order.
2. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_PUBLISHABLE_KEY` in local/Vercel environments.
3. Keep `SUPABASE_SERVICE_ROLE_KEY` server-only; it must never use a `VITE_` prefix.
4. Configure the production site URL and allowed redirect URLs in Supabase Auth.
5. Rebuild and run the account create/sign-in/upload/load test against the real project.
6. Run Supabase security and performance advisors after applying the migrations.

The cloud snapshot table has row-level security on every operation, explicit authenticated grants, and ownership checks based on `auth.uid()` for select, insert, update, and delete. Update has both `USING` and `WITH CHECK` protection.

## Design position

Everloom keeps OSRS/HighSpell's spatial loop: the avatar walks to readable people, tools, and persistent gathering nodes. Melvor's influence belongs in legible skill/mastery feedback, long interlocking grinds, equal online/offline simulation, and safe local-plus-cloud saving. The current per-action mastery is intentionally simpler than a spendable mastery pool during Tutorial Island; a skill-wide pool can arrive after players understand the six core skills.

## Remaining art work

This pass fixes identity and feedback, not the final asset style. The next visual phase should replace the single showcase knight with modular body/hair/clothing pieces, author distinct NPC silhouettes, improve gathering animation/tool grip transforms, and build a warmer hand-painted low-poly material library. Do not copy RuneScape, HighSpell, or Melvor assets or UI directly.

