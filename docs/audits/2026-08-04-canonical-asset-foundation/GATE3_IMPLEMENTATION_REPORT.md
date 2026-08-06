# Gate 3: Canonical Asset Foundation — Implementation Report

Last reviewed: 2026-08-04
Base: Gate 2 commit `8b812f862e5e201b3650132db628669c27d60c62`
(`origin/claude/existing-asset-provenance-audit`)
Branch: `claude/canonical-asset-foundation`

This is an implementation report, not another audit. It records what was
built, how it was verified, and what evidence closes Gate 2's Blockers B1
and B2. See
[`docs/audits/2026-08-04-existing-asset-provenance/ASSET_PROVENANCE_AUDIT.md`](../2026-08-04-existing-asset-provenance/ASSET_PROVENANCE_AUDIT.md)
for the historical baseline this pass corrects — that file is left
unedited; it remains the accurate record of what was true at Gate 2.

## Migration summary

**Old canonical model root**: `apps/client3d/public/models` (a legacy app's
`public/` directory).
**New canonical model root**: `packages/assets/models` (owned by the
authoritative asset package).

- 569 files moved with `git mv apps/client3d/public/models
  packages/assets/models` in a single operation. `git diff --cached
  --summary` reported exactly 569 `rename ... (100%)` lines — Git detected
  every file as a pure rename with no content change.
- Composition: 541 `.glb`, 13 `.gltf`, 13 `.bin`, 2 `.png` (companions for
  loose `.gltf` props in `kaykit-skeletons/props` and `kenney-fantasy/Textures`).
- Byte-for-byte integrity proof: a temporary pre-migration hash manifest
  (SHA-256 + size per relative path, generated before the move) was
  compared against the post-migration tree. **0 mismatches, 0 missing
  files** — every one of the 569 files retained identical relative path,
  byte size, and SHA-256 hash. The manifest itself was a temporary
  verification artefact and was not committed (its logic is preserved as
  the `validateModels` full-library hashing pass, which runs on every
  `validate:models` invocation going forward).
- `apps/client3d/public/models` no longer exists. `apps/client3d/public`
  retains only its unrelated `icons/` directory. No duplicate second model
  tree remains anywhere in the tracked repository.
- No Git LFS transformation occurred (`git lfs ls-files` returns empty
  before and after; this repository does not use LFS).

Evidence documents moved alongside the binaries (`git mv`, history
preserved):

- `apps/client3d/CREDITS.md` → `packages/assets/sources/CREDITS.md`
- `apps/client3d/ASSET_INVENTORY.md` → `packages/assets/sources/ASSET_INVENTORY.md`
- `apps/client3d/ANIMATION_CLIPS.md` → `packages/assets/sources/ANIMATION_CLIPS.md`

Known stale counts corrected in the moved `CREDITS.md` ("Verified installed
packs" section): Kenney Nature Kit corrected from "330 assets" to "329
assets" (measured on disk); Kenney Fantasy Town Kit corrected from "160
assets" to "168 assets" (measured on disk) — both now match
`ASSET_INVENTORY.md`, which already had the correct counts. Licence claims
were not altered beyond this reconciliation. KayKit source URLs now record
both the official itch.io page (`officialSourceUrl`) and the GitHub mirror
(`mirrorSourceUrl`) as distinct fields in `asset-sources.json`, and both are
now written out explicitly in `CREDITS.md`.

The root `CREDITS.md` (legacy `apps/web` 2D sprite pipeline) was left
unchanged — it documents a different pipeline, unrelated to this migration.

## Architectural decision

`packages/assets/models` was chosen exactly as specified (no evidence was
found making it invalid). `packages/assets` already owned the registry,
runtime resolver, catalogue and validation scripts; it was the only package
with no binary content of its own before this pass, and both consuming apps
(`apps/game`, `apps/client3d`) are already siblings two directory levels
below it, making relative-path consumption from a shared module
straightforward.

## Active-path search results

A repository-wide search for `apps/client3d/public/models`,
`apps/client3d/dist/models`, `../client3d/public/models`, `modelRoot`,
`currentSource`, and references to the three moved evidence files was run
before editing (`git grep`), and every hit was classified:

| Classification | Files | Action taken |
|---|---|---|
| Active runtime/configuration | `apps/game/vite.config.ts`, `apps/client3d/vite.config.ts` | Updated to import `MODEL_ROOT` from the shared contract |
| Active validation | `packages/assets/scripts/build-catalog.mjs`, `validate-assets.mjs`, `art-direction/scripts/validate-source-paths.mjs` | First two updated to import the shared contract; the third needed no code change — it already resolves `currentSource` generically against the repo root, so fixing the manifest data (below) was sufficient |
| Manifest data | `art-direction/visual-production-manifest.json` (107 fields across 57 `currentSource` + 50 `currentSourceCanonical`) | Rewritten to `packages/assets/models/...`; no other field touched |
| Source-registry data | `packages/assets/sources/asset-sources.json` (`canonicalLocalRoots`) | Rewritten to the new root as part of the schema normalisation |
| Historical audit evidence | `docs/audits/2026-08-04-existing-asset-provenance/*` (all four files) | **Left unedited** — remains an accurate historical record |
| Irrelevant / historical planning docs | `PROJECT_REBOOT_3D.md`, `THIRD_PARTY_ASSETS.md`, `apps/client3d/P0-COMPLETION-REPORT.md`, `art-direction/VISUAL-PRODUCTION.md`, `art-direction/scripts/fix-asset-paths-to-runtime.mjs` and sibling `fix-*.mjs` scripts | **Left unedited.** None of these are wired into any active build/verify/test script (confirmed by grep against `package.json` scripts and `verify-visual-foundation.mjs`'s stage list); they describe past process or are historical reports. Editing them was out of scope and would not change any runtime or verified behaviour. |

## Active consumers updated

- **`apps/game`**: `vite.config.ts`'s `sharedModelLibrary` plugin now
  imports `MODEL_ROOT` from `packages/assets/paths.mjs` instead of
  hardcoding `../client3d/public/models`. Added
  `assertCanonicalModelRootPopulated()`, called both from
  `configureServer` (dev) and `writeBundle` (build), which throws clearly
  if the canonical root is missing or empty, and a post-copy check that
  fails the build if the copied `dist/models` directory ends up empty.
  `/models/<sourceFile>` URLs, MIME handling, path-traversal protection,
  the production copy step, PWA runtime caching, icon handling and the
  bundle budget are all unchanged in behaviour — proven by the runtime
  delivery tests below and the unchanged 329.0 KiB bundle size.
- **`apps/client3d`**: previously relied on Vite's default `public/`
  static serving because its models lived inside its own `public/`
  directory. Now that the binaries live outside `apps/client3d`, a
  `sharedModelLibrary()` plugin (same shape as `apps/game`'s) was added,
  serving `/models/*` at dev time and copying into `dist/models` at build
  time, both from the same `MODEL_ROOT` import. No binary tree was
  duplicated back into `apps/client3d/public`.
- **Asset catalogue** (`packages/assets/scripts/build-catalog.mjs`): now
  walks `MODEL_ROOT` from the shared contract instead of a hardcoded
  `apps/client3d/public/models` path. Output is unchanged: 554 GLB/glTF
  records, byte-identical across repeated runs (see Determinism below).
- **Asset validators** (`packages/assets/scripts/validate-assets.mjs`):
  same change — resolves against `MODEL_ROOT`. Still reports "Validated 72
  semantic assets and 554 catalog models."
- **Visual manifest**: all 107 previously-broken/legacy-pointing
  `currentSource`/`currentSourceCanonical` fields corrected. `git diff`
  confirms exactly 107 changed lines in the manifest, all of them
  `currentSource`/`currentSourceCanonical` values — no `currentStatus`,
  `productionPriority`, `role`, `scale`, or `acceptanceCriteria` field
  changed anywhere in the file.
- **Remaining active references to the old roots**: none. `git grep -c
  "apps/client3d"` against `art-direction/visual-production-manifest.json`
  and `packages/assets/sources/asset-sources.json` both return 0.

## Durable tooling

- **Shared path contract**: `packages/assets/paths.mjs` (+
  `paths.d.mts` for TypeScript consumers). Exports `MODEL_ROOT` (absolute),
  `MODEL_ROOT_RELATIVE` (`"packages/assets/models"`), `REPOSITORY_ROOT`, and
  `resolveModelPath(sourceFile)` (throws on path-traversal attempts).
  Plain ESM, Node built-ins only, importable unmodified from `.mjs` scripts
  and from Vite's Node-context `.ts` config files. `paths.test.mjs` proves
  `apps/game/vite.config.ts`, `apps/client3d/vite.config.ts`,
  `build-catalog.mjs` and `validate-assets.mjs` all import from this one
  module (a future regression that reintroduces a second hardcoded root
  would fail this test).
- **Model validator**: `packages/assets/scripts/validate-models.mjs`,
  built on a new dependency-free `gltf-parser.mjs` (GLB container parsing,
  glTF JSON summarisation with exact accessor-based triangle/vertex counts,
  lightweight PNG/JPEG header dimension parsing). Checks filesystem
  identity, GLB/glTF structural validity, external buffer/texture
  companion existence and root-containment, geometry/texture/rig/animation
  metadata, required-clip presence, and duplicate-vs-semantic-reuse binary
  detection across the full 569-file library. `validateModels()` is
  exported as a pure, parameterised function (no hardcoded paths) so tests
  run against temporary fixture roots, not the real library.
- **Source-evidence validator**: `packages/assets/scripts/validate-sources.mjs`.
  Checks `asset-sources.json` structural validity (unique/sorted
  `sourceId`, valid evidence kinds/statuses, every registry pack mapped),
  resolves `repository_file`/`source_code` evidence paths and `git_commit`
  evidence against the real repository, and cross-checks the visual
  manifest (`currentAssetId` ↔ registry, file-backed `currentSource` ↔
  tracked file, rejects any `dist`-path reference, procedural/licensed
  placeholder consistency). `repository_claim_only` and other non-strong
  evidence statuses are reported as warnings, never errors, and the output
  explicitly states this is not commercial-release approval.
- **Animation requirements**: `packages/assets/animation-requirements.json`
  declares the 7 clip names (`Idle`, `Walking_A`, `1H_Melee_Attack_Chop`,
  `1H_Melee_Attack_Stab`, `Sit_Floor_Down`, `Sit_Floor_Idle`,
  `Sit_Floor_StandUp`) that `apps/game/src/world/GameWorld.tsx` references
  by string literal, for both `player.adventurer` and
  `enemy.skeleton-warrior`. `validate-models.mjs` fails if any required
  clip is absent from the referenced rig's animation list.
- **Duplicate detection**: full-library SHA-256 hashing inside
  `validate-models.mjs`, distinguishing genuinely duplicated binaries
  (different paths, same content — 0 found across all 569 files) from
  intentional semantic reuse (one physical file, multiple registry IDs — 1
  found: `kenney-nature/stone_tallA.glb` backing both `nature.stone-tall`
  and `landmark.verdant-loomstone`, unchanged from Gate 2).
- **Asset inspection CLI**: `packages/assets/scripts/inspect.mjs`
  (`pnpm --filter @everloom/assets run inspect -- <query>`). Supports exact
  ID lookup, substring search, `--pack`, `--category`, `--placeholder`
  filters, and `--json` output. For a resolved asset it prints runtime ID,
  source/scheme, canonical path, pack, creator, licence, evidence status,
  official + mirror URLs, manifest statuses/roles, byte size, SHA-256, GLB
  metadata (scenes/nodes/meshes/materials/triangles), rig/joint/animation
  metadata, required-clip pass/fail, semantic-reuse cross-references, and
  warnings.
- **Deterministic generated outputs**: `build-catalog.mjs`'s output was
  already free of timestamps/absolute paths and already sorted by
  `sourceFile`; running it twice with no repository changes produces a
  byte-identical `catalog.generated.json` (proven by
  `catalog-determinism.test.mjs`, which also asserts no embedded timestamp
  field, no absolute path, and the expected 554-record count).
- **Test files** (all `node:test`, zero new dependency): `gltf-parser.test.mjs`
  (15 tests), `validate-models.test.mjs` (15 tests, including the required
  failure fixtures — malformed magic, missing JSON chunk, missing
  external buffer/texture, path traversal, duplicate binaries vs. semantic
  reuse, absent required clip), `validate-sources.test.mjs` (14 tests,
  including invalid evidence kind, prose-in-path, missing evidence file,
  unresolved commit, manifest path into `dist`, manifest path to an
  untracked file), `inspect.test.mjs` (11 tests), `paths.test.mjs` (6
  tests), `catalog-determinism.test.mjs` (4 tests). **65 tests total**, all
  passing (`pnpm --filter @everloom/assets run test`). No generated binary
  fixtures were committed — every GLB fixture is built in-memory per test
  via `packages/assets/scripts/test-helpers/build-glb.mjs`.

## Validator coverage before and after

See the corrected description now in
[`docs/authority/ART_PIPELINE.md`](../../authority/ART_PIPELINE.md) for the
full before/after breakdown. Summary: GLB/glTF structural validity, exact
triangle/vertex counts, embedded-texture dimension decoding, required
animation-clip enforcement, and duplicate/semantic-reuse detection moved
from **not checked by any committed script** (Gate 2 finding) to **fully
checked, with failure-fixture test coverage** (Gate 3). Manifest-to-registry
and manifest-to-tracked-file consistency moved from **partially checked
against two different, gitignored-inconsistent base paths** to **fully
checked against one canonical, committed root**. External licence-archive
evidence, source-URL reachability, and object-origin/pivot placement remain
**not checked** — these were not in scope for Gate 3 and are recorded
honestly, not silently dropped.

## Fresh-worktree evidence

Committed Gate 3 commit tested: `039b4896e77d896e66fbc0c4e982dd0d8d614021`
("Establish packages/assets as the canonical model library owner"). That
commit was subsequently amended, once, purely to add this evidence section
and the matching section in `VERIFICATION_LOG.md` to these two already-new
report files — no functional file (code, config, manifest, package.json,
lockfile, or binary) changed between the tested commit and the final pushed
commit. The amend was local-only; nothing had been pushed at the time.
Disposable worktree: `git worktree add --detach
D:\Downloads\Everloom-gate3-disposable-verify 039b4896e77d896e66fbc0c4e982dd0d8d614021`,
removed after this proof completed
(`git worktree remove D:\Downloads\Everloom-gate3-disposable-verify`).

- Confirmed absent before starting: `apps/client3d/dist`, `apps/game/dist`,
  any `public/models` directory anywhere in the tree, and a clean
  `git status`.
- `pnpm install --frozen-lockfile`: succeeded, `downloaded 0` (resolved
  entirely from the existing local pnpm store — no network fetch of new
  packages), `git status --short pnpm-lock.yaml` empty both before and
  after.
- **`pnpm --filter @everloom/game run verify:visual-foundation`, run before
  `apps/client3d` had ever been built in this worktree**: all 15/15 stages
  passed, including stage 6 (`art-direction/scripts/validate-source-paths.mjs`,
  which is the check that previously depended on `apps/client3d/dist`
  existing). Immediately after the full 15-stage run completed,
  `apps/client3d/dist` still did not exist — independently confirmed by a
  direct filesystem check — proving the source-path validation stage
  succeeded without that directory ever being present at any point during
  this worktree's lifetime. `BASELINE STATUS: PENDING, 0/10 captured`
  (unchanged, truthful).
- `pnpm --filter @everloom/assets run verify`: 65/65 tests passed, 0 errors
  from `validate-models.mjs`/`validate-sources.mjs`.
- `pnpm --filter @everloom/client3d run test`: 2/2 passed (dev-server
  delivery + no-private-tree checks).
- `pnpm --filter @everloom/client3d run build`: succeeded;
  `apps/client3d/dist/models` received all 569 files;
  `kenney-nature/tree_oak.glb`'s SHA-256 in that output matched the
  canonical source exactly.
- `apps/game/dist/models` (from the visual-foundation run's build stage)
  also received all 569 files; `kaykit-adventurers/Character.glb`'s
  SHA-256 matched the canonical source exactly.
- `pnpm --filter @everloom/game run verify:gate0`: 5/5 stages passed
  independently in this worktree.
- `pnpm build` (root): 8/8 workspace packages successful.
- Catalogue repeatability: `packages/assets/src/catalog.generated.json`'s
  SHA-256 in this freshly-installed, independently-built worktree was
  `d45bfcd7cfa01e26191e94d79ef2d93232070931a0183fff2ce2fa081c29702f` —
  **identical** to the hash produced in the primary implementation
  worktree, confirming the catalogue generator is deterministic across
  worktrees/machines, not merely across repeated runs in one process.
- No source-path validator relies on `dist` anywhere in this worktree —
  proven directly by the sequencing above, not inferred.

This is the definitive proof that Blockers B1 and B2 are closed: a
genuinely fresh checkout, with no prior build of any kind, passes the full
visual-foundation contract on the first attempt.

## Runtime-delivery evidence

- **`apps/game`** (`apps/game/src/world/modelDelivery.test.ts`, Vitest, using
  Vite's own `createServer` in middleware mode — no new server framework):
  a registered model URL (`kaykit-adventurers/Character.glb`) returns HTTP
  200 with `content-type: model/gltf-binary` and non-empty bytes; served
  bytes for `nature.oak` hash-match the canonical source file exactly;
  a missing asset path returns a 4xx status (falls through to Vite's own
  404 handling); a path-traversal request (`../../../../package.json`) is
  rejected, not served as JSON; a second, non-character environment model
  (`kenney-fantasy`/`kenney-nature`) also returns 200 with the correct
  content type. 5/5 passing.
- **Production build hash proof**: after `pnpm --filter @everloom/game run
  build`, `apps/game/dist/models` contains all 569 files;
  `kaykit-adventurers/Character.glb`'s SHA-256 in the build output matches
  the canonical source exactly. Bundle size unchanged: 329.0 KiB / 400 KiB
  budget.
- **`apps/client3d`** (`apps/client3d/scripts/verify-model-delivery.test.mjs`,
  `node:test`, same Vite middleware-mode pattern, zero new dependency): the
  dev server serves `kaykit-adventurers/Character.glb` with a matching
  hash; a second test confirms `apps/client3d/public/models` does not
  exist (no private duplicate tree). 2/2 passing. After
  `pnpm --filter @everloom/client3d run build`,
  `apps/client3d/dist/models` contains all 569 files;
  `kaykit-skeletons/Skeleton_Warrior.glb`'s SHA-256 in the build output
  matches the canonical source exactly.
- **Playwright smoke test** (`apps/game/tests/model-delivery-smoke.spec.ts`,
  listed via `playwright test --list` before running — 74 tests in 15
  files, up from Gate 2's 72/14, confirming this is a genuinely new
  addition, not a rename): loads the real game in a real Chromium browser,
  clicks through to Meadowrest, waits for `[data-testid="game-world"]
  [data-ready="true"]`, and asserts **zero `/models/` requests with status
  ≥ 400** during initial load, at least one `/models/` request overall, the
  player GLB request returned 200, and at least one environment GLB
  request (Kenney nature/fantasy) returned 200. This is delivery proof
  only — it makes no production-art or visual-quality claim. Passed
  (`[desktop] › model-delivery-smoke.spec.ts` — 1 passed).

## Additional geometry/rig data recovered

Beyond Gate 2's container-level metadata, exact accessor-based triangle
counts are now available: `player.adventurer` — 6,952 triangles across 15
meshes, 1 material, 1024×1024 embedded texture; `enemy.skeleton-warrior` —
5,934 triangles across 10 meshes, 2 materials. Both confirmed 41 joints, and
all 7 code-referenced animation clip names present in both rigs (0 missing).

## Remaining warnings

- `packages/assets/scripts/validate-sources.mjs`: 1 warning —
  `lpc-legacy-sprites` remains `repository_claim_only` (legacy `apps/web` 2D
  pipeline, 0 registry entries, out of scope for this pass, unchanged from
  Gate 2).
- `art-direction/scripts/validate-visual-production-manifest.mjs`: 121
  warnings, unchanged in count and content from Gate 2 (scale-unconfirmed,
  reference-sheet-pending, and similar production-readiness flags — none of
  them path-related, none touched by this pass).
- `packages/assets/scripts/validate-models.mjs`: 0 warnings against the real
  library at Gate 3 (0 duplicate binaries; 1 semantic-reuse group correctly
  distinguished, not warned on).

## Explicitly deferred work

Everything in this list was out of scope for Gate 3 by instruction, and
nothing in it was attempted:

- The production-room bake-off itself (work package 4).
- Any change to Meadowrest layout, gameplay, or combat.
- Verdant Grove runtime integration.
- Any UI redesign or dashboard/Asset Browser expansion.
- Downloading, replacing, or reclassifying any asset.
- Adding a wolf/quadruped model.
- Custom art production or model geometry changes.
- Binary optimisation/compression.
- Changing any manifest production-status or priority field.
- Any third-party dependency addition.
- Cloud behaviour, Capacitor, or platform-wrapper changes.

## Independent audit correction follow-up

The initial Gate 3 implementation (commit
`0766ec6f4f7bdf03cfa8779e7ab2b80584f64b33`) passed local verification
but failed during Vercel's automatic build due to shallow repository
limitations in the CI environment.

**Root cause**: The source-registry validator required Git commit evidence
(e.g. the historical installation record commit `29d817c`) to be verified
via `git cat-file -e`. In Vercel's shallow checkout, historical commits
beyond the current branch tip are absent, causing the command to fail
and the validator to error.

**Solution**: Modified `packages/assets/scripts/validate-sources.mjs` to
detect shallow vs. complete repositories and apply differentiated
verification logic:

- **Complete repository**: Git commit evidence must be valid 40-character
  lowercase hexadecimal SHA and must resolve; failure is an error (as
  before).
- **Shallow repository** (e.g., Vercel CI): Git commit evidence must still
  be valid 40-character SHA format, but if it does not resolve because
  the historical commit is absent from the shallow clone, that is
  reported as a **warning** (not an error), with explicit wording that
  the commit could not be verified in the shallow checkout.

**Data normalization**: Expanded abbreviated commit SHA `29d817c` to full
form `29d817c14c9cef44115a692d03898b6a23fe9866` in
`packages/assets/sources/asset-sources.json` to satisfy the 40-character
requirement.

**Tests added** (10 new test cases in `validate-sources.test.mjs`):

1. Full 40-char SHA resolves in complete repository → no error/warning
2. Full 40-char SHA fails to resolve in complete repository → error
3. Full 40-char SHA resolves in shallow repository → no error/warning
4. Full 40-char SHA fails to resolve in shallow repository → warning (not
   error)
5. Abbreviated SHA in complete repository → error
6. Abbreviated SHA in shallow repository → error
7. Non-hexadecimal 40-char value → error
8. Missing `commit` field → error
9. Evidence record with both `path` and `commit` → error
10. Real registry simulated as shallow → zero errors, unresolved historical
    commit as warning

**Verification**: All 104 tests pass locally (25 Git-tracked-path tests +
79 prior); the full `@everloom/assets` build, verify, test suite exits 0
with 0 errors, 1 expected warning (pre-existing lpc-legacy-sprites).

**Exact final commit**: SHA `f38b670f435c059edee91a47876c78c5004adce6`

This correction remains backward compatible: complete-repository behavior
is unchanged; shallow-repository builds now proceed with warnings instead
of errors, and all file evidence (paths) remains mandatory and
Git-tracked.

The supervisor independently verified Vercel deployment success for this exact
SHA. Gate 3 was accepted on 2026-08-04. This does not prove physical-iPhone
behaviour.

## Gate 4 recommendation

With the canonical model root settled under `packages/assets`, both
consuming apps reading from one shared contract, the visual manifest's
active paths corrected and proven reproducible on a fresh checkout, and
durable technical/evidence validation in place with real test coverage
(including shallow-CI safety), the repository is ready for the minimal
asset-access workflow and the representative browser/mobile
production-room bake-off (work package 4), subject to independent
supervisor acceptance of this gate. The remaining "not checked" areas
(external licence-archive evidence, source-URL reachability,
object-origin/pivot placement, texture-compression-format suitability)
are not blockers for the bake-off and can be picked up opportunistically
or in a future tooling pass.
