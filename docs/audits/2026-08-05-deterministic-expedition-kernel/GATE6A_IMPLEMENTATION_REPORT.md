# Gate 6A: Deterministic Expedition Resolution Kernel — Implementation Report

Date: 2026-08-05
Branch: `monkeycode/deterministic-expedition-kernel`
Base: `claude/canonical-asset-foundation` at `f38b670f435c059edee91a47876c78c5004adce6` (verified present via `git fetch origin` before branching)

This is an implementation report for the MONKEYCODE Gate 6A task: build a pure,
deterministic expedition-resolution kernel in `packages/core`, isolated from the
legacy expedition/save modules. It records what was built, the exact semantics,
how it was verified, and what is deliberately out of scope. The separate
`VERIFICATION_LOG.md` in this directory records every command that was run and
its exact exit status.

## Scope and protected paths

Only the following files were created or modified:

| File | Change |
|---|---|
| `packages/core/src/expedition-contract.ts` | **Created** — schema, types, stable validation, error class/codes |
| `packages/core/src/expedition-kernel.ts` | **Created** — pure resolution kernel |
| `packages/core/src/expedition-contract.test.ts` | **Created** — contract/validation tests (59 tests) |
| `packages/core/src/expedition-kernel.test.ts` | **Created** — kernel semantics + property matrix (75 tests) |
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
   `DeterministicExpeditionDelta`, `DeterministicExpeditionResolution`), the
   stable error class `DeterministicExpeditionError` with typed codes, and the
   validation functions. No resolution logic lives here.
2. **`expedition-kernel.ts`** owns the two entry points
   `createDeterministicExpeditionProgress(plan, startingState)` and
   `resolveDeterministicExpedition(plan, currentProgress, requestedElapsedMs)`.

RNG is sourced exclusively from the existing `rng.ts` helpers
(`deterministicRollPpm`, `deterministicRange`), reusing the legacy hash
namespaces (`expedition_encounter`, `wolf_damage`) so that the same seed
consumes the same stream shape as the legacy resolver. No new randomness, no
ambient time, no ID generation anywhere in the kernel.

## Time model and chunked continuity

`elapsedResolvedMs` advances only when a full action commits. An action that
spans a chunk boundary is carried in `progress.partialAction` as
`{ kind, actionSequence, elapsedInActionMs }`:

- `actionSequence` pins the RNG stream (the encounter roll and damage roll were
  consumed exactly once when the action was scheduled, and are re-derived from
  the pinned sequence on resume — the action never re-rolls).
- `elapsedInActionMs` records how much of the action was already consumed by
  previous chunks' budgets.
- On completion the full action duration is committed to `elapsedResolvedMs`
  and `nextActionSequence` advances by exactly one — identical to the one-shot
  path.

This guarantees **one-shot == chunked**: resolving a total elapsed time in one
call produces the identical progress as resolving it as any sequence of
partitions summing to the same total. It is the same resolver for the online
(incremental) and offline (catch-up on login) paths; callers differ only in the
size of `requestedElapsedMs` they pass.

## Semantics (fixed, deterministic)

- **Elapsed.** `requestedElapsedMs` must be a non-negative safe integer;
  anything else (negative, fractional, `NaN`, infinities) throws
  `invalid_elapsed`. A zero-elapsed call is a pure no-op returning the input
  object and an all-zero delta. `elapsedResolvedMs + requestedElapsedMs` may
  never exceed `requestedDurationMs` (`invalid_elapsed`).
- **Validation order.** Plan and progress are validated on every call before
  any resolution; mismatched `expeditionId` (`plan_progress_mismatch`) and
  foreign schema versions (rejected by validation as `invalid_progress`;
  `schema_mismatch` is kept as a defensive guard) are rejected before any
  time is applied. Terminal or zero-elapsed calls never throw for duration.
- **Status model.** `active` has `stopReason: null`; `completed` means
  `elapsedResolvedMs === requestedDurationMs` with `stopReason:
  "duration_reached"`; `stopped` has a non-null stop reason. A stop condition
  observed during resolution takes precedence over reaching the duration
  boundary. These invariants are enforced both by the validator and asserted
  on every output in the property matrix.
- **Inventory.** An existing resource stack uses no slot; otherwise the stack
  requires one free slot. The capacity check runs **before** the award, so an
  overflow never produces an invalid award: the final overflow gather is not
  awarded and the expedition stops with `inventory_full` at
  `elapsedResolvedMs === 0` when the very first gather cannot fit.
- **Food.** A single cumulative clock; the number of units needed to cross
  `foodConsumptionIntervalMs` boundaries in a completed gathering window is
  consumed from `availableFood`, which is clamped so it never goes negative.
  Insufficient food stops with `food_exhausted` (gather still committed).
- **Health.** Never negative (clamped). After each encounter, if health is at
  or below `minimumHealthToContinue`, the expedition stops with
  `health_critical`. An expedition started with already-critical health stops
  immediately with zero elapsed. Every encounter is resolved as a win
  (matching the legacy resolver's bookkeeping), so
  `encountersWon + encountersLost === encounters` always.
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
  health only at exactly zero; the kernel surfaces the same bookkeeping
  invariants and stops at the configurable `minimumHealthToContinue`.

## Verification summary

- `pnpm --filter @everloom/core exec tsc --noEmit` — **exit 0**
- `pnpm --filter @everloom/core run build` (`tsc --noEmit`) — **exit 0**
- `pnpm --filter @everloom/core run test` — **5 files / 213 tests, exit 0**
  (new: 59 contract + 75 kernel; regression: 45 core + 22 expedition + 12 e2e)
- `pnpm --filter @everloom/core exec vitest run src/expedition-contract.test.ts src/expedition-kernel.test.ts` — **134 tests, exit 0**
- Property matrix: **10 fixed seeds × 5 durations (5s, 30s, 120s, 600s, 3600s) × 5 partition patterns** — every cell asserts chunked deep-equals one-shot and all invariants hold. No probabilistic assertions.
- Required equivalence shapes covered explicitly: 120,000 ms one-shot vs 30,000×4, 10,000×12, and `1 + 29,999 + 15,000 + 45,000 + remainder`.
- JSON resumability: a progress surviving `JSON.stringify`/`JSON.parse` continues resolving identically to the uninterrupted path.
- Full root verification (Turbo) and `git diff --check` recorded in `VERIFICATION_LOG.md`.

## State

- **GATE 6A IMPLEMENTATION: COMPLETE**
- **GATE 6A ACCEPTANCE: PENDING INDEPENDENT SUPERVISOR AUDIT**
- **GATE 4 BRANCH: UNTOUCHED**
- **RECEIPT/SAVE INTEGRATION: NOT STARTED**
- **RUNTIME/UI INTEGRATION: NOT STARTED**
