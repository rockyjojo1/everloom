# Existing Asset and Provenance Audit

Last reviewed: 2026-08-04

## Executive judgement

**CONDITIONAL PASS**

The repository has enough truthful, cross-corroborated asset evidence to
proceed to the minimal asset-access workflow and the production-room
bake-off, **conditional on** the Blocker and High findings below being read
and either fixed or explicitly accepted before that work starts — in
particular the manifest's dependency on a gitignored `apps/client3d/dist`
build-output path, and the fact that `apps/game/public` ships with no models
directory of its own (all runtime GLB serving depends on a legacy app's
`public/` tree via a custom Vite plugin).

This judgement does **not** approve any asset for commercial release. Licence
evidence for every external pack is markdown-claim-plus-matching-file-count
evidence (`verified_local_evidence` in this audit's terminology), not an
archive-embedded licence file traced back to the original download. See
"Source and licence findings" below for the exact standard applied.

## Audited snapshot

- Repository: `rockyjojo1/everloom`
- Branch: `claude/existing-asset-provenance-audit` (created from `origin/claude/authority-spine`)
- SHA at audit time: `22d2ffc002b0b3bbed988e8d698bd00c265f0b98`
- Date: 2026-08-04
- Roots inspected: `apps/client3d/public/models`, `apps/game/public`,
  `packages/assets/src`, `apps/web/public/sprites`,
  `art-direction/reference-sheets`, `packages/assets/scripts`,
  `art-direction/scripts`, relevant Git history for these paths.
- External cache `D:\Downloads\Everloom-asset-library`: **absent**. Checked
  with `test -d`; recorded and audit continued per the autonomous-execution
  rule for missing evidence.
- Exclusions honoured: `artifacts/phase-*` was not enumerated, hashed, read
  or touched. `art-direction/reference-sheets/*.png` were hashed for
  inventory purposes only (file existence/size/hash), never opened as
  "runtime assets" and never modified.

## Inventory summary

All counts below are calculated, not estimated, using a temporary
stdlib-only Python script (deleted before commit; see
[`VERIFICATION_LOG.md`](VERIFICATION_LOG.md) for the exact commands run).

| Metric | Count |
|---|---|
| Source packs (source-registry records) | 8 |
| Runtime registry entries (`packages/assets/src/registry.json`) | 72 |
| Binary asset files in the canonical model root (`apps/client3d/public/models`) | 569 |
| — of which `.glb`/`.gltf` | 554 (541 `.glb` + 13 `.gltf`) |
| — of which `.bin`/`.png` companions for loose `.gltf` props | 15 |
| Binary asset files in the legacy 2D sprite root (`apps/web/public/sprites`) | 499 PNG (500 tracked files total) |
| Reference-only PNGs (`art-direction/reference-sheets`) | 23 files (excluded from runtime-asset counts) |
| `apps/game/public` (authoritative app's own committed public dir) | 1 file (`icon.svg`) — **no models directory** |
| GLB/glTF files referenced by the runtime registry | 47 (46 unique files — one file is shared by two registry IDs) |
| Rigged assets (registry entries with a skin) | 2 (`player.adventurer`, `enemy.skeleton-warrior`) |
| Animation clips (sum across those 2 files) | 171 (76 + 95) |
| Exact duplicate binary groups (SHA-256, within the canonical root) | 0 |
| Exact duplicate binary groups (cross-root: model root vs. sprite root vs. `packages/assets/src` vs. reference sheets) | 0 |
| Missing registry→canonical-path resolutions | 0 of 72 |
| Locally evidenced licence claims (source-registry `verified_local_evidence`) | 7 of 8 sources (covering all 72 registry entries) |
| Repository-claim-only licence claims | 1 of 8 sources (`lpc-legacy-sprites`, 0 registry entries) |
| Missing licence evidence (source level) | 0 |
| Conflicting licence claims | 0 |
| Placeholder manifest entries (`procedural-placeholder` + `licensed-placeholder`) | 31 (23 + 8) |
| `missing`-status manifest entries | 13 |
| `needs-audit`-status manifest entries | 1 |
| Procedural registry assets (`procedural://`) | 10 |
| Component-native registry assets (`component://`) | 14 |
| Composite registry assets (`composite://`) | 1 |
| Legacy-only candidates (installed, on-disk, no registry entry) | 523 files in the canonical model root; the entire 499-file `apps/web` sprite pipeline |

## Source and licence findings

Full detail in `packages/assets/sources/asset-sources.json`. Summary:

- **`kaykit-adventurers`, `kaykit-dungeon`, `kaykit-skeletons`,
  `kenney-fantasy`, `kenney-nature`** — classified `verified_local_evidence`.
  Each pack is named, licensed and sourced in `apps/client3d/CREDITS.md`
  ("Verified installed packs" section, with a GitHub-mirror URL per KayKit
  pack), and independently corroborated by `apps/client3d/ASSET_INVENTORY.md`
  (per-pack file counts) and, for the two rigged files, by
  `apps/client3d/ANIMATION_CLIPS.md` (76 clips claimed for
  `kaykit-adventurers`, matching this audit's independent GLB parse exactly).
  **This is markdown-claim evidence corroborated by measured file counts,
  not an archive-embedded LICENSE file from the original download** — no
  such file is checked into the repository for any of these five packs.
  Treat it as strong internal corroboration, not external legal proof.
- **`everloom-original`** — classified `verified_local_evidence` on a
  different basis: there is no external licence to verify, because this is
  first-party runtime-generated geometry (`apps/game/src/world/assets.ts`,
  functions `proceduralTool`, `proceduralSmelter`, `proceduralAnvil`,
  `proceduralBoneguardVest`, `proceduralMaraShawl`, `proceduralRipples`) and
  code-native icon components (`apps/game/src/components/ItemIcon.tsx`). The
  "evidence" is the actual generating source code, confirmed present and
  wired up by direct inspection.
- **`everloom-composite`** — classified `verified_local_evidence`. Confirmed
  by reading `apps/game/src/world/assets.ts`'s `buildCottage` function: it
  assembles unmodified `kenney-fantasy` pieces at runtime; no new geometry is
  authored, so the licence position is inherited entirely from
  `kenney-fantasy`.
- **`lpc-legacy-sprites`** (apps/web) — classified `repository_claim_only`.
  `CREDITS.md` at the repository root names five distinct OpenGameArt/LPC
  sources with different licences (CC-BY-SA 3.0, CC-BY 3.0, CC-BY-SA 4.0,
  CC0, GPL 3.0) plus a font (SIL OFL 1.1), but no archive hash, retrieval
  date or per-file evidence was found. **This pipeline is legacy and
  non-authoritative** (`apps/web` is not `packages/assets`/`packages/content`/
  `apps/game`); it has zero runtime registry entries and no code reference
  from the authoritative app was found. Recorded for completeness per the
  audit's "record legacy-path assets separately" instruction, not because it
  needs resolving before the next gate.

Minor, non-blocking documentation inconsistencies found (not licence
problems): `CREDITS.md` claims "330 assets" / "160 assets" for
`kenney-nature`/`kenney-fantasy`; `ASSET_INVENTORY.md` and this audit's
direct on-disk count both agree on 329/168. Recorded in the source registry
notes.

## Canonical path findings

This is the audit's most consequential technical finding.

- **`packages/assets`** (the authoritative package) contains no binary asset
  files at all — only `registry.json`, `runtime.ts`, `catalog.ts`, `index.ts`
  and a generated `catalog.generated.json`. It is a pure metadata layer.
- **`apps/client3d/public/models`** (a *legacy* app's `public/` directory,
  per `docs/authority/CURRENT_STATE.md`) is the actual, sole, canonical
  filesystem location for every binary GLB/glTF file the authoritative
  registry references. `packages/assets/scripts/build-catalog.mjs` and
  `validate-assets.mjs` both hardcode `modelRoot =
  resolve(repositoryRoot, "apps/client3d/public/models")`.
- **`apps/game`** (the authoritative app) does **not** ship a `public/models`
  directory of its own. Instead, `apps/game/vite.config.ts` defines a custom
  `sharedModelLibrary` Vite plugin that (a) at dev time, serves any request
  under `/models/*` by reading directly from
  `apps/client3d/public/models`, and (b) at build time, `cpSync`s that
  entire legacy directory into the build's `dist/models`. The runtime loader
  (`apps/game/src/world/assets.ts`, via `assetUrl()` in
  `packages/assets/src/runtime.ts`) requests `/models/${sourceFile}`, which
  only resolves because of this plugin.
- **Consequence**: the authoritative runtime, for every non-procedural asset,
  is structurally dependent on a directory that authority documentation
  labels "legacy or alternate paths, not implementation authority." The
  dependency is real and currently working, but it means `apps/client3d`
  cannot be safely deleted, archived, or excluded from checkouts without
  breaking `apps/game`'s 3D rendering entirely. This should be corrected by a
  future controlled asset-tooling task (moving canonical binaries under
  `packages/assets` or an equivalent authoritative root), not by this audit.
- **`art-direction/visual-production-manifest.json`'s `currentSource` field**
  compounds this: 53 of 109 entries point at `apps/client3d/dist/models/...`
  — a **build output path, excluded by `.gitignore` (`dist/`)**. On a fresh
  clone with no prior build, these paths do not exist. `dist/` existed
  during this audit only because an earlier session in this repository ran
  `pnpm build` (which builds `@everloom/client3d` as one of the eight
  workspace packages). See "Validator coverage matrix" and the Blocker below
  for the consequence to `verify:visual-foundation`'s reproducibility.
- **`apps/web`** is a fully separate legacy pipeline (2D LPC sprites, not
  GLB). No overlap in files, formats or code paths with the authoritative
  3D pipeline. Confirmed via hash comparison: 0 cross-root duplicate binaries
  between `apps/web/public/sprites` and `apps/client3d/public/models`.
- **`packages/engine`, `packages/gamedata`**: contain no asset files at all
  (0 relevant binary files found).

## Technical asset findings

- All 72 registry entries resolve to an existing canonical file (or a valid
  `procedural://`/`component://`/`composite://` scheme) — **0 missing
  paths**.
- All 47 file-backed registry entries are `.glb` (no loose `.gltf` is
  registered directly, though 13 loose `.gltf` files with `.bin`/`.png`
  companions exist unregistered in `kaykit-skeletons/props` and elsewhere).
- All 47 registered GLB files parsed successfully with a minimal stdlib GLB
  container parser (magic/version/chunk structure, JSON chunk decode) — **0
  parse errors**, declared length matched actual file length in every case.
- 2 registry entries are rigged (skinned): `player.adventurer` (41 joints,
  76 animation clips) and `enemy.skeleton-warrior` (41 joints, 95 animation
  clips). Both rigs are humanoid. Full clip-name lists are in
  `RUNTIME_ASSET_CROSSWALK.json`.
- Both rigs' clip names that the authoritative game code references by
  string (`Idle`, `Walking_A`, `1H_Melee_Attack_Chop`,
  `1H_Melee_Attack_Stab`, `Sit_Floor_Down`, `Sit_Floor_Idle`,
  `Sit_Floor_StandUp`, checked in `apps/game/src/world/GameWorld.tsx`) are
  present in both files' clip lists. No dangling animation-name reference
  was found.
- `player.adventurer`'s rig carries a baked-in, always-visible
  `Knight_Helmet` mesh on the `head` bone (documented first-hand in
  `apps/game/src/world/characterPresentation.ts`), which constrains future
  head-attached accessory work. This is not a defect in the asset, but a
  real fit limitation worth carrying into the bake-off.
- Standalone texture files checked for dimensions (stdlib PNG header parse,
  no imaging library installed): `kaykit-skeletons/props/skeleton_texture.png`
  is 1024×1024; `kenney-fantasy/Textures/colormap.png` is 512×512. Textures
  embedded inside GLB binary chunks (used by both rigged files and most
  registered GLBs) were **not** individually decoded for dimensions in this
  pass — that would require a real PNG/JPEG decoder beyond a header read on
  an extracted buffer, which this audit did not attempt to avoid adding a
  dependency. This is recorded as a genuine gap, not glossed over.
- No triangle/polygon counts were extracted. The stdlib GLB parser used here
  reads container-level counts (meshes, primitives, materials, textures,
  images, skins, animations, buffers) from the JSON chunk; it does not
  decode accessor buffer views, so no vertex/index totals are reported.
  Treat "approximate triangle count" fields in the crosswalk and shortlist
  as **not available** from this pass, not as zero.
- No mobile/runtime performance claim is made from any of the above. Static
  metadata does not establish frame-rate, memory, or load-time behaviour.

## Validator coverage matrix

Legend: **Fully checked** (a real assertion enforces this), **Partially
checked** (checked for a subset of assets/paths, or checked inconsistently
across two different scripts), **Field-presence only** (a field is required
to exist/have some value, but its content is not verified against reality),
**Not checked** (no script inspects this at all), **Unclear** (ambiguous or
contradictory script behaviour).

| Area | Status | Exact script / function |
|---|---|---|
| Registry ID uniqueness | Fully checked | `packages/assets/scripts/validate-assets.mjs` (`ids` Set + duplicate push) |
| Source path existence | Partially checked | `validate-assets.mjs` checks registry `sourceFile` against `apps/client3d/public/models`; `art-direction/scripts/validate-source-paths.mjs` separately checks manifest `currentSource` against `apps/client3d/dist/models` (a **different, gitignored** base) for `approved-existing` entries only — the two checks use inconsistent base paths and neither checks the actual `apps/game` build output |
| Naming | Not checked | no script enforces an ID naming pattern for `packages/assets/src/registry.json` (the identifier regex in `packages/content/src/schemas.ts` governs *content* IDs, not asset IDs) |
| Scale | Field-presence only | `art-direction/scripts/validate-visual-production-manifest.mjs` warns (does not error) when `scaleReference.authority === "unconfirmed"`; no script compares the declared numeric scale against the GLB's actual bounding box |
| Object origin/pivot | Not checked | no script inspects node transforms |
| Material count | Not checked | no script reads GLB `materials` array |
| Texture dimensions | Not checked | no script decodes any texture |
| Texture format | Not checked | no script inspects image MIME/format |
| External texture references | Not checked | no script inspects glTF `images[].uri` |
| GLB parse validity | Not checked | no committed script parses the GLB container at all; this audit's temporary script is the first |
| Scene/mesh presence | Not checked | no script reads `scenes`/`meshes` |
| Polygon/triangle budget | Not checked | no script decodes accessor buffers |
| Rig presence | Not checked | no script reads `skins` |
| Joint count | Not checked | no script reads skin `joints` |
| Animation presence | Not checked | no script reads `animations` |
| Required animation clip names | Not checked | no script cross-checks `apps/game/src/world/GameWorld.tsx`'s string-literal clip references against any GLB's actual clip list; a renamed/removed clip would only fail at runtime |
| Attachment points | Field-presence only | manifest schema has an `attachmentPoints` array (e.g. `equipment.worn-hatchet: ["hand.r"]`); no script confirms the named bone exists on the referenced rig |
| Collision metadata | Field-presence only | manifest `collisionRequirement` enum field exists; not cross-checked against actual game collision/hitbox logic |
| Licence field presence | Fully checked | `validate-visual-production-manifest.mjs` requires `currentLicense` for `currentStatus === "approved-existing"`; warns on an unrecognised licence string |
| Actual licence evidence | Not checked | no committed script traces a licence claim to a local evidence file; this audit is the first pass to do so |
| Source URL presence | Not checked | neither `registry.json` nor the manifest schema requires `sourceUrl`/`officialSourceUrl` |
| Source URL validity (reachability) | Not checked | no script makes a network request |
| File/archive hash | Partially checked | `art-direction/scripts/validate-incoming-queue.mjs` and `validate-reference-sheet-status.mjs` compute and verify SHA-256 for the **reference-sheet PNG intake queue only**; no script hashes any runtime GLB/model/texture asset |
| Manifest-to-registry consistency | Fully checked | `art-direction/scripts/validate-visual-production-integration.test.mjs` ("All Meadowrest scenery/interactables use registered assets"); `validate-visual-production-manifest.mjs` checks `currentAssetId` against the registry |
| Registry-to-runtime-copy consistency | Not checked | no script verifies the file actually served by `apps/game`'s dev server or build output matches the registry; this is structurally implied by the shared Vite plugin, not independently validated |
| Duplicate binaries | Not checked | no committed script computes file hashes to find duplicates; this audit is the first |
| Missing canonical source files | Partially checked | see "Source path existence" above — two inconsistent, narrower checks exist; neither covers every root this audit inspected |
| Production-build exclusion of dev-only tools | Fully checked | `apps/game/scripts/check-gate0-production-exclusions.mjs`, run as stage 5/5 of `verify:gate0` |

**Correction to `docs/authority/ART_PIPELINE.md`**: that file states current
validation "should cover, and does substantially cover today: naming;
scale; origin; material count; texture use; rig; animation clips;
attachment points; provenance; texture use." This audit found that claim is
**too strong**. Of those nine areas, only "provenance" (as licence-field
presence, not licence evidence) is fully checked; "scale" and "attachment
points" are field-presence only; naming, origin/pivot, material count,
texture use, rig, and animation clips are **not checked at all** by any
committed script. See Phase 12 update to `docs/authority/ASSET_SOURCES.md`
for the corrected summary; `ART_PIPELINE.md` itself was left unedited per
this task's scope (only `ASSET_SOURCES.md` may be edited) and should be
corrected in a future documentation-only pass.

## Duplicate and orphan findings

- **0 exact-duplicate binaries** anywhere inspected (within the 569-file
  canonical model root, and across all four other roots hashed). This is a
  genuinely clean result, not an assumption — 569 files produced 569 unique
  SHA-256 hashes.
- **1 intentional semantic reuse**: `nature.stone-tall` and
  `landmark.verdant-loomstone` both reference the identical file
  `kenney-nature/stone_tallA.glb`, differentiated only by `scale` (1.8 vs
  2.35). This is a deliberate two-role reuse of one physical asset, not a
  duplicate-file problem.
- **523 unreferenced ("orphan") files** in the canonical model root — present
  on disk, installed and documented (`ASSET_INVENTORY.md`), but with no
  registry entry at all:
  - `kaykit-dungeon`: 38 of 40 installed files unreferenced (only
    `crates_stacked` and `barrel_large` are registered).
  - `kaykit-skeletons`: 30 of 31 installed files unreferenced, including
    three complete rigged skeleton variants (`Skeleton_Minion.glb`,
    `Skeleton_Rogue.glb`, `Skeleton_Mage.glb`) documented in
    `ASSET_INVENTORY.md` as intended enemy models for a training-ground
    progression that has not been built.
  - `kenney-fantasy`: 155 of 168 installed files unreferenced.
  - `kenney-nature`: 300 of 329 installed files unreferenced.
  - `kaykit-adventurers`: 0 orphans (the single file is registered).
  - These are not orphans in the sense of "abandoned" — `ASSET_INVENTORY.md`
    documents intended future uses for many of them (e.g. named enemy
    progression, tree/rock variant categories). They are simply not yet
    wired into `registry.json`.
- **Deployment-copy duplication is expected, not measured directly**: the
  Vite plugin `cpSync`s the entire canonical model root into `dist/models` at
  build time. This audit did not hash `dist/` (gitignored, ephemeral,
  correctly excluded from source-of-truth comparison) but this copy
  mechanism is confirmed by direct code reading, not inferred.
- **No unexplained cross-root duplicates** were found between the 3D and 2D
  pipelines, or between any other pair of inspected roots.

## Bake-off readiness

See [`BAKEOFF_CANDIDATES.md`](BAKEOFF_CANDIDATES.md) for full detail. Summary:

- **Credible candidates exist** for: player character, Mara/NPC, enemy
  (skeleton-type), Worn Hatchet, woodcutting tree, canopy tree, rocks/cliff
  framing, cottage/village structure, bridge, campfire facility, path/ground
  detail, shoreline detail, procedural water, and the core animation set
  (idle/walk/melee, with melee reused for the woodcutting action).
- **No credible candidate exists** for a wolf/quadruped creature — none is
  installed anywhere in the repository. The existing `licensed-placeholder`
  manifest entry for `creature.grove-wolf` is the least-misleading current
  representation and should not be "upgraded" without a real asset.
- **No dedicated animation clip exists for woodcutting** in either rigged
  file; the game reuses a melee chop clip.
- **No model exists for the smelter or anvil facilities**; both currently use
  first-party procedural geometry.

## Findings by severity

### Blocker

- **B1 — Visual-foundation validator reproducibility depends on an
  untracked, gitignored build-output path.** 53 of 109
  `visual-production-manifest.json` entries have `currentSource` under
  `apps/client3d/dist/models/...`. `dist/` is listed in `.gitignore` and is
  not committed. `verify-visual-foundation.mjs` runs
  `validate-source-paths.mjs` (stage 6/15) **before** it runs the production
  build (stage 14/15). On a genuinely fresh clone with no prior `pnpm build`
  in that checkout, stage 6 would fail for every `approved-existing` entry
  pointing at `apps/client3d/dist`. This audit did not empirically break a
  clean checkout to prove it (that would be destructive to reproduce
  cleanly), but the finding is derived directly from reading
  `.gitignore`, `validate-source-paths.mjs`'s path resolution, and the
  verifier's own stage ordering — not speculation. **Evidence**:
  `.gitignore` line `dist/`; `art-direction/scripts/validate-source-paths.mjs`
  line 46 (`resolve(__dirname, "..", "..", entry.currentSource)`);
  `apps/game/scripts/verify-visual-foundation.mjs` stage list (source-path
  validation at position 6, production build at position 14). **Consequence**:
  a supervisor or CI runner with a genuinely fresh checkout could see
  `verify:visual-foundation` fail through no fault of the change under
  review, and a false "it's broken" or a masking "just run build first"
  workaround could follow. **Recommended next action**: repoint manifest
  `currentSource` values at a stable, committed path (or the actual
  `apps/client3d/public/models` source), or reorder the verifier to build
  before validating source paths. **Owner**: Gate 3 tooling (this is a
  validator/config fix, not an asset-content fix, and out of this audit's
  scope to change).
- **B2 — The authoritative app has no models of its own; 3D rendering is
  structurally dependent on a legacy app's `public/` directory.** See
  "Canonical path findings" above. **Evidence**: `apps/game/vite.config.ts`
  `sharedModelLibrary` plugin; `packages/assets/scripts/build-catalog.mjs`
  and `validate-assets.mjs` both hardcode `apps/client3d/public/models` as
  `modelRoot`; `apps/game/public` contains only `icon.svg`. **Consequence**:
  `apps/client3d` cannot be archived, deprioritised, or removed without
  breaking every 3D asset in the authoritative game, contradicting its
  "legacy" classification in `docs/authority/CURRENT_STATE.md`.
  **Recommended next action**: migrate the canonical binary root under
  `packages/assets` (or another authoritative location) in a controlled
  asset-tooling task; update `build-catalog.mjs`, `validate-assets.mjs` and
  the Vite plugin together. **Owner**: Gate 3 tooling.

### High

- **H1 — No committed script performs GLB structural validation, hash-based
  duplicate detection, or licence-evidence tracing.** This audit is the
  first pass to do any of these. Until Gate 3 adds durable tooling for this,
  every future asset addition repeats today's manual effort. **Owner**: Gate
  3 tooling.
- **H2 — No wolf/quadruped asset exists anywhere in the repository.** The
  Verdant Grove creature loop cannot use a genuine wolf visual without new
  production or sourcing work, which is out of scope for both this audit and
  the immediate bake-off. **Owner**: future art production, tracked in
  `docs/authority/VERDANT_GROVE.md`.
- **H3 — `apps/web`'s legacy 2D licence claims (`CREDITS.md`) were not
  independently verified in this pass** beyond noting their existence; they
  cover a completely different, non-authoritative pipeline with mixed
  licences (CC-BY-SA, CC-BY, GPL, CC0). If `apps/web` is ever revived or its
  assets reused elsewhere, this evidence gap must be closed first.
  **Owner**: future scope decision, not currently on any gate's critical
  path.

### Medium

- **M1 — `CREDITS.md` and `ASSET_INVENTORY.md` disagree on file counts for
  `kenney-nature` (330 vs. 329) and `kenney-fantasy` (160 vs. 168).**
  On-disk counts match `ASSET_INVENTORY.md` exactly in both cases. Likely a
  stale round number in `CREDITS.md`. **Owner**: Gate 3 tooling (trivial
  documentation fix, not asset-content).
- **M2 — Registry `sourceUrl` values for the three KayKit packs point at
  itch.io pages; `CREDITS.md` separately records GitHub-mirror URLs for the
  same packs.** Not a conflict (both can be legitimate for CC0 content) but
  worth reconciling into one canonical URL per pack for future clarity.
  **Owner**: Gate 3 tooling.
- **M3 — No triangle/polygon counts or per-texture dimensions were
  extracted for embedded-texture GLBs.** A deeper technical pass (or a
  vetted glTF-parsing dependency, which this audit was not authorised to
  add) would be needed for real budget/performance analysis ahead of the
  physical bake-off. **Owner**: Gate 4 bake-off, if performance data is
  needed before then.

### Low

- **L1 — 523 installed-but-unregistered files in the canonical model root**
  represent real, available, already-licensed material for future content
  (e.g. three additional skeleton enemy variants, hundreds of Kenney nature
  and town pieces). Registering more of them costs no new download.
  **Owner**: whichever future content gate wants them; flagged here so it
  isn't rediscovered from scratch.
- **L2 — No dedicated woodcutting animation clip exists**; the melee chop
  clip is reused. A cosmetic-only gap. **Owner**: future animation-specific
  art work, not currently blocking.

### Informational

- **I1 — Both rigged assets (`player.adventurer`, `enemy.skeleton-warrior`)
  share the same 41-joint skeleton naming convention**, which is why the
  skeleton pack can be repurposed as a combat enemy without a retargeting
  step — both were exported from the same KayKit animation source
  convention.
- **I2 — `player.adventurer`'s baked-in helmet mesh** constrains future
  head-slot customisation art. Documented here because it was rediscovered
  first-hand in `apps/game/src/world/characterPresentation.ts`, which itself
  cites a prior audit document (`CLAUDE_CHARACTER_ENVIRONMENT_FINISH_AUDIT.md`)
  that is **not present in this checkout** (it exists only in the separate
  `claude/character-environment-finish` branch/worktree, which this audit
  did not merge in or treat as part of the accepted base). If that document
  is needed as authority, it should be explicitly brought into this branch
  or `docs/authority/` by a future task, not assumed present.

## Corrections to current authority claims

- `docs/authority/ART_PIPELINE.md` — the claim that current validation
  "substantially covers... naming; scale; origin; material count; texture
  use; rig; animation clips; attachment points; provenance" is **too
  strong**. See the Validator coverage matrix above. `ASSET_SOURCES.md` has
  been updated (Phase 12, this task) with the corrected summary; the
  `ART_PIPELINE.md` file itself was intentionally left unedited, because
  this task's allowed diff is limited to `ASSET_SOURCES.md` among the
  authority files. A future documentation-only task should correct
  `ART_PIPELINE.md` directly.
- `docs/authority/CURRENT_STATE.md` and
  `docs/authority/CODEX_SUPERVISOR_CONTINUATION.md` both correctly state
  that `apps/client3d` is legacy/non-authoritative. Neither currently states
  that the authoritative `apps/game` runtime is **structurally dependent**
  on that legacy app's `public/models` directory for every non-procedural
  visual asset (Blocker B2 above). This is a materially stronger statement
  than "may contain reusable assets or ideas," and should be reflected the
  next time either file is revised. Not corrected automatically here, per
  this task's scope (only `ASSET_SOURCES.md` may be edited).
- No other statement in `CURRENT_STATE.md`, `ASSET_SOURCES.md`, or
  `CODEX_SUPERVISOR_CONTINUATION.md` was found to be factually contradicted
  by this audit's evidence.

## Gate recommendation

The next minimal asset-access workflow (work package 3) **may begin**,
provided it explicitly accounts for Blockers B1 and B2 rather than building
new tooling on top of the current inconsistent path assumptions. Recommend
Gate 3 scope includes: (a) deciding and implementing one canonical binary
root, (b) reconciling the two inconsistent source-path validators, and (c)
adding the "Not checked" rows from the coverage matrix that matter most for
the bake-off (GLB parse validity, duplicate-hash detection, rig/animation
presence) as durable, committed tooling rather than this audit's temporary
script.
