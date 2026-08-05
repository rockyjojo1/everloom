# Gate 6A: Deterministic Expedition Resolution Kernel — Implementation Report

Date: 2026-08-05
Branch: `monkeycode/deterministic-expedition-kernel`
Base: `claude/canonical-asset-foundation` at `f38b670f435c059edee91a47876c78c5004adce6` (verified present via `git fetch origin` before branching)
First commit (rejected): `e2df0ff2578dea98134ec563ce9551f799a67ee2`

This is an implementation report for the MONKEYCODE Gate 6A task: build a pure,
deterministic expedition-resolution kernel in `packages/core`, isolated from the
legacy expedition/save modules. It records what was built, the exact semantics,
how it was verified, and what is deliberately out of scope. The separate
`VERIFICATION_LOG.md` in this directory records every command that was run and
its exact exit status.

## Revision history

- **First pass** (commit `e2df0ff2578dea98134ec563ce9551f799a67ee2`): the initial
  kernel implementation was **rejected by the independent supervisor** with six
  domain defects. The record below documents that rejection and this second pass
  that corrects all six.
- **Second pass (this report)**: corrects the six rejected semantics, extends the
  test suite, and fixes a chunked-vs-one-shot divergence that was uncovered while
  re-testing the corrected time model.

## Supervisor rejection (first pass)

The first implementation was rejected for the following defects:

1. **Time model.** `elapsedResolvedMs` excluded time inside a partial action, so
   the remaining-plan-time arithmetic (`requestedDurationMs - elapsedResolvedMs`)
   was wrong and a resume request of 100 s after a 20 s partial was accepted
   against a 120 s plan even though it over-ran. Fixed: partial time is included
   in `elapsedResolvedMs`, and `delta.elapsedAppliedMs` equals the accepted time
   exactly.
2. **Inventory stack mutation.** The kernel never created the resource stack:
   it required a free slot on *every* award, so a first gather with
   `inventoryUsedSlots = 17` was falsely rejected as full. Fixed: the first award
   that creates a new stack consumes exactly one slot and sets
   `existingResourceStackPresent`; later awards consume no slot.
3. **Encounter outcomes.** Lethal encounters were still counted as wins. Fixed:
   damage is applied first; post-damage health above `minimumHealthToContinue`
   is a win (combat XP), at or below it is a loss (no XP, `health_critical`).
   `encountersWon + encountersLost === encounters` holds always.
4. **Cumulative food clock.** Combat time was excluded from the food clock.
   Fixed: one cumulative clock across gathering, combat and partial time; one
   unit is consumed at each multiple of `foodConsumptionIntervalMs`; running out
   stops exactly at the boundary, never past it and never negative.
5. **Terminal no-op ordering.** A further non-negative `requestedElapsedMs` on a
   completed/stopped progress threw `invalid_elapsed` for over-running the
   duration. Fixed: terminal and zero-elapsed progress are no-ops **before** the
   duration bound is checked, so a terminal progress never errors on a further
   non-negative request.
6. **Plan-aware progress validation.** The validator only checked schema-level
   invariants. Fixed: `validateDeterministicExpeditionProgressAgainstPlan` runs
   on every resolve and rejects structural corruption with code
   `invalid_progress` (elapsed over duration, terminal carrying a partial,
   partial sequence/start/bounds, slot-limit overflow, won/lost/encounters
   mismatch, completed with wrong elapsed, active at the duration, time buckets
   not summing to elapsed, resources without a stack, stack without a slot).

## Scope and protected paths

Only the following files were created or modified:

| File | Change |
|---|---|
| `packages/core/src/expedition-contract.ts` | **Created** — schema, types, stable validation, error class/codes; plan-aware validator added in the second pass |
| `packages/core/src/expedition-kernel.ts` | **Created** — pure resolution kernel; rewritten in the second pass for the six corrected semantics |
| `packages/core/src/expedition-contract.test.ts` | **Created** — contract/validation tests incl. a plan-aware validation block (73 tests) |
| `packages/core/src/expedition-kernel.test.ts` | **Created** — kernel semantics + property matrix + irregular partitions; fully rewritten in the second pass (121 tests) |
| `packages/core/src/index.ts` | **Modified** — two new `export *` lines only |
| `docs/audits/2026-08-05-deterministic-expedition-kernel/GATE6A_IMPLEMENTATION_REPORT.md` | **Created** (this file) |
| `docs/audits/2026-08-05-deterministic-expedition-kernel/VERIFICATION_LOG.md` | **Created** |

The following were **never touched** (verified with `git status --short` and the
protected-path list in the task):

- `apps/**`
- `docs/authority/**`
- `docs/audits/2026-08-04-*/**` (Gate 3 audit evidence left unedited)
- `packages/assets/**`, `packages/content/**`, `packages/engine/**`, `packages/gamedata/**`
- `art-direction/**`, `artifacts/**`
- `pnpm-lock.yaml`, `vercel.json`
- Legacy core modules read as references but **not modified**:
  `packages/core/src/expedition.ts`, `expedition.test.ts`, `save.ts`,
  `save.test.ts`, `types.ts`, `simulation.ts`, `simulation.test.ts`, `rng.ts`

The Gate 4 branch `claude/meadowrest-production-room-bakeoff` was **not touched**.

## Architecture

Two new modules in `packages/core/src`:

1. **`expedition-contract.ts`** owns the JSON-safe readonly types
   (`DeterministicExpeditionPlan`, `DeterministicExpeditionRules`,
   `DeterministicExpeditionStartingState`, `DeterministicExpeditionProgress`,
   `DeterministicExpeditionPartialAction`, `DeterministicExpeditionDelta`,
   `DeterministicExpeditionResolution`), the stable error class
   `DeterministicExpeditionError` with typed codes, the schema-level validator
   `validateDeterministicExpeditionProgress`, and the plan-aware validator
   `validateDeterministicExpeditionProgressAgainstPlan`. No resolution logic
   lives here.
2. **`expedition-kernel.ts`** owns the two entry points
   `createDeterministicExpeditionProgress(plan, startingState)` and
   `resolveDeterministicExpedition(plan, currentProgress, requestedElapsedMs)`.

RNG is sourced exclusively from the existing `rng.ts` helpers
(`deterministicRollPpm`, `deterministicRange`), reusing the legacy hash
namespaces (`expedition_encounter`, `wolf_damage`) so that the same seed
consumes the same stream shape as the legacy resolver. No new randomness, no
ambient time, no ID generation anywhere in the kernel.

## Time model and chunked continuity

`elapsedResolvedMs` is the total simulated time already consumed, **including**
time inside the current partial action. An action that spans a chunk boundary is
carried in `progress.partialAction` as `{ kind, actionSequence,
elapsedInActionMs }`:

- `actionSequence` pins the RNG stream (the encounter roll and damage roll are
  consumed exactly once when the action is scheduled, and are re-derived from
  the pinned sequence on resume — the action never re-rolls).
- `elapsedInActionMs` records where the already-consumed time sits within the
  current action (`actionStart = elapsedResolvedMs - elapsedInActionMs`).
- The kernel processes elapsed chronologically: every loop iteration advances to
  the next event — an action completion, a food boundary, or the requested
  target. The current action's identity (kind, sequence, start, end) is derived
  once and held across iterations, so an in-flight action is never lost when a
  mid-action food boundary is crossed. (The first-pass kernel re-derived the
  action start from the *current* elapsed each iteration; after a mid-action
  boundary this shifted the start backward and caused a chunked vs one-shot
  divergence that this pass fixes.)

This guarantees **one-shot == chunked**: resolving a total elapsed time in one
call produces the identical progress as resolving it as any sequence of
partitions summing to the same total. It is the same resolver for the online
(incremental) and offline (catch-up on login) paths; callers differ only in the
size of `requestedElapsedMs` they pass. The property matrix and an irregular
partition suite (splits inside a gather, inside combat, exactly on a food
boundary, 1 ms before and after) assert this.

## Semantics (corrected, deterministic)

- **Elapsed.** `requestedElapsedMs` must be a non-negative safe integer;
  anything else (negative, fractional, `NaN`, infinities) throws
  `invalid_elapsed`. A zero-elapsed call is a pure no-op returning the input
  object and an all-zero delta. `elapsedResolvedMs + requestedElapsedMs` may
  never exceed `requestedDurationMs` (`invalid_elapsed`); because partial time is
  included in `elapsedResolvedMs`, a resume that would over-run the plan is
  rejected, and every accepted delta advances the clock by exactly
  `delta.elapsedAppliedMs` (no silent discard).
- **Validation order.** Plan and progress are validated on every call (both the
  schema-level validator and the plan-aware validator) before any resolution;
  mismatched `expeditionId` (`plan_progress_mismatch`) and foreign schema
  versions (rejected by validation as `invalid_progress`) are rejected before
  any time is applied. Terminal or zero-elapsed calls are no-ops **before** the
  duration bound is checked, so a terminal progress never throws for duration;
  negative/fractional/non-finite elapsed still throw on a terminal progress.
- **Status model.** `active` has `stopReason: null`; `completed` means
  `elapsedResolvedMs === requestedDurationMs` with `stopReason:
  "duration_reached"`; `stopped` has a non-null stop reason. A stop condition
  observed during resolution takes precedence over reaching the duration
  boundary. Terminal progress never carries a partial action. These invariants
  are enforced by the validator and asserted on every output in the property
  matrix.
- **Inventory.** An existing resource stack uses no slot; otherwise the stack
  requires one free slot. The capacity check runs **before** the award, so an
  overflow never produces an invalid award. The first award on a new stack
  increments `inventoryUsedSlots` by exactly one and sets
  `existingResourceStackPresent`; later awards consume no slot. A full inventory
  with no stack stops with `inventory_full` at the first gather completion, with
  zero resources awarded. A full inventory with an existing stack keeps
  gathering into the stack.
- **Food.** A single cumulative clock across gathering, combat and partial time:
  one unit is consumed at each multiple of `foodConsumptionIntervalMs` of
  elapsed time. An action that completes exactly on a boundary earns its outcome
  first, then the boundary consumes food. If food is unavailable at a crossed
  boundary the expedition stops with `food_exhausted` exactly at the boundary —
  never advancing past it and never taking food negative.
- **Health.** Never negative (clamped at zero). Encounters apply damage first,
  then the outcome: post-damage health above `minimumHealthToContinue` is a win
  (combat XP awarded), at or below it is a loss (no XP) and the expedition stops
  with `health_critical`. Every encounter is recorded exactly once, so
  `encountersWon + encountersLost === encounters` always. Progress earned before
  a losing encounter is preserved. An expedition started with already-critical
  health stops immediately with zero elapsed.
- **No mutation.** All inputs are validated then treated as immutable; the
  kernel clones the progress (fresh objects) before mutating a working copy.
  The caller's plan/progress are never modified and never returned by alias
  except in the no-op (zero/terminal) case.

## Legacy defect documentation

The legacy `expedition.ts` remains unmodified; these are the defects the kernel
designs around, recorded here for the audit trail:

- `startExpedition` generates expedition IDs from `Date.now()` and
  `Math.random()` (`exp-${Date.now()}-${...}`, `expedition.ts:23`) — the kernel
  never generates identities; IDs are injected in the plan.
- `resolveExpedition` mutates the passed `GameSave` and fabricates a fresh
  `claimId` containing `Date.now()` (`expedition.ts:128`), so a repeated call
  with identical input produces different output. The kernel is referentially
  pure and byte-for-byte repeatable.
- Constants are hardcoded in the legacy resolver (30s gathering window,
  150000ppm encounter chance, 15s combat, 120s food interval, 8–12 damage,
  retreat threshold 5); the kernel moves all of them into the injected
  `DeterministicExpeditionRules`, making behaviour data-driven and auditable.
- The legacy resolver always records a win for every encounter and checks
  health only at exactly zero; the kernel records win/loss correctly and stops
  at the configurable `minimumHealthToContinue`.

## Verification summary

- `pnpm --filter @everloom/core exec tsc --noEmit` — **exit 0**
- `pnpm --filter @everloom/core run build` (`tsc --noEmit`) — **exit 0**
- `pnpm --filter @everloom/core run test` — **5 files / 273 tests, exit 0**
  (new: 73 contract + 121 kernel; regression: 45 core + 22 expedition + 12 e2e —
  all legacy tests green, none skipped)
- Target run of the two new test files — **194 tests, exit 0**
- Property matrix: **10 fixed seeds × 5 durations (5s, 30s, 120s, 600s, 3600s) × 5 partition patterns** — every cell asserts chunked deep-equals one-shot and all invariants hold. No probabilistic assertions.
- Irregular partition suite: splits inside a gather, inside combat, exact food
  boundary, and 1 ms before/after food boundaries — each asserts chunked
  equals one-shot.
- Required equivalence shapes covered explicitly for 120,000 ms:
  `[120000]`, `[30000 x 4]`, `[10000 x 12]`, `[1, 29999, 15000, 45000, 30000]`.
- Six-defect coverage: partial-time-in-elapsed and exact delta (incl. a 20 s
  partial + 100 s request succeeding and a 20 s partial + 101 s request
  rejected), inventory stack creation and full-inventory stops, exact-threshold
  and lethal encounter losses with zero XP, food boundaries inside gathering,
  inside combat and inside partial actions with ±1 ms edge checks, terminal
  no-op before the duration rejection, and plan-aware validation through resolve
  for every invariant.
- JSON resumability: a progress surviving `JSON.stringify`/`JSON.parse`
  (including one carrying a partial action) continues resolving identically to
  the uninterrupted path.
- Full root verification (Turbo) and `git diff --check` recorded in
  `VERIFICATION_LOG.md`.

## Independent Auditor (Jules) Adversarial Hardening & Bounded Invariants Correction (2026-08-05)

An independent adversarial audit and subsequent corrective passes were completed by Jules on `2026-08-05`.
To remove $O(N)$ chronological history replay (`simulateUpTo`), we upgraded the schema to version `2` and introduced an explicit `initialState` snapshot in `DeterministicExpeditionProgress`.

After supervisor re-audit of the first O(1) pass (which was rejected for allowing impossible food clocks and lacking precise damage/combat/loss invariants), we completed a final corrective pass. The contract validator now enforces absolute bounded $O(1)$ algebraic invariants:
- Exact food consumption accounting (`foodConsumed` matches `boundaryCount` for active/completed progress, or `boundaryCount - 1` for inventory_full/health_critical action-outcome-first priority semantics exactly on food boundaries).
- Stopped food_exhausted progress states are strictly validated (isFoodBoundary, availableFood is 0, foodConsumed === initialState.availableFood, and boundaryCount === availableFood + 1).
- Damage is constrained to `encounters * enemyDamageMin <= damageTaken <= encounters * enemyDamageMax` with safe-integer protectors on all multiplication and sequence additions.
- Encounter loss semantics are validated (encountersLost is 0 or 1, and can only be 1 when stopped on health_critical with health <= minimumHealthToContinue). Zero-elapsed low starting health stops are fully supported.
- Terminal state and stopReason consistency is fully aligned (rejecting invalid inventory_full states, or activity_invalid completely).
- Combat time is accounted exactly (combatInterruptionMs is compared to encounters * combatDurationMs for terminal and active progress with partials, and includes strict food_exhausted incomplete combat residual bounds).

The test suite in `packages/core/src/expedition-adversarial.test.ts` was finalized with 24 robust tests verifying these safe, exact invariants. All 297 tests are green with zero skipped tests, and builds/typechecks are clean.

## State

- **GATE 6A FINAL BOUNDED-INVARIANT CORRECTION: COMPLETE**
- **GATE 6A ACCEPTANCE: PENDING INDEPENDENT SUPERVISOR RE-AUDIT**
- **FULL-HISTORY REPLAY: ABSENT**
- **GATE 4 BRANCH: UNTOUCHED**
- **GATE 5 BRANCH: UNTOUCHED**
- **RECEIPT/SAVE INTEGRATION: NOT STARTED**
- **RUNTIME/UI INTEGRATION: NOT STARTED**
- **MERGE: NOT PERFORMED**
