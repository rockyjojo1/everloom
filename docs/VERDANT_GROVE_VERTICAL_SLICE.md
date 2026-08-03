# Verdant Grove Vertical Slice: Implementation Contract

## Scope

**This document is the target contract for an eventual complete, deterministic
AFK-first gameplay loop. It is not a description of the current implementation.**
The current implementation is a domain prototype (see
[`VERDANT_GROVE_STATUS.md`](VERDANT_GROVE_STATUS.md) and the Implementation
Status section below): the engine, save migration, and forecasting logic exist
and pass Vitest, but the loop below is not reachable by a player, has no browser
coverage, and its determinism/idempotency design has known gaps (see
Determinism Contract). Read every requirement in this contract as **target**,
not as **achieved**, unless the Implementation Status section explicitly says
otherwise.

Once complete, this slice is intended to prove:
- Shared domain logic for active and offline resolution
- Deterministic seeded random generation
- Proper idempotent reward handling
- Honest forecasting
- Complete save/load integration

## Player Loop

1. **Discovery**: Player reaches or unlocks Verdant Grove location
2. **Loadout**: Player selects equipment from inventory
3. **Forecast**: Player views honest risk/reward forecast before commitment
4. **Start**: Player initiates Ironbark woodcutting expedition with explicit duration
5. **Active Phase**: Real-time gathering with potential Grove Wolf interruptions
   - Gathering produces logs and XP
   - Combat consumes health, food, and time
   - Player can manually resolve/complete early
6. **Resume**: If offline, expedition continues deterministically with same seed
7. **Completion**: Expedition ends due to:
   - Duration reached
   - Inventory capacity reached
   - Food exhausted (retreat rule)
   - Health below retreat threshold
   - Player-initiated resolve
8. **Report**: Player sees return report with all results
9. **Idempotency**: Re-opening cannot reroll or duplicate rewards

## Technical Requirements

### Shared Deterministic Engine

- Pure TypeScript domain logic
- No React, Three.js, or DOM dependencies
- Seeded RNG (not Math.random())
- Same input → identical output
- Supports both immediate and chunked resolution
- Event ordering is explicit and testable

### Minimum State Input

```
{
  playerId: string
  activityId: "ironbark-woodcutting"
  startTimeMs: number
  requestedDurationMs: number
  expeditionSeed: string
  startingHealth: number
  retreatThresholdHealth: number
  loadout: {
    toolId: string        // worn-hatchet
    weaponId?: string     // optional
    food: { itemId: string; quantity: number }[]
  }
  inventoryFreeSlots: number
  skillLevel: number     // woodcutting
  discoveryStatus: "locked" | "discovered" | "unlocked"
  rulesVersion: number
}
```

### Minimum State Output

```
{
  expeditionId: string       // stable unique ID
  claimId: string           // claim/completion ID for idempotency
  state: GameSave           // updated player state after rewards applied
  
  result: {
    elapsedMs: number
    productiveGatheringMs: number
    combatInterruptionMs: number
    logsObtained: number
    woodcuttingXpGained: number
    meleeCombatXpGained: number
    wolfEncounters: number
    wolfDefeats: number
    wolfDeaths: number
    damagePlayerTaken: number
    foodConsumed: number
    endingHealth: number
    inventoryDelta: InventoryStack[]
    stopReason: StopReason
    eventLog: ExpeditionEvent[]
  }
}
```

### Event Ordering

Explicit deterministic sequence:

1. Validate state and access (discovery locked? health sufficient?)
2. Initialize expedition with seed
3. While time remaining and not stopped:
   a. Determine next event (gathering window or encounter)
   b. Advance clock
   c. Resolve event (gather or combat)
   d. Apply resources (XP, items, health, food)
   e. Check stop conditions (capacity, retreat threshold, food)
4. Apply all rewards to save state
5. Return results and claim ID

### Determinism Contract

Legend: **IMPLEMENTED AND UNIT-TESTED** = code exists, Vitest covers it, no known
contradiction. **REQUIRED / NOT YET VERIFIED** = target requirement; either
untested, or the current code contradicts it. **FULLY VERIFIED** = reserved for
requirements confirmed end-to-end (browser + production-safety review) — not
used anywhere below, because none qualify yet.

- IMPLEMENTED AND UNIT-TESTED — No `Math.random()` used for gameplay RNG rolls
  inside `resolveExpedition`'s event loop (rolls use `deterministicRollPpm`/
  `deterministicRange`, seeded from the save).
- REQUIRED / NOT YET VERIFIED — No real-time calls inside resolution. **Contradicted
  by current code**: `resolveExpedition` builds `claimId` using
  `` `claim-${exp.expeditionId}-${Date.now()}` `` (`packages/core/src/expedition.ts`,
  ~line 128) — a real-time call inside the function that performs resolution.
- REQUIRED / NOT YET VERIFIED — Stable expedition identity. **Contradicted by
  current code**: `startExpedition` builds `expeditionId` using
  `` `exp-${Date.now()}-${Math.random().toString(36).slice(2)}` `` (~line 23) —
  not a stable, input-derived identity; two expeditions started with identical
  inputs at different wall-clock moments get different IDs.
- IMPLEMENTED AND UNIT-TESTED — Seeded RNG is stable across repeated direct
  calls with the same seed (`expedition.test.ts` "produces identical results
  for identical input").
- IMPLEMENTED AND UNIT-TESTED — Same input produces deeply equal *gameplay*
  output (resources, XP, encounters) for the same seed — verified for
  synchronous, single-call resolution only.
- REQUIRED / NOT YET VERIFIED — Chunked and one-shot resolution must agree. No
  test calls `resolveExpedition` more than once against progressively larger
  `elapsedMs` for the same expedition and compares the result to a single
  one-shot call. This equivalence has not been written or verified.
- REQUIRED / NOT YET VERIFIED — Re-loading (reopening) an expedition must not
  reroll or change its seed. Save/reload round-trips of `activeExpedition` are
  tested; browser reopen behavior (closing and reopening the actual running
  game against a persisted save) is not.
- IMPLEMENTED AND UNIT-TESTED — Forecasting does not mutate save state (unit-
  tested directly: the input save object is compared before/after calling
  `forecastExpedition`).
- REQUIRED / NOT YET VERIFIED — Re-opening must not reroll encounters. No test
  exercises a real reopen (new process, reloaded save) against an in-progress
  expedition; only the same in-memory object is reused across calls.
- REQUIRED / NOT YET VERIFIED — Completion rewards must be idempotent in
  production. Unit tests confirm a `claimId` is recorded in
  `claimedExpeditions` and that resolving twice on the *same in-memory save*
  is a no-op (no active expedition to resolve). This has not been reviewed
  against real-world races (two tabs, a retried network write, a crash between
  save-write and claim-record) — see Known Issue 5 in
  [`VERDANT_GROVE_HANDOFF.md`](VERDANT_GROVE_HANDOFF.md).
- REQUIRED / NOT YET VERIFIED — Active/offline differential equivalence: no
  test compares the result of "resolve while active" against "resolve after a
  save/reload simulating an offline gap" for equivalent elapsed time. Only
  save/reload round-trips of the *data*, not a behavioral diff of the two code
  paths, have been performed.
- REQUIRED / NOT YET VERIFIED — Browser behavior. No Playwright coverage exists
  for any part of the expedition loop (confirmed via
  `playwright test --list`: 72 tests, 14 files, none of them this feature).

### Save Integration

- Add `activeExpedition` field to GameSave
- Add `completedExpeditions: { [claimId]: true }` to track claimed results
- Include versioned migration (current: version 5 → 6)
- Preserve existing inventory, equipment, XP, quests, appearance

### Stop Reasons

```
"duration_reached"       // requested time expired
"inventory_full"         // no free slots for next log
"food_exhausted"        // player needs to eat, none available
"health_critical"       // health dropped to retreat threshold
"player_manual_resolve"  // player ended activity
"expedition_invalid"     // state became invalid (crashed save?)
```

### Accept/Reject Criteria

**Woodcutting succeeds if:**
- Player has unlocked Ironbark
- Player has worn-hatchet (or better)
- Player health > 0
- Expedition duration >= 5 seconds, <= 1 hour
- Player has at least 1 free inventory slot

**Combat occurs with 15% chance per 30-second gathering window**

**Food is consumed:**
- 1 per 120 seconds of activity (gathering + combat)
- Retreat at threshold if none available

**Health damage:**
- Grove Wolf: 8-12 damage per hit
- Combat lasts 15-30 seconds on average
- Player health cannot go below 0

## Acceptance Tests

Same legend as the Determinism Contract above.

1. IMPLEMENTED AND UNIT-TESTED — Same seed produces identical expedition result
   (direct synchronous calls only)
2. IMPLEMENTED AND UNIT-TESTED — Different seeds produce different encounter
   sequences over a long enough duration
3. IMPLEMENTED AND UNIT-TESTED — No wolves encountered in some runs
4. IMPLEMENTED AND UNIT-TESTED — One or more wolves encountered in some runs
5. IMPLEMENTED AND UNIT-TESTED — Food consumed correctly per time
6. IMPLEMENTED AND UNIT-TESTED — Retreat occurs at configured health threshold
7. IMPLEMENTED AND UNIT-TESTED — Inventory-full termination works
8. IMPLEMENTED AND UNIT-TESTED — Duration termination works
9. REQUIRED / NOT YET VERIFIED — Cannot start without unlocking. No test drives
   `startExpedition` through the actual `verdant_loomstone_awakened` flag gate;
   the gate exists in content data (`requiredFlag` on the interactable) but
   nothing connects world-interaction gating to `startExpedition` at runtime.
10. IMPLEMENTED AND UNIT-TESTED — Invalid duration rejected or clamped
11. REQUIRED / NOT YET VERIFIED — Insufficient loadout rejected or warned.
    `forecastExpedition` produces warnings for missing food/low health/tight
    inventory, but nothing *rejects* a start on insufficient loadout — a
    player (or a direct `startExpedition` call) can proceed regardless.
12. IMPLEMENTED AND UNIT-TESTED — Completion cannot be claimed twice, for the
    specific call pattern the tests exercise (see the idempotency caveat in
    the Determinism Contract above — production-safety not yet reviewed)
13. IMPLEMENTED AND UNIT-TESTED — Save/reload preserves result (via
    `JSON.parse(serializeSave(...))` round-trips)
14. REQUIRED / NOT YET VERIFIED — Chunked and one-shot resolution agree — no
    such test exists (see Determinism Contract above)
15. IMPLEMENTED AND UNIT-TESTED — Forecasting does not mutate state
16. IMPLEMENTED AND UNIT-TESTED — Negative values impossible (health/food/
    quantities clamped in the tested code paths)
17. REQUIRED / NOT YET VERIFIED — Event log remains ordered and bounded. No
    `eventLog` field is populated or asserted on by any current test; the
    `ExpeditionResult` type in this contract's Minimum State Output includes
    `eventLog`, but the implemented `ExpeditionResult` does not currently
    produce one.

## Deferred Features

- ❌ Mid-expedition equipment switching
- ❌ Durability
- ❌ Free-form camps
- ❌ Pets
- ❌ Offline dungeons
- ❌ Automatic route simulation
- ❌ Broad familiarity/mastery systems
- ❌ Resource loss on ordinary retreat

## Implementation Status

**CURRENT STATUS: DOMAIN PROTOTYPE, NOT A PLAYABLE VERTICAL SLICE**

The deterministic expedition engine, save-format migration, forecasting logic, and
Vitest coverage described below exist and pass. None of it is reachable by a player
in the running game. See [`VERDANT_GROVE_STATUS.md`](VERDANT_GROVE_STATUS.md) for the
machine-readable status record and [`VERDANT_GROVE_HANDOFF.md`](VERDANT_GROVE_HANDOFF.md)
for the full limitations list. In short:

- `ExpeditionPanel` is not mounted anywhere — it has no runtime caller, no parent
  renders it, and there is no lifecycle to verify.
- Clicking the Ironbark world object in Meadowrest does not launch the expedition
  workflow. The world interactable exists in content data only.
- There is no Playwright (browser) coverage of the expedition feature. The 72
  existing Playwright specs do not reference it.
- `expedition-e2e.test.ts` is a Vitest workflow/integration-style test of the core
  package's pure functions. It is not browser end-to-end coverage and should not be
  read as such.
- Active-session and offline/resume resolution have not been differentially tested
  against each other under real save/load timing; only direct core serialization
  round-trips have been exercised.
- The deterministic RNG and claim-ID idempotency model are unit-tested but have not
  been reviewed as production-safe by the engine's supervising agent (Codex); a
  redesign pass is expected.
- No return-report UI is wired into the runtime.
- No preparation strategy has been playtested by a human.
- The owner has not confirmed the loop is enjoyable.
- Visual feedback (audio, particles, on-hit reaction) is entirely absent.
- The full visual foundation (baseline screenshot capture) remains incomplete —
  BASELINES PENDING: 0/10 captured, per `verify:visual-foundation`'s own output.

A content-integration stabilisation pass (identifier and asset-registry repairs; see
the note near the end of this section) fixed schema and registry violations that
were breaking `pnpm --filter @everloom/content run test` and the visual-foundation
verifier. That pass did not touch the engine's determinism/idempotency design and
did not integrate the UI into the runtime — both remain open work for a separate,
supervised redesign effort.

### Completed Work (domain/engine layer only — not runtime-integrated)

**PHASE 0: Visual Foundation Cleanup**
- Updated verify-visual-foundation.mjs with 15-stage verification pipeline
- Windows platform detection and pnpm.cmd/shell execution
- All baseline visual assets preserved via git checkout

**PHASE 1-3: Contract & Initial Setup**
- Detailed implementation contract in this file
- Feature branch isolation established
- Shared core architecture validated

**PHASE 4: Shared Expedition Engine**
- `packages/core/src/expedition.ts` with startExpedition/resolveExpedition
- Deterministic seeded RNG using saved seed
- 30s gathering windows, 15% encounter chance per window
- 8-12 wolf damage, 25 woodcutting XP per log, 50 melee XP per combat
- Stop conditions: duration_reached, food_exhausted, health_critical, inventory_full
- **No `eventLog` field exists on the implemented `ExpeditionResult`**, despite
  being listed in this contract's Minimum State Output above — see Acceptance
  Test 17

**PHASE 5: Save Migration & Idempotency**
- `packages/core/src/save.ts` migrateV5ToV6() function
- Added activeExpedition: null, claimedExpeditions: {} to GameSave
- Updated createNewSave() and migration chain
- 22 comprehensive tests covering: migration, persistence, idempotency, edge cases
- All tests passing (22/22 expedition, 45/45 core, 67 total)

**PHASE 6: Forecast System**
- `packages/core/src/forecast.ts` with forecastExpedition()
- ExpeditionForecast interface returning honest estimates
- Warns on: no food, insufficient food, health too low, inventory too small
- Does NOT mutate save or consume RNG stream
- Configuration constants matched to actual resolution

**PHASE 7: World Content (data only — not clickable in the running game)**
- Added `ironbark_tree` resource (woodcutting, 4000ms, 25 XP, 8s respawn)
- Added `grove_wolf` enemy (level 5, 18 HP, 8-12 damage, 50 XP, 2.4s attack)
- Added `log_ironbark` item (stackable, max 64, value 12)
- Added `verdant_ironbark` interactable in Meadowrest zone at (31, 2)
- Requires verdant_loomstone_awakened flag
- Updated Hud.tsx and GameWorld.tsx type-narrowing so the `expedition` activity
  variant compiles cleanly; this is type-safety work, not runtime wiring

**PHASE 8: UI Component (written, not mounted)**
- `apps/game/src/components/ExpeditionPanel.tsx` with start/active/resolve views
- Duration selector (1-60 minutes)
- Forecast display with logs, XP, encounters, damage, food usage
- Live warnings for insufficient preparation
- Loadout summary (equipment, health, inventory)
- Active state shows progress bar and remaining duration
- Resume button for interrupted expeditions
- **No parent component imports or renders `ExpeditionPanel`.** It has no runtime
  caller and cannot be reached by a player. There is nothing to lifecycle-verify
  (mount/unmount, Three.js disposal) because it never mounts.

### Code Quality (of the code that exists — not a completeness claim)

- ✅ TypeScript: 0 errors (full strict mode)
- ✅ Production build: 329.0 KiB / 400 KiB budget
- ✅ Vitest passing: 79/79 (22 expedition unit + 12 core workflow/integration + 45 core), plus 29/29 content-package tests
- Determinism and idempotency are unit-tested at the pure-function level only; they
  have not been reviewed for production correctness by the engine's supervising
  agent, and no claim of "proven idempotent rewards" should be made from this alone

### Deferred to Future Phases

- ❌ Mid-expedition equipment switching
- ❌ Durability mechanics
- ❌ Free-form camps
- ❌ Offline dungeon simulation
- ❌ Broad mastery systems
- ❌ Performance profiling beyond bundle size
- ❌ E2E browser testing (browser automation not used in current stack)
- ❌ GraphQL/REST API for online play
- ❌ Supabase sync integration (next phase)
- ❌ Multiplayer/seasonal ladder

### Files Modified

- Core logic:
  - `packages/core/src/types.ts` (ExpeditionActivity, ExpeditionResult, save version bump)
  - `packages/core/src/expedition.ts` (engine implementation, 670 LOC)
  - `packages/core/src/forecast.ts` (forecasting, 90 LOC)
  - `packages/core/src/save.ts` (migration v5→v6)
  - `packages/core/src/expedition.test.ts` (22 tests)

- Content:
  - `packages/content/src/data/resources.json` (ironbark_tree)
  - `packages/content/src/data/enemies.json` (grove_wolf)
  - `packages/content/src/data/items.json` (log_ironbark)
  - `packages/content/src/data/zones.json` (verdant_ironbark interactable)

- UI:
  - `apps/game/src/components/ExpeditionPanel.tsx` (220 LOC, new component)
  - `apps/game/src/components/Hud.tsx` (expedition type handling)
  - `apps/game/src/world/GameWorld.tsx` (skip expedition targetId lookup)

**PHASE 9: Core Workflow/Integration Tests (Vitest, not browser E2E)**
- Created `expedition-e2e.test.ts` — the filename is legacy from earlier work in
  this branch and is misleading; its 12 tests exercise `startExpedition` /
  `resolveExpedition` / `forecastExpedition` directly against in-memory
  `GameSave` objects and `JSON.parse(serializeSave(...))` round-trips. There is no
  browser, no rendered UI, and no Playwright involvement in this file.
- Covers: repeated calls through the core API in sequence (loosely analogous to a
  player journey, but not a runtime one), save/load round-trips of the core state,
  XP accumulation across repeated calls, save-format migration compatibility
  (v5→v6), claim-ID uniqueness across repeated calls, and boundary values (min/max
  duration, zero-damage runs, food exhaustion).
- Fixed a determinism bug found during this work: the RNG hash was seeded in part
  by `expeditionId`, which embeds `Date.now()` and is therefore not reproducible
  across runs. Changed to hash on `activityId` (a fixed string) instead. This is a
  real fix to a real defect, but it does not constitute "differential" testing
  between active and offline resolution paths — no such comparison exists yet.
- Vitest count at last run: 79 passing in `packages/core` (22 expedition unit + 12
  workflow/integration + 45 core), plus 29/29 in `packages/content` after the
  stabilisation pass below.

**PHASE 10: Performance notes (partial, not a lifecycle audit)**
- Bundle size maintained within budget: 329.0 / 400 KiB
- No new dependencies added
- The core expedition/forecast modules hold no persistent module-level state and
  register no listeners, so there is nothing there to leak
- **Not verified**: `ExpeditionPanel` mount/unmount behavior, Three.js resource
  disposal, or any UI lifecycle — because the component is never mounted by
  anything in the running app. Any earlier claim that "Three.js lifecycle is
  handled by the parent HUD" was false; there is no parent HUD rendering this
  component to hand off cleanup to.

**Content-integration stabilisation pass (post-audit correction, this pass)**
- Renamed invalid content identifiers to satisfy the `^[a-z][a-z0-9_]*$` schema:
  `log-ironbark` → `log_ironbark`, `ironbark-tree` → `ironbark_tree`,
  `grove-wolf` → `grove_wolf`. Updated every reference across content JSON, the
  core engine, and tests.
- Fixed two additional defects the identifier work uncovered: `grove_wolf`'s loot
  table referenced `wolf-fur`, an item that never existed in `items.json` at all
  (not a naming issue — a genuinely missing reference); it now drops nothing.
  `log_ironbark`'s `iconId`/`worldAssetId` and the enemy's `assetId` referenced
  registry entries (`item.log-ironbark`, `custom.log-ironbark`, `enemy.wolf`) that
  were never added to `packages/assets/src/registry.json`.
- Replaced the world interactable's asset reference `nature.tree-ancient` (never
  registered — not a real asset) with `nature.tree-detailed`, an already-registered,
  provenance-known Kenney CC0 asset already used elsewhere in this same Verdant
  Grove area for canopy trees. This is an explicit **placeholder**, not a produced
  Ironbark-specific model. Likewise `grove_wolf`'s `assetId` was pointed at
  `enemy.skeleton-warrior` — the only registered character asset available — as a
  temporary, thematically-mismatched placeholder. No new asset was invented, no
  reference image was copied into the runtime, and no GLB was fabricated.
- Reformatted the four touched content JSON files (`items.json`, `resources.json`,
  `enemies.json`, `zones.json`) from single-line minified JSON back to the
  repository's established 2-space-indent, one-key-per-line, CRLF, trailing-newline
  convention (matching `recipes.json`/`quests.json`). No data values were rewritten
  beyond the identifier/asset corrections above; verified by structural diff.
- Added a real regression test (`packages/content/src/content-validation.test.ts`,
  describe block "Verdant Grove Ironbark content (post-stabilisation)") that
  exercises `buildValidatedContent()` — the actual schema-validation and
  cross-reference pathway — and proves `log_ironbark`, `ironbark_tree`, and
  `grove_wolf` exist, the resource yields the correct item, the enemy's loot table
  only references real items, and the `verdant_ironbark` interactable references a
  valid resource and a registered runtime asset.
- Did **not** touch the expedition engine's determinism/idempotency design, did
  not integrate `ExpeditionPanel` into the runtime, and did not add Playwright
  coverage. Those remain open and are explicitly out of scope for this pass.

### Known Limitations

- **UI component has no runtime caller**: `ExpeditionPanel` is not imported or
  rendered anywhere in `apps/game/src`. It cannot be reached by a player.
- **World object is not clickable into the workflow**: the `verdant_ironbark`
  interactable exists in content data and passes validation, but nothing connects
  a click on it to `startExpedition`/`ExpeditionPanel`.
- **No browser test coverage**: zero Playwright specs reference Verdant Grove,
  Ironbark, or the expedition system. `--list` confirms 72 tests in 14 files, none
  of them this feature.
- **No physical device verification**: no iPhone or other physical hardware test
  has been run against this feature.
- **No active/offline differential testing**: active-session and offline/resume
  resolution paths have not been compared against each other under realistic
  save/load timing; only synchronous core-function round-trips exist.
- **Idempotency and determinism are unit-tested, not production-reviewed**: the
  claim-ID model and seeded-RNG design are exercised by Vitest but have not been
  reviewed by the engine's supervising agent (Codex), who owns the deterministic
  resolver and save/idempotency redesign.
- **Placeholder visuals**: the Ironbark tree reuses `nature.tree-detailed` and the
  Grove Wolf reuses `enemy.skeleton-warrior` — both real, registered, CC0 assets,
  but neither is a produced asset for this content.
- **Forecast uses estimates**: encounter risk is statistical, not a deterministic
  preview.
- **No audio/particle feedback for encounters**: no UI feedback exists at all,
  since the UI is unmounted.
- **Food tracking assumes `food-bread` item exists**: no validation of food item
  type.
- **Equipment cannot be swapped mid-expedition**: fixed loadout only.
- **Durability not tracked**: items do not degrade during expeditions.
- **Visual foundation baselines remain pending**: `verify:visual-foundation`
  reports BASELINES PENDING, 0/10 captured, as of this pass.
