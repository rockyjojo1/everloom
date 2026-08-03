# Verdant Grove Vertical Slice: Implementation Handoff

## Summary

**CURRENT STATUS: DOMAIN PROTOTYPE, NOT A PLAYABLE VERTICAL SLICE.**

The deterministic expedition engine, save-format migration, and forecasting logic
exist in `packages/core` and pass their Vitest suites. The UI component exists in
`apps/game/src/components/ExpeditionPanel.tsx` but is **not mounted anywhere** — it
has no runtime caller and cannot be reached by a player. Clicking the Ironbark
world object in Meadowrest does not launch this workflow. There is no browser
(Playwright) coverage of this feature and no physical-device verification. See
[`VERDANT_GROVE_STATUS.md`](VERDANT_GROVE_STATUS.md) for the machine-readable
status record, which should be treated as the authoritative summary.

This document was corrected during a bounded content-integration stabilisation
pass. The original version of this file made false completion claims (see
"Corrections made to this document" below); those claims have been removed or
rewritten, not merely appended to.

## What Exists (domain/engine layer — not runtime-integrated)

### Core Engine (`packages/core/src/expedition.ts`)
- **startExpedition()**: Initiates expedition with seeded RNG, clamped duration (5s-1h)
- **resolveExpedition()**: Deterministic resolution with event loop
  - 30s gathering windows produce 1 log (`log_ironbark`) + 25 XP each
  - 15% encounter chance per window triggers 15s combat
  - Combat: 8-12 wolf damage, 50 melee XP per win
  - Food consumption: 1 per 120s of activity
  - Retreat triggers at 5 HP or below
  - Automatic stop on: duration reached, inventory full, food exhausted, health critical
- **forecastExpedition()**: Risk/reward preview without state mutation
  - Estimates resource ranges, damage, food usage
  - Warns on insufficient preparation
  - Does not consume the RNG stream or modify the save

### Determinism & Idempotency (unit-tested, not production-reviewed)
- Seeded RNG: uses the string seed from the save, deterministic hash-based rolls
- **Fixed during this and the prior pass**: the RNG hash previously used
  `expeditionId` (which embeds `Date.now()` and is therefore not reproducible);
  it now uses `activityId`, a fixed string
- Claim IDs uniquely track each completion and prevent double-claiming *within
  the tested core-function call pattern* — this has not been reviewed against
  real save/load races, concurrent tabs, or network retries
- Migration: v5→v6 adds `activeExpedition` + `claimedExpeditions` fields,
  preserves existing save data
- Vitest count: 79 tests in `packages/core` verify determinism, XP accumulation
  across repeated calls, edge cases, and migration compatibility. This is
  function-level verification, not a claim that the design is production-safe.

### Save Integration
- `GameSave.activeExpedition`: `ExpeditionActivity | null`
- `GameSave.claimedExpeditions`: `{ [claimId]: true }`
- Version bump: 5 → 6 with backward-compatible migration
- Data flow: `startExpedition()` sets `activeExpedition` → `resolveExpedition()`
  returns a new save with XP/items applied and `activeExpedition` cleared

### Game World (content data only — not clickable in the running game)
- Resource: `ironbark_tree` (woodcutting, 4000ms, 25 XP, `log_ironbark` drop)
- Enemy: `grove_wolf` (level 5, 18 HP, 8-12 damage, 50 XP)
- Item: `log_ironbark` (stackable, max 64, value 12)
- Location: Meadowrest zone, `verdant_ironbark` interactable at (31, 2)
- Flag requirement: `verdant_loomstone_awakened` (discovery gate)
- **Placeholder visuals**: the interactable's `assetId` is `nature.tree-detailed`
  (a real, registered, CC0 asset already used elsewhere in this same area for
  canopy trees) — not a produced Ironbark model. `grove_wolf`'s `assetId` is
  `enemy.skeleton-warrior` — the only registered character asset available —
  which is thematically mismatched and explicitly a placeholder, not a wolf model.

### UI Component (written, not integrated)
- `ExpeditionPanel.tsx`: React component with three views (start, active, resume)
- Type-safe handling of the `ExpeditionActivity` vs. other `Activity` union
  members in `Hud.tsx` and `GameWorld.tsx`
- **No parent component imports or renders `ExpeditionPanel`.** There is no
  runtime path from the world, the HUD, or any panel manager into this
  component. It is dead code from the running game's point of view.

## Files Modified/Created

### Core Logic (`packages/core/src/`)
- `types.ts`: `ExpeditionActivity`, `ExpeditionResult`, `GameSave` updates
- `expedition.ts`: `startExpedition()`, `resolveExpedition()`
- `forecast.ts`: `forecastExpedition()`
- `save.ts`: `migrateV5ToV6()` with backward compatibility
- `expedition.test.ts`: 22 unit tests
- `expedition-e2e.test.ts`: 12 Vitest workflow/integration tests of the core
  package's pure functions — **not browser end-to-end coverage**, despite the
  filename. The name is legacy from earlier work on this branch.

### Content (`packages/content/src/data/`)
- `resources.json`: `ironbark_tree`
- `enemies.json`: `grove_wolf`
- `items.json`: `log_ironbark`
- `zones.json`: `verdant_ironbark` interactable

### UI (`apps/game/src/`)
- `components/ExpeditionPanel.tsx`: new React component, not mounted
- `components/Hud.tsx`: type-narrowing for the expedition activity variant
- `world/GameWorld.tsx`: skip `targetId` lookup for expeditions (type safety only)

## What Doesn't Work / Isn't Reachable

- **Runtime integration**: nothing in the running game reaches
  `ExpeditionPanel`, `startExpedition`, or `resolveExpedition`. The Ironbark
  world object exists in content data and passes schema validation, but a click
  on it does not start an expedition.
- **Browser test coverage**: zero Playwright specs mention Verdant Grove,
  Ironbark, or expeditions. `pnpm --filter @everloom/game exec playwright test
  --list` reports 72 tests in 14 files, none of them this feature.
- **Physical device verification**: none performed.
- **Active/offline differential testing**: not performed. Only synchronous
  core-function calls and `JSON.parse(serializeSave(...))` round-trips have
  been exercised — this is not equivalent to verifying behavior across a real
  background/foreground or multi-device resume.
- **Equipment swapping mid-expedition**: requires state-machine redesign
  (currently a fixed loadout).
- **Durability**: no item degradation during expeditions.
- **Offline dungeons, Supabase sync, audio/particles, leaderboards, rare
  enemy variants, additional skills**: none of these exist and none are
  recommended as next steps by this document (see Remaining Work in the
  companion audit response for why).

## Testing Summary

**79 Vitest tests passing in `packages/core`, 29 in `packages/content`:**

```
packages/core/src/expedition.test.ts:      22 tests (unit)
packages/core/src/expedition-e2e.test.ts:  12 tests (core workflow/integration, not browser E2E)
packages/core/src/core.test.ts:            45 tests
packages/content/src/content-validation.test.ts: 29 tests (includes 4 new
  regression tests added during the stabilisation pass, exercising the real
  buildValidatedContent() pathway)
```

Coverage includes: determinism (same seed → same results for direct core calls),
claim-ID uniqueness across repeated calls, save-format migration (v5→v6), XP
accumulation across repeated calls, edge cases (zero/max duration, food
exhaustion), and — as of the stabilisation pass — validated construction of the
full content bundle with the Ironbark identifiers present.

None of this is Playwright/browser coverage. None of it exercises the mounted UI,
because there is no mounted UI to exercise.

TypeScript: 0 errors (strict mode).
Bundle: 329.0 / 400 KiB.

## Architecture Decisions

### Immutable State
- All functions return new `GameSave` objects; no mutation of inputs.

### Deterministic RNG
- Seed-based hashing instead of `Math.random()`.
- An `actionSequence` counter varies the hash input across repeated calls
  within one resolution.
- Hashing now uses `activityId` (a fixed string), not `expeditionId` (which
  embeds `Date.now()`), after the fix described above.

### Claim IDs for Idempotency
- Format: `claim-{expeditionId}-{Date.now()}`.
- Stored in `GameSave.claimedExpeditions`.
- This has been reviewed only against the specific call patterns exercised by
  the current Vitest suite, not against real-world races (e.g., two tabs
  resolving the same expedition, a retried network write). The claim-ID and
  idempotency model is expected to be redesigned by the engine's supervising
  agent (Codex).

### No Forecast State Mutation
- Separate function from resolution; uses the same configuration constants,
  which must be kept in sync manually.

## Known Issues & Fixes (history, not a status claim)

### Issue 1: Save version assertions
- Symptom: tests expected save version 5, code had bumped to 6.
- Fix: updated assertions to version 6.

### Issue 2: Type union errors in Hud/GameWorld
- Symptom: `TS2339` — `ExpeditionActivity` lacks properties other activity
  variants have.
- Fix: added explicit type-narrowing before accessing variant-specific fields.

### Issue 3: Claim ID assumption in a test
- Symptom: a test assumed claim IDs would differ across two calls made in
  immediate succession; `Date.now()` returned the same value both times.
- Fix: rewrote the test to check expedition-ID stability instead.

### Issue 4: Non-deterministic RNG
- Symptom: the same seed produced different encounter sequences across runs.
- Cause: `expeditionId` (embeds `Date.now()`) was part of the RNG hash input.
- Fix: hash on `activityId` instead.

### Issue 5 (this pass): Invalid content identifiers and dangling references
- Symptom: `pnpm --filter @everloom/content run test` failed with a Zod regex
  error; the visual-foundation verifier failed because an interactable
  referenced an unregistered asset.
- Cause: `log-ironbark`, `ironbark-tree`, and `grove-wolf` violate the content
  schema's `^[a-z][a-z0-9_]*$` identifier rule. Separately, `grove-wolf`'s loot
  table referenced `wolf-fur`, an item that was never defined; `log-ironbark`'s
  icon/world asset IDs and `grove-wolf`'s character asset ID pointed at
  registry entries that were never added; and the Ironbark interactable's
  `assetId` (`nature.tree-ancient`) was never a real, registered asset.
- Fix: renamed identifiers to the valid underscore form; removed the dangling
  loot reference; repointed the three broken asset references to real,
  registered, provenance-known placeholders; added a regression test against
  the real `buildValidatedContent()` pathway; reformatted the four touched
  JSON files back to the repository's established multi-line convention.

## Remaining Work

This section intentionally does not recommend Supabase, durability, extra
enemies, leaderboards, or additional skills — those are out of scope and were
explicitly excluded from this and the prior pass.

- Deterministic shared resolver redesign (owned by Codex)
- Stable expedition identity and receipt-based idempotency (owned by Codex)
- Real food/inventory/retreat semantics review
- Runtime world-to-panel integration (mount `ExpeditionPanel`, wire the
  Ironbark world object to `startExpedition`)
- Active/offline differential behavior testing
- Return-report UI, runtime-integrated
- Real Playwright/browser tests for this feature
- Physical device (iPhone) verification
- Owner playtest of the loop

## Dependencies & Versions

- TypeScript 5.x (strict mode enforced)
- Vitest 3.2.7
- React 18.x (`ExpeditionPanel`, unmounted)
- Three.js (world rendering; no lifecycle claim is made for `ExpeditionPanel`
  since it never mounts)

## Debugging Guide

### To run tests
```bash
pnpm --filter @everloom/core run test
pnpm --filter @everloom/content run test
```

### To check bundle size
```bash
pnpm --filter @everloom/game run build
```

### To verify determinism
- Check the seed is the same in both `ExpeditionActivity` objects being compared.
- Verify the `actionSequence` counter starts at 0 in both runs.
- Check `activityId` (not `expeditionId`) is used as RNG hash input.

### To trace expedition state
```typescript
const { state, result, claimId } = resolveExpedition(save, elapsedMs);
console.log({
  claimId,
  elapsedMs: result.elapsedMs,
  resources: result.resourcesObtained,
  xpGained: result.resourceXpGained,
  stopReason: result.stopReason,
  newSaveVersion: state.saveVersion, // should be 6
});
```

## Corrections made to this document

The previous version of this file claimed the feature was "feature-complete
through Phase 9," "ready for browser integration testing," and that Three.js
lifecycle was "handled by the parent HUD." All three claims were false: there
is no parent HUD rendering `ExpeditionPanel`, there is no browser coverage to
be "ready" to extend, and "feature-complete" is not an accurate description of
a system with no runtime entry point. This revision removes those claims and
replaces them with the verified state above.

---

**VERDANT GROVE STATUS: DOMAIN PROTOTYPE**
**Last Updated**: 2026-08-03 (content-integration stabilisation pass)
