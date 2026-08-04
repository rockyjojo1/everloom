# Verification Log — Gate 6A Deterministic Expedition Kernel

Date: 2026-08-05
Branch: `monkeycode/deterministic-expedition-kernel`
Base: `origin/claude/canonical-asset-foundation` @ `f38b670f435c059edee91a47876c78c5004adce6`

All commands below were run from the repository root unless noted. Exit codes
are the command's own.

## 1. Baseline before implementation

```
git fetch origin
git rev-parse origin/claude/canonical-asset-foundation
  -> f38b670f435c059edee91a47876c78c5004adce6
git status --short
  -> (clean)
pnpm install --prefer-offline
  -> done in 37s, 618 packages
git status --short pnpm-lock.yaml
  -> empty (lockfile unchanged)
pnpm --filter @everloom/core run test   (baseline)
  -> 3 files, 79 tests, exit 0
```

## 2. Type checks and build

```
pnpm --filter @everloom/core exec tsc --noEmit
  -> exit 0
pnpm --filter @everloom/core run build
  -> exit 0 (tsc --noEmit)
pnpm typecheck                                    (root, turbo)
  -> Tasks: 13 successful, 13 total; exit 0
     WARNING "no output files found for task @everloom/{assets,content,core}#build"
     (pre-existing turbo config note, not an error)
pnpm build                                        (root, turbo)
  -> Tasks: 8 successful, 8 total (3 cached); exit 0
     game bundle 329.0 KiB / 400 KiB budget; PWA sw generated
```

Note: the root `pnpm build` regenerates
`packages/assets/src/catalog.generated.json` (byte sizes for a handful of
`kaykit-skeletons` `.gltf` entries differ from the committed file). This is a
pre-existing generated-artifact drift, unrelated to this branch; the file was
reverted to its committed state with `git checkout --` and is not part of this
branch's diff. `packages/assets/**` remains untouched in the committed change
set.

## 3. Targeted new-test runs

```
pnpm --filter @everloom/core exec vitest run src/expedition-contract.test.ts src/expedition-kernel.test.ts
  -> 2 files, 134 tests passed, exit 0
```

## 4. Full core regression suite

```
pnpm --filter @everloom/core run test
  -> 5 files, 213 tests passed, exit 0
     new:   expedition-contract.test.ts (59), expedition-kernel.test.ts (75)
     regr.: core.test.ts (45), expedition.test.ts (22), expedition-e2e.test.ts (12)
```

## 5. Property matrix coverage (inside the 75 kernel tests)

`10 seeds x 5 durations x 5 partition patterns`:

- Seeds: `seed-a` … `seed-j` (fixed).
- Durations (ms): `5000, 30000, 120000, 600000, 3600000`.
- Partition patterns (each sums exactly to its duration):
  `single`, `halves`, `quarters`, `twelfths`, `sawtooth`
  (`[1,999,5000,13000,27000,2,500,4000,...]` repeating, clamped to remainder).
- Every cell asserts: chunked progress `toEqual` one-shot progress, and all
  invariants hold (elapsed <= requestedDurationMs, health >= 0, food >= 0,
  foodConsumed + availableFood == starting food, won + lost == encounters,
  status/stopReason consistency).

Required equivalence shapes covered explicitly for 120,000 ms:
`[120000]`, `[30000 x 4]`, `[10000 x 12]`, `[1, 29999, 15000, 45000, 30000]`.

## 6. Determinism and resumability

- Identical input -> byte-identical output (deep-equal progress and delta).
- `JSON.stringify` -> `JSON.parse` round-trip continues resolving identically
  to the uninterrupted path.
- No-op guarantees: zero elapsed and terminal progress return the input object
  with an all-zero delta; positive elapsed beyond the requested duration throws
  `invalid_elapsed`.
- Input immutability: `Object.freeze`d plan/starting-state/progress resolve
  correctly and are never mutated; resolved progress is a fresh object.

## 7. Repository hygiene

```
git diff --check
  -> exit 0
git status --short
  ->  M packages/core/src/index.ts
     ?? docs/audits/2026-08-05-deterministic-expedition-kernel/
     ?? packages/core/src/expedition-contract.ts
     ?? packages/core/src/expedition-contract.test.ts
     ?? packages/core/src/expedition-kernel.ts
     ?? packages/core/src/expedition-kernel.test.ts
git status --short pnpm-lock.yaml
  -> empty (unchanged)
protected-path grep over `apps/**`, `docs/authority/**`,
`docs/audits/2026-08-04-*/**`, `packages/assets/**`, `packages/content/**`,
`packages/engine/**`, `packages/gamedata/**`, `art-direction/**`,
`artifacts/**`, `vercel.json`
  -> NONE (clean)
```

## 8. Branch state

```
git branch --show-current
  -> monkeycode/deterministic-expedition-kernel
git rev-parse HEAD
  -> f38b670f435c059edee91a47876c78c5004adce6 (base; changes uncommitted at log time)
```

## 9. Legacy modules untouched

`packages/core/src/expedition.ts`, `expedition.test.ts`, `save.ts`,
`save.test.ts`, `types.ts`, `simulation.ts`, `simulation.test.ts`, `rng.ts`
were read as references and **not modified**. Gate 4 branch
`claude/meadowrest-production-room-bakeoff` was not touched.
