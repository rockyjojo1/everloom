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
  -> f5ce8f5f8275018bf5419061e8cdc974b42c86fd
git status --short
  -> (clean)
```

## 2. Corrective implementation (Phase 4 Corrective Pass 5 - `5041606fa28d5b69285398c75d5a4ed835373f88`)

We resolved the zero-elapsed `health_critical` stopped progress rewards-forge defect without chronological action replay or loops:
- Enforce strict no-action/no-reward constraints for `elapsedResolvedMs === 0` under `health_critical` stops.
- Validate that all reward, sequence, combat, productive, food counters, damage Taken, and health values remain strictly unchanged and matched to initial state values.
- Verify `initialState.startingHealth <= rules.minimumHealthToContinue`.
- *Note*: The requested two-commit implementation/evidence split was not produced, no separate implementation commit exists remotely, and this follow-up is a documentation-only correction.

## 3. Targeted new-test runs

Core tests were run locally in the Jules environment. Exact-final-SHA core GitHub Actions CI is not configured or not available, though Vercel is set up as a separate exact-SHA check and passed on 5041606.

```bash
pnpm --filter @everloom/core exec vitest run src/expedition-adversarial.test.ts
  -> 1 file, 51 tests passed, exit 0
pnpm --filter @everloom/core exec vitest run src/expedition-contract.test.ts src/expedition-kernel.test.ts
  -> 2 files, 194 tests passed, exit 0
```

## 4. Full core regression suite

```bash
pnpm --filter @everloom/core run test
  -> 6 files, 324 tests passed, exit 0
     new:   expedition-adversarial.test.ts (51), expedition-contract.test.ts (73), expedition-kernel.test.ts (121)
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
