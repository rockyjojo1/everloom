# Verification Log — Gate 6A Deterministic Expedition Kernel

Date: 2026-08-05
Branch: `monkeycode/deterministic-expedition-kernel`
Base: `claude/canonical-asset-foundation` @ `f38b670f435c059edee91a47876c78c5004adce6`
First commit: `e2df0ff2578dea98134ec563ce9551f799a67ee2` (rejected by supervisor; this log covers the corrective second pass)

All commands below were run from the repository root unless noted. Exit codes
are the command's own.

## 1. Baseline before the corrective pass

```
git branch --show-current
  -> monkeycode/deterministic-expedition-kernel
git rev-parse HEAD
  -> e2df0ff2578dea98134ec563ce9551f799a67ee2 (first commit, tracked by origin)
git status --short
  -> (clean)
```

## 2. Corrective implementation (second pass)

- `packages/core/src/expedition-contract.ts`: added the plan-aware validator
  `validateDeterministicExpeditionProgressAgainstPlan` (code `invalid_progress`).
- `packages/core/src/expedition-kernel.ts`: rewritten for the six corrected
  semantics (partial time in `elapsedResolvedMs`; inventory stack mutation;
  encounter win/loss; cumulative food clock; terminal no-op before the duration
  rejection; plan-aware validation on every resolve).
- While re-testing the corrected time model the kernel was found to lose an
  in-flight action when a food boundary was crossed mid-action, causing a
  chunked-vs-one-shot divergence. The loop was fixed to hold the current
  action's identity across iterations; the property matrix and irregular
  partition suite now pass.

## 3. Targeted new-test runs

```
pnpm --filter @everloom/core exec vitest run src/expedition-kernel.test.ts
  -> 1 file, 121 tests passed, exit 0
pnpm --filter @everloom/core exec vitest run src/expedition-contract.test.ts
  -> 1 file, 73 tests passed, exit 0
```

## 4. Full core regression suite

```
pnpm --filter @everloom/core run test
  -> 5 files, 273 tests passed, exit 0
     new:   expedition-contract.test.ts (73), expedition-kernel.test.ts (121)
     regr.: core.test.ts (45), expedition.test.ts (22), expedition-e2e.test.ts (12)
     legacy expedition/save tests unchanged and green; no tests skipped
```

## 5. Type checks and build

```
pnpm --filter @everloom/core exec tsc --noEmit
  -> exit 0
pnpm typecheck                                    (root, turbo)
  -> Tasks: 13 successful, 13 total (8 cached); exit 0
     WARNING "no output files found for task @everloom/{content,core}#build"
     (pre-existing turbo config note, not an error)
pnpm build                                        (root, turbo)
  -> Tasks: 8 successful, 8 total (7 cached); exit 0
     game bundle 329.0 KiB / 400 KiB budget; PWA sw generated
```

Note: the root `pnpm build` can regenerate
`packages/assets/src/catalog.generated.json` (byte sizes for a handful of
`kaykit-skeletons` `.gltf` entries differ from the committed file). This is a
pre-existing generated-artifact drift, unrelated to this branch; it was checked
after the build in this pass and `git status --short` reported no such change.
`packages/assets/**` remains untouched in the committed change set.

## 6. Property matrix and equivalence coverage (inside the 121 kernel tests)

`10 seeds x 5 durations x 5 partition patterns`:

- Seeds: `seed-a` … `seed-j` (fixed).
- Durations (ms): `5000, 30000, 120000, 600000, 3600000`.
- Partition patterns (each sums exactly to its duration):
  `single`, `halves`, `quarters`, `twelfths`, `sawtooth`
  (`[1,999,5000,13000,27000,2,500,4000,...]` repeating, clamped to remainder).
- Every cell asserts: chunked progress `toEqual` one-shot progress, and all
  invariants hold (elapsed <= requestedDurationMs, health >= 0, food >= 0,
  foodConsumed + availableFood == starting food, won + lost == encounters,
  productive + combat == elapsed, slot limits, status/stopReason consistency,
  no partial on terminal progress).

Irregular partition suite (chunked == one-shot for each):
- split inside a gathering (`[14000,16000,30000,60000]`)
- split inside an encounter (`[7000,8000,15000,30000,60000]`)
- exact food boundary (`[60000,60000]`)
- 1 ms before a boundary (`[59999,1,60000]`)
- 1 ms after a boundary (`[60001,59999]`)

Required equivalence shapes covered explicitly for 120,000 ms:
`[120000]`, `[30000 x 4]`, `[10000 x 12]`, `[1, 29999, 15000, 45000, 30000]`.

## 7. Six-defect coverage (spot assertions)

- Time model: 20 s partial + 100 s request succeeds with `delta.elapsedAppliedMs`
  exactly 100,000; 20 s partial + 101 s request throws `invalid_elapsed`;
  final 10 s of a partial applies exactly 10,000; chunk deltas sum to the total
  requested (no silent discard); elapsed never exceeds the duration.
- Inventory: 17/18 no stack -> first gather creates the stack (18, stack true)
  and later awards stay at 18; 18/18 no stack -> `inventory_full` at the first
  gather completion with zero awards; 18/18 with stack -> keeps gathering.
- Encounters: survive -> win with combat XP; exact threshold (health lands on
  `minimumHealthToContinue`) -> loss with zero XP; lethal -> loss with zero XP;
  pre-defeat progress preserved; won + lost == encounters on every outcome.
- Food: boundaries inside a gather, inside combat (non-aligned interval), and
  inside a partial action (`5000 + 4999 + 1 + 1`), exact boundary with
  action-outcome-first ordering, 1 ms before/after a boundary, multiple
  boundaries, zero food, cumulative clock across gathering and combat.
- Terminal no-op: completed/stopped progress returns the input unchanged for any
  further non-negative elapsed (no duration error); negative elapsed still
  throws on a terminal progress.
- Plan-aware validation through resolve: each corrupted-progress invariant
  (elapsed over duration, terminal + partial, partial sequence mismatch,
  partial bounds, slot overflow, won/lost/encounters mismatch, completed wrong
  duration, active at duration, time-bucket mismatch, resources without stack,
  stack without slot) throws `invalid_progress`; a valid partial-carrying
  progress still resolves.

## 8. Determinism and resumability

- Identical input -> byte-identical output (deep-equal progress and delta).
- `JSON.stringify` -> `JSON.parse` round-trip continues resolving identically
  to the uninterrupted path, including when the progress carries a partial
  action at the moment of serialization.
- No-op guarantees: zero elapsed and terminal progress return the input object
  with an all-zero delta.
- Input immutability: `Object.freeze`d plan/starting-state/progress (including a
  progress carrying a partial action) resolve correctly and are never mutated;
  resolved progress is a fresh object.

## 9. Repository hygiene

```
git diff --check
  -> exit 0
git status --short
  ->  M packages/core/src/expedition-contract.test.ts
     M packages/core/src/expedition-contract.ts
     M packages/core/src/expedition-kernel.test.ts
     M packages/core/src/expedition-kernel.ts
git status --short pnpm-lock.yaml
  -> empty (unchanged)
protected-path grep over `apps/**`, `docs/authority/**`,
`docs/audits/2026-08-04-*/**`, `packages/assets/**`, `packages/content/**`,
`packages/engine/**`, `packages/gamedata/**`, `art-direction/**`,
`artifacts/**`, `vercel.json`, and the legacy core modules
(`expedition.ts`, `expedition.test.ts`, `save.ts`, `save.test.ts`, `types.ts`,
`simulation.ts`, `simulation.test.ts`, `rng.ts`)
  -> NONE (clean)
```

## 10. Branch state

```
git branch --show-current
  -> monkeycode/deterministic-expedition-kernel
git rev-parse HEAD
  -> e2df0ff2578dea98134ec563ce9551f799a67ee2 (first commit at log time;
     corrective pass is the next commit, pushed for independent audit)
```

## 11. Legacy modules untouched

`packages/core/src/expedition.ts`, `expedition.test.ts`, `save.ts`,
`save.test.ts`, `types.ts`, `simulation.ts`, `simulation.test.ts`, `rng.ts`
were read as references and **not modified**. Gate 4 branch
`claude/meadowrest-production-room-bakeoff` was not touched.

## 12. Independent Jules Hardening Pass (2026-08-05)

- **Targeted Test Execution**: `pnpm --filter @everloom/core exec vitest run src/expedition-adversarial.test.ts src/expedition-contract.test.ts src/expedition-kernel.test.ts`
  - 216 tests passed, exit 0
- **Full Test Suite Execution**: `pnpm --filter @everloom/core run test`
  - 6 files, 301 tests passed, exit 0
- **Workspace Verification**:
  - `pnpm typecheck` -> exit 0
  - `pnpm build` -> exit 0
- **Git Tree Status**: Clean tree, modified files strictly match the ownership guidelines (only `expedition-contract.ts`, `expedition-kernel.ts`, `expedition-contract.test.ts`, `expedition-kernel.test.ts`, `expedition-adversarial.test.ts` changed).
- **Prohibited Ambient APIs Scan**: Run mechanical scan on changed production source, verified 100% clean (Date, Math.random, performance, fetch, storage patterns absent from executable code blocks).

## 14. Independent Jules Bounded-Invariants Corrective Pass 2 (2026-08-05)

Following supervisor rejection of the first O(1) pass for allowing impossible food clocks and lacking precise damage/combat/loss invariants, we performed a final corrective implementation on the same branch:
- **Food Semantics**: Upgraded to exact food consumption matching boundary counts or priority offsets on food boundary action completions. Verified exact `food_exhausted` conditions.
- **Damage & Losses**: Enforced min/max enemy damage range and strict `encountersLost` checks (encountersLost <= 1, must be 1 on health critical stop after positive elapsed).
- **Combat Time Accounting**: Compared `combatInterruptionMs` exactly to completed combat times, plus active partial combat duration, and validated food exhaustion incomplete combat residual bounds.
- **Verification Results**:
  - **Targeted Test Execution**: `pnpm --filter @everloom/core exec vitest run src/expedition-adversarial.test.ts src/expedition-contract.test.ts src/expedition-kernel.test.ts`
    - 218 tests passed, exit 0
  - **Full Test Suite Execution**: `pnpm --filter @everloom/core run test`
    - 6 files, 297 tests passed, exit 0 (none skipped)
  - **Workspace typechecks/builds**:
    - `pnpm typecheck` -> exit 0
    - `pnpm build` -> exit 0
- **Scaling Evidence**: Bounded validator code contains 0 loops (`for`, `while`) or chronological simulator calls.

## 13. Independent Jules Corrective Hardening Pass (2026-08-05)

Following supervisor rejection of the initial O(N) full history simulation design (SHA `8b0a329`), we performed a corrective implementation on the same branch:
- **Design Refactoring**: Completely removed `simulateUpTo` and historical chronological loops from contract validation. Upgraded schema version to `2` and introduced an explicit starting state copy `initialState: DeterministicExpeditionStartingState` inside the progress cursor.
- **Bounded O(1) Validation**: Implemented strict, instant algebraic invariants linking initialState snapshot, current counters, and only the current active partial action.
- **Verification Results**:
  - **Targeted Test Execution**: `pnpm --filter @everloom/core exec vitest run src/expedition-adversarial.test.ts src/expedition-contract.test.ts src/expedition-kernel.test.ts`
    - 213 tests passed, exit 0
  - **Full Test Suite Execution**: `pnpm --filter @everloom/core run test`
    - 6 files, 292 tests passed, exit 0 (none skipped)
  - **Workspace typechecks/builds**:
    - `pnpm typecheck` -> exit 0
    - `pnpm build` -> exit 0
- **Scaling Evidence**: Bounded validator code contains 0 loops (`for`, `while`) or chronological simulator calls.
