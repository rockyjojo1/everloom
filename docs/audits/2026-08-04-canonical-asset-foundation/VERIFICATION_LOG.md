# Verification Log — Gate 3 Canonical Asset Foundation

Last reviewed: 2026-08-04
Implementation worktree: `D:\Downloads\Everloom-claude-canonical-assets`
Branch: `claude/canonical-asset-foundation`, based on Gate 2 `8b812f862e5e201b3650132db628669c27d60c62`

## 1. Migration integrity

```
node scratch_premigration.mjs   -> 569 entries, 31156985 bytes
  byExtension: {glb:541, bin:13, gltf:13, png:2}
  byPack: {kaykit-adventurers:1, kaykit-dungeon:40, kaykit-skeletons:31,
           kenney-fantasy:168, kenney-nature:329}

git mv apps/client3d/public/models packages/assets/models
git status --short | grep -c "^R "     -> 569
git diff --cached --summary | grep -c "rename"   -> 569 (all "(100%)")
test -d apps/client3d/public/models    -> ABSENT (confirmed gone)
find packages/assets/models -type f | wc -l      -> 569

node scratch_postmigration_verify.mjs  -> Checked 569 of 569 expected files.
                                           Mismatches: 0

git lfs ls-files                        -> 0 lines before and after (no LFS in use)
```

(`scratch_premigration.mjs`/`scratch_postmigration_verify.mjs` were
temporary verification scripts, deleted after use — not part of the
committed diff. Their hashing logic is preserved permanently as the
full-library scan inside `validateModels()`.)

Evidence documents:
```
git mv apps/client3d/CREDITS.md packages/assets/sources/CREDITS.md
git mv apps/client3d/ASSET_INVENTORY.md packages/assets/sources/ASSET_INVENTORY.md
git mv apps/client3d/ANIMATION_CLIPS.md packages/assets/sources/ANIMATION_CLIPS.md
git status --short | grep "CREDITS\|ASSET_INVENTORY\|ANIMATION_CLIPS"
  -> R  apps/client3d/ANIMATION_CLIPS.md -> packages/assets/sources/ANIMATION_CLIPS.md
     R  apps/client3d/ASSET_INVENTORY.md -> packages/assets/sources/ASSET_INVENTORY.md
     R  apps/client3d/CREDITS.md -> packages/assets/sources/CREDITS.md
```

## 2. Shared path contract

```
node -e "import('./packages/assets/paths.mjs').then(m => {...})"
  -> MODEL_ROOT: .../packages/assets/models
     MODEL_ROOT_RELATIVE: packages/assets/models
     REPOSITORY_ROOT: <worktree root>
     resolveModelPath("kenney-nature/tree_oak.glb") resolved correctly
     resolveModelPath("../../../etc/passwd") -> threw "escapes the canonical model root" (correct)

pnpm --filter @everloom/game run typecheck    exit 0
pnpm --filter @everloom/client3d run typecheck  exit 0
git status --short pnpm-lock.yaml              -> empty (unchanged)
```

## 3. Asset catalogue and validators (against real repository data)

```
node packages/assets/scripts/build-catalog.mjs
  -> Wrote 554 model records to packages/assets/src/catalog.generated.json
sha256sum packages/assets/src/catalog.generated.json  (run 1)
node packages/assets/scripts/build-catalog.mjs         (run again, no repo changes)
sha256sum packages/assets/src/catalog.generated.json  (run 2)
  -> identical hash both runs (byte-for-byte determinism confirmed manually,
     also covered by catalog-determinism.test.mjs)

node packages/assets/scripts/validate-assets.mjs
  -> Validated 72 semantic assets and 554 catalog models.
  exit 0

node packages/assets/scripts/validate-models.mjs
  -> Intentional semantic reuse (one file, multiple runtime IDs): 1
       kenney-nature/stone_tallA.glb -> nature.stone-tall, landmark.verdant-loomstone
  -> Validated 47 file-backed registered models across 569 files in the canonical library.
  -> 0 warning(s).
  exit 0

node packages/assets/scripts/validate-sources.mjs
  -> Checked 8 source records, 80 manifest currentAssetId references, 56 manifest file-backed source paths.
  -> WARNINGS (1): lpc-legacy-sprites: evidenceStatus is repository_claim_only ...
  exit 0

node art-direction/scripts/validate-source-paths.mjs
  -> All 64 approved-existing entries have valid source paths
  exit 0
  (run with NO prior apps/client3d build in this worktree at the time — first proof point for B1)

node art-direction/scripts/validate-visual-production-manifest.mjs
  -> 121 warnings, exit 0 (unchanged count from Gate 2)

node art-direction/scripts/validate-visual-production-integration.test.mjs
  -> tests 5, pass 5, fail 0
```

## 4. packages/assets test suite

```
node --test "packages/assets/**/*.test.mjs"
  -> tests 65, pass 65, fail 0
     (gltf-parser.test.mjs: 15, validate-models.test.mjs: 15,
      validate-sources.test.mjs: 14, inspect.test.mjs: 11,
      paths.test.mjs: 6, catalog-determinism.test.mjs: 4)

pnpm --filter @everloom/assets run test       exit 0, 65/65
pnpm --filter @everloom/assets run verify     exit 0 (catalog + validate + validate:models +
                                                        validate:sources + test + tsc --noEmit)
pnpm --filter @everloom/assets run build      exit 0
pnpm --filter @everloom/assets run inspect -- player.adventurer
  -> full human-readable detail printed correctly (fixed a pnpm "--" passthrough
     bug found during this step: pnpm run <script> -- <args> did not always
     strip the literal "--" token before invoking the script; inspect.mjs's
     arg parser now tolerates a stray "--" defensively)
```

## 5. apps/game

```
pnpm --filter @everloom/game run typecheck    exit 0
pnpm --filter @everloom/game run test         (vitest run src)
  -> 4 files, 30 tests passed (25 pre-existing + 5 new in modelDelivery.test.ts)
  (one TS strict-mode fix required: noUncheckedIndexedAccess made
   ASSET_REGISTRY["id"] possibly undefined; added non-null assertions on the
   three known-present lookups in the new test file)

pnpm --filter @everloom/game run build
  -> tsc clean, vite build succeeded, bundle 329.0 KiB / 400 KiB budget (unchanged)
  -> apps/game/dist/models: 569 files present
  -> sha256sum apps/game/dist/models/kaykit-adventurers/Character.glb matches
     packages/assets/models/kaykit-adventurers/Character.glb exactly

pnpm --filter @everloom/game run verify:gate0     exit 0, all 5/5 stages passed
pnpm --filter @everloom/game run verify:visual-foundation   exit 0, all 15/15 stages passed
  -> BASELINE STATUS: PENDING, 0/10 captured (unchanged, truthful)

cd apps/game && pnpm exec playwright test --list
  -> 74 tests in 15 files (Gate 2 baseline was 72/14 — confirms the new
     model-delivery-smoke.spec.ts is a genuine addition)
pnpm exec playwright test model-delivery-smoke.spec.ts --project=desktop
  -> 1 passed
```

## 6. apps/client3d

```
pnpm --filter @everloom/client3d run typecheck   exit 0
pnpm --filter @everloom/client3d run test
  -> node --test scripts/*.test.mjs : tests 2, pass 2, fail 0
pnpm --filter @everloom/client3d run build
  -> tsc clean, vite build succeeded (pre-existing >500kB chunk warning, unrelated)
  -> apps/client3d/dist/models: 569 files present
  -> sha256sum apps/client3d/dist/models/kaykit-skeletons/Skeleton_Warrior.glb
     matches packages/assets/models/kaykit-skeletons/Skeleton_Warrior.glb exactly
```

## 7. Root

```
pnpm build
  -> Tasks: 8 successful, 8 total
  -> @everloom/content:build test stage: 29 passed
  -> @everloom/game:build bundle 329.0 KiB / 400 KiB
  -> two pre-existing informational Turbo "no output files" warnings
     (@everloom/assets#build, @everloom/content#build) — unrelated to this
     pass, turbo.json `outputs` configuration gap for packages with no
     `dist/` output, not touched (out of narrow scope for this task)
```

## 8. Fresh-worktree reproducibility (Phase 13)

Commit tested: `039b4896e77d896e66fbc0c4e982dd0d8d614021`. Disposable
worktree: `D:\Downloads\Everloom-gate3-disposable-verify` (removed after
this run).

```
git worktree add --detach D:\Downloads\Everloom-gate3-disposable-verify 039b4896e77d896e66fbc0c4e982dd0d8d614021
  -> Preparing worktree (detached HEAD 039b489)

test -d apps/client3d/dist          -> ABSENT
test -d apps/game/dist              -> ABSENT
find . -iname models -path "*public*"  -> (no results)
git status --short                  -> (empty)

pnpm install --frozen-lockfile
  -> Packages: +619, downloaded 0, Done in 22s
git status --short pnpm-lock.yaml   -> (empty, unchanged)

test -d apps/client3d/dist          -> ABSENT (confirmed again, immediately before the critical run)

pnpm --filter @everloom/game run verify:visual-foundation
  -> All 15 verification stages PASSED
  -> BASELINE STATUS: PENDING, 0/10 captured
  exit 0

test -d apps/client3d/dist          -> STILL ABSENT (confirmed immediately after the 15-stage
                                        run completed; proves stage 6/15, the source-path
                                        validator, never depended on this directory existing)

pnpm --filter @everloom/assets run verify   -> 65/65 tests, 0 errors, exit 0

pnpm --filter @everloom/client3d run test
  -> node --test scripts/*.test.mjs : tests 2, pass 2, fail 0

pnpm --filter @everloom/client3d run build
  -> tsc clean, vite build succeeded
find apps/game/dist/models -type f | wc -l       -> 569
find apps/client3d/dist/models -type f | wc -l   -> 569
sha256sum apps/game/dist/models/kaykit-adventurers/Character.glb \
          packages/assets/models/kaykit-adventurers/Character.glb
  -> 60428e3abc09ba83e595d256e3af8c5c976b46cdae599f0802fc82b4a3445168 (both, identical)
sha256sum apps/client3d/dist/models/kenney-nature/tree_oak.glb \
          packages/assets/models/kenney-nature/tree_oak.glb
  -> d7fd8773674928c50c11b66d12c636d49bdcc15a8b1c7fbb98e6f63a3439a3f3 (both, identical)

pnpm --filter @everloom/game run verify:gate0   -> all five checks exited 0

pnpm build (root)
  -> Tasks: 8 successful, 8 total
  -> two pre-existing informational Turbo warnings (unrelated, unchanged)

sha256sum packages/assets/src/catalog.generated.json (before regenerating)
  -> d45bfcd7cfa01e26191e94d79ef2d93232070931a0183fff2ce2fa081c29702f
node packages/assets/scripts/build-catalog.mjs
  -> Wrote 554 model records
sha256sum packages/assets/src/catalog.generated.json (after)
  -> d45bfcd7cfa01e26191e94d79ef2d93232070931a0183fff2ce2fa081c29702f
  (identical hash; also identical to the primary implementation worktree's
   catalogue hash, confirming cross-worktree determinism)

git worktree remove D:\Downloads\Everloom-gate3-disposable-verify
  -> disposable worktree removed; primary implementation worktree and all
     other pre-existing worktrees (listed in the starting-state check)
     untouched
```

**Conclusion**: Blockers B1 and B2 are closed. A genuinely fresh checkout —
no prior build of any kind, dependencies installed from the frozen lockfile
only — passes the full `verify:visual-foundation` contract, including the
specific source-path validation stage that previously required
`apps/client3d/dist` to already exist.

## 9. Git checks (implementation worktree, pre-commit)

```
git status --short | grep -v "^R  "
  -> exactly the expected modified/new files (client3d + game vite configs,
     manifest, five authority docs, assets package.json/scripts,
     asset-sources.json content, plus new files under packages/assets and
     the two new test/CLI directories)
git diff --stat packages/assets/src/catalog.generated.json
  -> empty (content byte-identical after line-ending normalisation; checked
     out to discard the pure line-ending noise before staging)
git diff --check       exit 0
git diff --cached --check   (after staging)   exit 0
git status --short pnpm-lock.yaml   -> empty both before and after `pnpm install`
  in the fresh disposable worktree (see section 8)
```

## 10. Protected-path verification

```
git status --short | grep -iE "artifacts/phase|reference-sheets/.*\.png|\.(glb|gltf|bin|fbx|obj|blend|jpg|jpeg|webp|svg)$"
  -> no matches, except the expected 569 .glb/.gltf/.bin/.png renames under
     packages/assets/models (identical content, path-only change) — checked
     explicitly by name against artifacts/phase-* and reference-sheets/ and
     confirmed zero matches in either protected path.
```

## 11. Shallow-repository correction (follow-up for Vercel CI compatibility)

Initial commit `0766ec6f4f7bdf03cfa8779e7ab2b80584f64b33` passed local
verification but failed in Vercel due to shallow-repository limitations.

**Code changes**:
- Expanded abbreviated commit SHA `29d817c` → full 40-character
  `29d817c14c9cef44115a692d03898b6a23fe9866` in
  `packages/assets/sources/asset-sources.json`
- Modified `packages/assets/scripts/validate-sources.mjs`:
  - Detect shallow repository via `git rev-parse --is-shallow-repository`
  - Require 40-character lowercase hexadecimal SHA format (reject abbreviated)
  - In complete repo: commit must resolve (error if not)
  - In shallow repo: commit SHA format validated, but unresolved historical
    commits reported as warning (not error)

**Test coverage** (10 new cases in `validate-sources.test.mjs`):
```
✔ full 40-character SHA resolves in complete repository: no error/warning
✔ full 40-character SHA does not resolve in complete repository: error
✔ full 40-character SHA resolves in shallow repository: no error/warning
✔ full 40-character SHA does not resolve in shallow repository: warning
✔ seven-character abbreviated SHA: error (both complete and shallow)
✔ non-hexadecimal 40-character value: error
✔ missing commit field in git_commit evidence: error
✔ git_commit evidence containing both path and commit: error
✔ real asset-sources.json validated: zero errors
✔ simulated shallow validation of real registry: zero errors, unresolved
   historical commit as warning
```

**Local verification** (all commands exit 0):
```
pnpm --filter @everloom/assets run test
  -> tests 104, pass 104, fail 0

pnpm --filter @everloom/assets run build
  -> catalog built, validate-sources exit 0 with 1 expected warning
  -> validate-models exit 0 with 0 warnings
  -> root tsc exit 0

pnpm --filter @everloom/assets run verify
  -> all test, validate, and typecheck stages exit 0
```

**Exact final commit for Phase 10 fresh-worktree proof**:
SHA `f38b670f435c059edee91a47876c78c5004adce6`

This correction enables Vercel shallow-clone builds to proceed with
appropriate warnings instead of errors, while maintaining complete
backward compatibility with full-history local and CI checkouts.

The supervisor independently verified Vercel deployment success for this exact
SHA. Gate 3 was accepted on 2026-08-04. This does not prove physical-iPhone
behaviour.
