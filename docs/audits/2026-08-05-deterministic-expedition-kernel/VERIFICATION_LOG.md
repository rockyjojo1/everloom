# Verification Log — Gate 6A Deterministic Expedition Kernel

Date: 2026-08-05
Branch: `jules/gate6a-adversarial-hardening-11945358711948676083`
Base: `monkeycode/deterministic-expedition-kernel` @ `c8dc4f35f56316b01656cc21c74e963bb3ec493b`

All commands below were run from the repository root unless noted. Exit codes are the command's own.

## 1. Baseline before the corrective pass

```bash
git branch --show-current
  -> jules/gate6a-adversarial-hardening-11945358711948676083
git rev-parse HEAD
  -> 5ae8627d1ac74b645cb635452cdb8a00a104ba84
git status --short
  -> (clean)
```

## 2. Corrective implementation (Phase 4 Corrective Pass 4)

We resolved the two remaining O(1) action-time gaps without loops or historical action replay:
- **Active Progress Action-Time Accounting**: We enforce that active progress with elapsed time must have `partialAction !== null`, except when it sits exactly at a completed action boundary. We enforce:
  - `productiveGatheringMs === completedGatherings * rules.gatheringWindowMs + partialGatheringMs`
  - `combatInterruptionMs === encounters * rules.combatDurationMs + partialCombatMs`
- **Completed Progress Gathering Deficits**: We support exactly one shortened final completed gathering (only ending at `requestedDurationMs` of type gathering) and nominal-full-duration gatherings otherwise. We reject multiple deficits or non-matching deterministic sequences.
- **Health Critical Progress**: We enforce that positive-elapsed health_critical stops require all completed gatherings to be exactly full duration.
- **Food Exhausted Progress**:
  - If before plan end: enforce all completed gatherings are full duration plus `residualGatheringMs`.
  - If at plan end: enforce `residualCombatMs === 0`, `residualGatheringMs === 0`, and use completed progress all-full-or-one-short-final rule.

## 3. Targeted new-test runs

```bash
pnpm --filter @everloom/core exec vitest run src/expedition-adversarial.test.ts
  -> 1 file, 48 tests passed, exit 0
pnpm --filter @everloom/core exec vitest run src/expedition-contract.test.ts src/expedition-kernel.test.ts
  -> 2 files, 194 tests passed, exit 0
```

## 4. Full core regression suite

```bash
pnpm --filter @everloom/core run test
  -> 6 files, 321 tests passed, exit 0
     new:   expedition-adversarial.test.ts (48), expedition-contract.test.ts (73), expedition-kernel.test.ts (121)
     regr.: core.test.ts (45), expedition.test.ts (22), expedition-e2e.test.ts (12)
     legacy expedition/save tests unchanged and green; no tests skipped
```

## 5. Type checks and build

```bash
pnpm --filter @everloom/core run typecheck
  -> exit 0
pnpm typecheck                                    (root, turbo)
  -> Tasks: 13 successful, 13 total (8 cached); exit 0
pnpm build                                        (root, turbo)
  -> Tasks: 8 successful, 8 total (7 cached); exit 0
```

## 6. Property matrix and equivalence coverage (inside the 121 kernel tests)

`10 seeds x 5 durations x 5 partition patterns`:
- Seeds: `seed-a` … `seed-j` (fixed).
- Durations (ms): `5000, 30000, 120000, 600000, 3600000`.
- Partition patterns (each sums exactly to its duration):
  `single`, `halves`, `quarters`, `twelfths`, `sawtooth`.
- Every cell asserts: chunked progress `toEqual` one-shot progress, and all invariants hold.

## 7. Determinism and resumability

- Identical input -> byte-identical output (deep-equal progress and delta).
- `JSON.stringify` -> `JSON.parse` round-trip continues resolving identically to the uninterrupted path, including when the progress carries a partial action at the moment of serialization.
- No-op guarantees: zero elapsed and terminal progress return the input object with an all-zero delta.

## 8. Repository hygiene

Only the specified files are modified:
- `packages/core/src/expedition-contract.ts`
- `packages/core/src/expedition-contract.test.ts` (none)
- `packages/core/src/expedition-adversarial.test.ts`
- `docs/audits/2026-08-05-deterministic-expedition-kernel/*`
No other core legacy files or locked paths modified. No prohibited ambient APIs used.
