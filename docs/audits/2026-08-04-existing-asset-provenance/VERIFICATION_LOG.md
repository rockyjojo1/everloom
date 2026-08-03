# Verification Log — Existing Asset and Provenance Audit

Last reviewed: 2026-08-04
Audited SHA: `22d2ffc002b0b3bbed988e8d698bd00c265f0b98`
Branch: `claude/existing-asset-provenance-audit`

This log records the exact commands run for this audit, in the order run,
with concise relevant output. It is intended to let another supervisor
reproduce the audit. Command output was truncated where it was pure noise
(long dependency install logs, repeated identical build banners); counts,
warnings and failures are preserved verbatim.

## 1. Remote and branch verification

```
git fetch origin --prune
git branch --show-current          -> claude/authority-spine (before switching)
git rev-parse HEAD                 -> 22d2ffc002b0b3bbed988e8d698bd00c265f0b98
git status --short                 -> (empty)
git diff --check                   -> exit 0, no output
git ls-remote --heads origin claude/authority-spine
                                    -> 22d2ffc002b0b3bbed988e8d698bd00c265f0b98	refs/heads/claude/authority-spine
git rev-list --left-right --count HEAD...origin/claude/authority-spine
                                    -> 0	0
git switch -c claude/existing-asset-provenance-audit origin/claude/authority-spine
                                    -> Switched to a new branch; tracking origin/claude/authority-spine
git rev-list --left-right --count HEAD...origin/claude/authority-spine (post-switch)
                                    -> 0	0
```

All expected: `origin/claude/authority-spine` matched the expected SHA
exactly, the working tree was clean, and no local branch of this name
pre-existed.

## 2. Asset-root reconnaissance

```
test -d "D:\Downloads\Everloom-asset-library"        -> ABSENT (recorded, audit continued)
find packages/assets -type d                         -> only .turbo, node_modules, scripts, src (no binary subdirs)
ls apps/game/public/                                  -> icon.svg only (no models directory)
find apps/client3d/public/models -maxdepth 2 -type d  -> kaykit-adventurers, kaykit-dungeon,
                                                          kaykit-skeletons(+props), kenney-fantasy(+Textures),
                                                          kenney-nature
find apps/client3d/public/models -type f | wc -l      -> 569
find apps/client3d/public/models -type f -iname "*.glb" | wc -l   -> 541
find apps/client3d/public/models -type f -iname "*.gltf" | wc -l  -> 13
find apps/web -type f -iname "*.png" | grep -v node_modules | wc -l -> 1004
  (999 under apps/web/dist which is gitignored build output; 499 under
   apps/web/public/sprites, which is the tracked, relevant root)
git ls-files apps/web/public/sprites | wc -l          -> 500
find . -iname "*licen*" -o -iname "*credit*" -o -iname "*attribution*"
                                                        -> ./apps/client3d/CREDITS.md, ./CREDITS.md
find . -iname "ASSET_INVENTORY.md"                    -> ./apps/client3d/ASSET_INVENTORY.md
find . -iname "ANIMATION_CLIPS.md"                    -> ./apps/client3d/ANIMATION_CLIPS.md
find . -iname "asset-sources*.json"                   -> (none) — confirmed no pre-existing source-level registry
git lfs ls-files                                       -> exit 0, no output (no LFS-tracked files)
cat .gitattributes                                     -> file does not exist
```

## 3. Vite/runtime dependency discovery

Read `apps/game/vite.config.ts` directly: confirmed a custom
`sharedModelLibrary` plugin whose `modelRoot` is
`resolve(appDirectory, "../client3d/public/models")`, serving `/models/*` at
dev time and `cpSync`-ing that directory into `dist/models` at build time.
Cross-checked against `apps/game/src/world/assets.ts` (`assetUrl(assetId)`
call at the loader) and `apps/game/src/components/AssetBrowser.tsx`
(`` `/models/${selected.sourceFile}` ``). Both confirm the same dependency.

Read `packages/assets/scripts/build-catalog.mjs` and
`packages/assets/scripts/validate-assets.mjs` directly: both hardcode
`modelRoot = resolve(repositoryRoot, "apps/client3d/public/models")`.

## 4. Git history

```
git log --oneline --follow -- packages/assets/src/registry.json | head -20   -> 8 commits
git log --oneline -- packages/assets | wc -l                                  -> 10
git log --oneline -- art-direction/visual-production-manifest.json | wc -l    -> 10
git log --oneline -- CREDITS.md apps/client3d/CREDITS.md
  -> 29d817c Install all CC0 asset packs (569 files, 32MB) — unblocks P1
     f5c766b P0 passed: client3d scaffold + real KayKit assets render (supervisor-verified)
     320fb9e Phase 0: Download LPC sprite assets, update CREDITS.md
     834a607 Everloom v0.1: Graphics overhaul + always-visible inventory + smooth walk
git show --stat 29d817c   -> confirms apps/client3d/ASSET_INVENTORY.md and CREDITS.md added in this commit,
                              plus the full 569-file model tree
git log -1 --format=%B 29d817c
  -> "Install all CC0 asset packs (569 files, 32MB) — unblocks P1
      Assets blocked the implementing model twice (itch.io blocks automation).
      Resolved via official KayKit GitHub mirrors and scraped kenney.nl direct
      zip URLs. Adds 4 rigged skeleton enemies, 329 nature models, 168 modular
      town pieces, curated dungeon props. ASSET_INVENTORY.md documents what is
      present and how to use it..."
```

## 5. Hashing, duplicate analysis, GLB/glTF metadata parsing

A temporary, stdlib-only Python script (no dependency added; deleted before
commit) was used to:

- SHA-256 hash every file in `apps/client3d/public/models`,
  `apps/game/public`, `apps/web/public/sprites`, `packages/assets/src`, and
  `art-direction/reference-sheets`.
- Parse every registry-referenced `.glb`/`.gltf` file's container structure
  (12-byte header, JSON chunk decode) to extract scene/node/mesh/primitive/
  material/texture/image/buffer/skin/animation counts and clip names,
  without any external glTF library.
- Read PNG headers (8-byte signature + IHDR width/height) for two
  standalone texture files.

Key results (full detail in the audit report and crosswalk JSON):

```
REGISTRY_ENTRIES 72
MISSING_PATHS 0 []
SCHEME_COUNTS {'composite': 1, 'procedural': 10, 'component': 14}
GLB_COUNT 47   GLTF_COUNT 0
RIGGED_REGISTRY_ENTRIES 2 ['player.adventurer', 'enemy.skeleton-warrior']
ANIM_CLIP_TOTAL_ACROSS_REGISTRY_FILES 171
PARSE_ERRORS 0 []
DUPLICATE_GROUPS_IN_CLIENT3D 0    (569 files -> 569 unique SHA-256 hashes)
cross-root duplicate hash groups: 0
file counts per root: client3d_models 569, game_public 1, web_sprites 500,
                       pkg_assets_src 5, reference_sheets 23
```

Per-pack file/byte totals (client3d canonical root), cross-checked against
`apps/client3d/ASSET_INVENTORY.md`'s claimed table and found to match on
file counts exactly:

```
kaykit-adventurers  1 file    3.49 MB   (doc: 1 file, 3.5 MB)
kaykit-dungeon      40 files  2.25 MB   (doc: 40 files, 2.4 MB)
kaykit-skeletons    31 files  18.69 MB  (doc: 31 files, 19 MB)
kenney-fantasy      168 files 2.39 MB   (doc: 168 files, 2.9 MB)
kenney-nature       329 files 2.89 MB   (doc: 329 files, 3.7 MB)
```

Registry-to-file semantic-reuse check:

```
kenney-nature/stone_tallA.glb -> ['nature.stone-tall', 'landmark.verdant-loomstone']
```
(the only case of one physical file backing two registry IDs)

Orphan (installed, unregistered) file count per pack:

```
total files 569, referenced 46, orphans 523
kaykit-adventurers  total 1   orphan 0
kaykit-dungeon      total 40  orphan 38
kaykit-skeletons    total 31  orphan 30
kenney-fantasy      total 168 orphan 155
kenney-nature       total 329 orphan 300
```

Animation clip cross-check: code-referenced clip names in
`apps/game/src/world/GameWorld.tsx` (`Idle`, `Walking_A`,
`1H_Melee_Attack_Chop`, `1H_Melee_Attack_Stab`, `Sit_Floor_Down`,
`Sit_Floor_Idle`, `Sit_Floor_StandUp`) were confirmed present in both
parsed rig clip lists — 0 dangling references found.

## 6. Source-registry and crosswalk invariant checks

```
python3 (JSON parse check on both new JSON files)
  -> OK packages/assets/sources/asset-sources.json
  -> OK docs/audits/2026-08-04-existing-asset-provenance/RUNTIME_ASSET_CROSSWALK.json

python3 scratch_invariants.py (temporary script, deleted before commit)
  -> OK: unique sourceId (8 sources)
  -> OK: sources sorted by sourceId
  -> OK: every registry pack (7) maps to a source record
  -> OK: all evidenceStatus values valid
  -> OK: all 17 filesystem licenceEvidencePaths resolve to real files
        (1 additional Git-history reference recognized as non-file evidence)
  -> OK: crosswalk has exactly 72 entries matching registry
  -> OK: crosswalk IDs exactly match registry IDs (no invented, none missing)
  -> OK: no duplicate runtimeAssetId in crosswalk
  -> OK: byte sizes match on-disk files for all file-backed entries
  -> Entries with pathExists=false (expected 0): 0
  -> ALL INVARIANTS PASSED
```

## 7. Existing asset package checks

```
pnpm --filter @everloom/assets run catalog
  $ node scripts/build-catalog.mjs
  Wrote 554 model records to .../packages/assets/src/catalog.generated.json
  exit 0

pnpm --filter @everloom/assets run validate
  $ node scripts/validate-assets.mjs
  Validated 72 semantic assets and 554 catalog models.
  exit 0

pnpm --filter @everloom/assets run build
  $ pnpm run catalog && pnpm run validate && tsc --noEmit
  (same catalog/validate output as above, tsc --noEmit produced no errors)
  exit 0
```

**Generated-file side effect**: `pnpm --filter @everloom/assets run catalog`
(and transitively `run build`) rewrites `packages/assets/src/catalog.generated.json`
with a fresh timestamp/regeneration, changing the tracked file even though
its logical content (554 records) is unchanged in count. Confirmed via
`git status --short` before and after. **Restored** with
`git checkout -- packages/assets/src/catalog.generated.json` before staging
this audit's commit, per the generated-file safety rule — this file is not
in the allowed diff for this task.

## 8. Product foundation checks

```
pnpm --filter @everloom/game run verify:visual-foundation
  -> All 15 verification stages PASSED
  -> Asset Inventory: Total entries 109, Vertical-slice 32, Phase-two 77,
     Approved-existing 64, Procedural 23, Missing 13
  -> BASELINE STATUS: PENDING, 0/10 captured
  -> FULL VISUAL FOUNDATION NOT YET COMPLETE
  exit 0

pnpm --filter @everloom/game run verify:gate0
  -> 1/5 game unit tests: 25 passed (3 files)
  -> 2/5 typecheck: clean
  -> 3/5 focused Worn Hatchet Playwright test: 3 passed, 3 skipped (by design,
     project-filtered variants)
  -> 4/5 production build: Player entry bundle 329.0 KiB / 400 KiB budget
  -> 5/5 production-exclusion assertions: verified (no VisualQAGallery, no
     qa-gallery CSS, no read-only test bridge)
  -> "Gate 0 verification passed: all five checks exited 0."
  exit 0

pnpm build (root)
  -> Tasks: 8 successful, 8 total (turbo cache: 5 cached, 3 executed fresh
     this run — @everloom/game rebuilt because catalog.generated.json had
     just changed and been reverted, invalidating its cache key)
  -> @everloom/content:build test stage: 29 passed
  -> @everloom/game:build: bundle 329.0 KiB / 400 KiB budget
  -> two informational Turbo warnings ("no output files found for task
     @everloom/assets#build" / "@everloom/content#build") — pre-existing
     Turbo `outputs` configuration gap, unrelated to this audit, not
     investigated further as it is out of this task's scope (build
     configuration is prohibited from modification)
  exit 0
```

These commands establish that the audit's investigation work did not
destabilise the existing repository. They do not approve any asset content;
see [`ASSET_PROVENANCE_AUDIT.md`](ASSET_PROVENANCE_AUDIT.md) Blocker B1 for
why a fresh checkout without a prior build could see stage 3/15
(`validate-source-paths.mjs`) of `verify:visual-foundation` fail even though
it passed here (this checkout already had `apps/client3d/dist` populated
from an earlier, unrelated session's `pnpm build`).

## 9. Final git checks

```
git status --short
  -> ?? docs/audits/
  -> ?? packages/assets/sources/
  (after removing the six temporary scratch_*.py scripts and restoring
   catalog.generated.json)

git diff --check       -> exit 0, no output (nothing tracked-and-modified remained)
git diff --stat        -> (empty — everything in scope is new/untracked, not a diff of tracked files)
git diff --name-only   -> (empty)
```

## 10. Protected-path verification

```
git status --short | grep -iE "artifacts/phase|reference-sheets/.*\.png|\.(glb|gltf|bin|fbx|obj|blend|png|jpg|jpeg|webp|svg)$"
  -> no matches (exit 1 / empty)
```

No protected path and no asset binary appears in the change set.
