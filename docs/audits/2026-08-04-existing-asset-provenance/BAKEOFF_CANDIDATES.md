# Bake-off Candidate Shortlist

Last reviewed: 2026-08-04
Audited SHA: `22d2ffc002b0b3bbed988e8d698bd00c265f0b98`

Governs: candidate existing assets for the future reusable Meadowrest
browser/mobile production-room bake-off (work package 4 in
[`CODEX_SUPERVISOR_CONTINUATION.md`](../../authority/CODEX_SUPERVISOR_CONTINUATION.md)).
This is **not** an approved production asset list. It is a shortlist of the
strongest existing candidates, with fallbacks and blockers recorded, for the
bake-off team to select from. Selection here does not change any manifest
status.

Related: [`ASSET_PROVENANCE_AUDIT.md`](ASSET_PROVENANCE_AUDIT.md) · [`RUNTIME_ASSET_CROSSWALK.json`](RUNTIME_ASSET_CROSSWALK.json) · `packages/assets/sources/asset-sources.json`

---

## Player character

- **Runtime asset ID**: `player.adventurer`
- **Canonical source path**: `apps/client3d/public/models/kaykit-adventurers/Character.glb`
- **Pack/source ID**: `kaykit-adventurers`
- **Licence claim**: CC0-1.0
- **Evidence status**: `verified_local_evidence`
- **Format**: GLB (3.49 MB)
- **Triangle count**: not extracted by this audit (stdlib GLB parser used here reads counts and buffer metadata, not per-accessor vertex/index data; primitive count is 15, one mesh per primitive)
- **Materials/textures**: 1 material, 1 texture, 1 image (embedded in the binary chunk)
- **Rig and animations**: skinned, 41 joints, 76 named animation clips including `Idle`, `Walking_A`, `1H_Melee_Attack_Chop`, `1H_Melee_Attack_Stab`, `Sit_Floor_Idle`/`Sit_Floor_Down`/`Sit_Floor_StandUp` — all of which are directly referenced by string in `apps/game/src/world/GameWorld.tsx`.
- **Current runtime usage**: authoritative player and general-NPC rig; also reused for Mara Threadkeeper with procedural accessory overlays (`apps/game/src/world/characterPresentation.ts`).
- **Current status**: `approved-existing` in the visual manifest for `player.adventurer`/`player.base-body`.
- **Known mobile/performance risk**: none identified from metadata alone; 76 clips in one file is a reasonable single-file rig, but per-clip streaming cost on mobile was not measured in this audit.
- **Known visual-fit limitation**: the rig carries a baked-in `Knight_Helmet` mesh bound to the `head` bone that is always visible and occludes small head-attached accessories (documented first-hand in `apps/game/src/world/characterPresentation.ts`, citing a prior audit `CLAUDE_CHARACTER_ENVIRONMENT_FINISH_AUDIT.md` not present in this checkout — see Corrections section of the audit report).
- **Why strongest candidate**: only rigged humanoid character asset installed; already load-bearing for the current playable Meadowrest tutorial.
- **Fallback candidate**: none installed. A second humanoid rig would need to come from a new source (out of scope for this audit).
- **Unresolved blocker**: none for reuse as-is; the helmet-occlusion limitation constrains future character customisation art, not the bake-off itself.

## Mara / distinguishable NPC presentation

- **Runtime asset ID**: `player.adventurer` (reused) + `custom.npc-mara-shawl` (procedural overlay)
- **Canonical source path**: as above, plus `apps/game/src/world/assets.ts` (`proceduralMaraShawl`)
- **Pack/source ID**: `kaykit-adventurers` (base rig) + `everloom-original` (overlay)
- **Licence claim**: CC0-1.0 (rig) / Project original (overlay)
- **Evidence status**: `verified_local_evidence` for both
- **Format**: GLB + runtime THREE.js primitives (cone/dome/torus)
- **Current runtime usage**: Mara Threadkeeper NPC in Meadowrest.
- **Current status**: `approved-existing`.
- **Known visual-fit limitation**: shares the exact base silhouette with the player; only the shawl overlay and tint distinguish her.
- **Why strongest candidate**: only NPC-capable rig installed; the procedural overlay is real, working, first-party code, not a placeholder claim.
- **Fallback candidate**: none installed.
- **Unresolved blocker**: none for the bake-off; stronger NPC distinctiveness is a future art task.

## Enemy/creature representation

- **Runtime asset ID**: `enemy.skeleton-warrior`
- **Canonical source path**: `apps/client3d/public/models/kaykit-skeletons/Skeleton_Warrior.glb`
- **Pack/source ID**: `kaykit-skeletons`
- **Licence claim**: CC0-1.0
- **Evidence status**: `verified_local_evidence`
- **Format**: GLB (4.86 MB)
- **Materials/textures**: 2 materials, 1 texture, 1 embedded image
- **Rig and animations**: skinned, 41 joints, 95 named animation clips (superset of the player rig's clip names plus skeleton-specific spawn/awaken/death clips).
- **Current runtime usage**: `restless_skeleton` combat enemy in Meadowrest.
- **Current status**: `approved-existing` for `enemy.skeleton-warrior`; also carries a second manifest entry `creature.grove-wolf` at `licensed-placeholder` (see below).
- **Known mobile/performance risk**: none identified from metadata alone; largest single GLB currently registered (4.86 MB).
- **Why strongest candidate**: only combat-capable enemy rig installed; genuine humanoid enemy fit for a skeleton encounter.
- **Fallback candidate**: `kaykit-skeletons/Skeleton_Minion.glb`, `Skeleton_Rogue.glb`, `Skeleton_Mage.glb` are installed (per `apps/client3d/ASSET_INVENTORY.md`) but have **no runtime registry entry** — they exist on disk only. If additional skeleton variety is wanted for the bake-off room, registering these (not downloading anything new) is the lowest-cost option.
- **Unresolved blocker**: none for a skeleton-type enemy.

### Wolf / non-humanoid creature — no asset exists

**No quadruped or wolf-shaped model is installed anywhere in this repository.** The only character-category rigs present are `kaykit-adventurers/Character.glb` (humanoid) and the four `kaykit-skeletons/*.glb` files (humanoid). Do not treat `enemy.skeleton-warrior` as a wolf asset.

- **Current manifest state**: `creature.grove-wolf` is recorded at `currentStatus: licensed-placeholder`, `currentAssetId: enemy.skeleton-warrior`, with `productionNotes` stating no wolf model exists and this is a thematically-mismatched placeholder. This is the least-misleading representation already in place — it does not invent a wolf, and it is truthfully labelled.
- **Recommendation for the bake-off room**: if a wolf-shaped encounter is needed for the representative room, either (a) omit the wolf entirely and use the already-integrated `restless_skeleton` for the enemy role, or (b) continue using the existing `creature.grove-wolf` placeholder exactly as manifest-labelled, without upgrading its manifest status. Do not introduce a new "temporary" quadruped substitute without an equivalent truthful placeholder record — that would just move the same problem.
- **Unresolved blocker**: a real quadruped/wolf asset does not exist in the repository and this audit did not download one, per scope.

## Worn Hatchet

- **Runtime asset ID**: `custom.tool-hatchet`
- **Canonical source path**: `apps/game/src/world/assets.ts` (`proceduralTool`, runtime-generated geometry)
- **Pack/source ID**: `everloom-original`
- **Licence claim**: Project original
- **Evidence status**: `verified_local_evidence` (first-party code, not an external claim)
- **Format**: procedural THREE.js geometry (no file)
- **Current runtime usage**: starter tool, ground item and equipped tool; has dedicated Playwright coverage (`apps/game/tests/worn-hatchet-interaction.spec.ts`).
- **Current status**: `procedural-placeholder` (ground-item manifest entry currently `missing`, per the audit report's inventory).
- **Known visual-fit limitation**: low-poly primitive geometry, not a produced model.
- **Why strongest candidate**: it is the *only* candidate — no installed CC0 pack contains a standalone hatchet, and it is already load-bearing for the one existing browser test.
- **Fallback candidate**: none installed.
- **Unresolved blocker**: none for bake-off reuse; a produced hatchet model remains future art work.

## Woodcutting tree/resource

- **Runtime asset ID**: `nature.oak`
- **Canonical source path**: `apps/client3d/public/models/kenney-nature/tree_oak.glb`
- **Pack/source ID**: `kenney-nature`
- **Licence claim**: CC0-1.0
- **Evidence status**: `verified_local_evidence`
- **Format**: GLB
- **Current runtime usage**: primary Meadowrest woodcutting node.
- **Current status**: `approved-existing`.
- **Why strongest candidate**: already the production node for the one implemented gathering loop with real Playwright coverage.
- **Fallback candidate**: `nature.oak-fall`, `nature.pine` — both installed and registered, different silhouettes for variety.
- **Unresolved blocker**: none.

## Large canopy/background tree

- **Runtime asset ID**: `nature.tree-detailed`
- **Canonical source path**: `apps/client3d/public/models/kenney-nature/tree_detailed.glb`
- **Pack/source ID**: `kenney-nature`
- **Licence claim**: CC0-1.0
- **Evidence status**: `verified_local_evidence`
- **Current runtime usage**: dense-silhouette canopy trees across Meadowrest; also currently reused as the Verdant Grove Ironbark tree placeholder (`vegetation.ironbark-tree`, `licensed-placeholder`).
- **Current status**: `approved-existing` (own role) / `licensed-placeholder` (Ironbark substitution).
- **Why strongest candidate**: largest scale value in the tree category (2.15), already proven in multiple zone locations.
- **Fallback candidate**: `nature.tree-round`.
- **Unresolved blocker**: none for background use; the Ironbark-specific substitution remains explicitly unresolved (see the Verdant Grove authority file).

## Rocks or cliff framing

- **Runtime asset ID**: `nature.cliff-block` (primary), `nature.cliff-large`, `nature.rock-tall`, `nature.rock-tall-b`
- **Canonical source path**: `apps/client3d/public/models/kenney-nature/cliff_block_rock.glb` and siblings
- **Pack/source ID**: `kenney-nature`
- **Licence claim**: CC0-1.0
- **Evidence status**: `verified_local_evidence`
- **Current runtime usage**: quarry back wall and world-edge framing.
- **Current status**: `approved-existing`.
- **Why strongest candidate**: already composed into the existing quarry framing with confirmed variety across four registered pieces.
- **Fallback candidate**: `nature.rock-large`/`nature.rock-small` for closer-in framing.
- **Unresolved blocker**: none.

## Cottage or village structure

- **Runtime asset ID**: `town.cottage`
- **Canonical source path**: `composite://kenney-fantasy/cottage` — runtime composition of `kenney-fantasy/wall.glb`, `wall-door.glb`, `wall-window-shutters.glb`, `roof-gable.glb`, `roof-gable-end.glb`, `chimney.glb` (`apps/game/src/world/assets.ts`, `buildCottage`)
- **Pack/source ID**: `everloom-composite` (composition) over `kenney-fantasy` (pieces)
- **Licence claim**: CC0-1.0 (all constituent pieces)
- **Evidence status**: `verified_local_evidence`
- **Current runtime usage**: three cottages placed in Meadowrest (`cottage_west`, `cottage_east`, `cottage_south`) plus the river mill house.
- **Current status**: `approved-existing`.
- **Why strongest candidate**: Kenney Fantasy Town Kit ships no single `house.glb` (documented in `apps/client3d/ASSET_INVENTORY.md`); the existing runtime composition already solves this without any placeholder.
- **Fallback candidate**: none needed — the composite is production-quality (unmodified CC0 pieces, no procedural placeholder geometry).
- **Unresolved blocker**: none.

## Bridge

- **Runtime asset ID**: `nature.bridge`
- **Canonical source path**: `apps/client3d/public/models/kenney-nature/bridge_wood.glb`
- **Pack/source ID**: `kenney-nature`
- **Licence claim**: CC0-1.0
- **Evidence status**: `verified_local_evidence`
- **Current runtime usage**: river crossing in Meadowrest.
- **Current status**: `approved-existing`.
- **Why strongest candidate**: only bridge asset installed and already in production use.
- **Fallback candidate**: none installed.
- **Unresolved blocker**: none.

## Facility/campfire

- **Runtime asset ID**: `nature.campfire`
- **Canonical source path**: `apps/client3d/public/models/kenney-nature/campfire_stones.glb`
- **Pack/source ID**: `kenney-nature`
- **Licence claim**: CC0-1.0
- **Evidence status**: `verified_local_evidence`
- **Current runtime usage**: cooking fire facility.
- **Current status**: `approved-existing`.
- **Why strongest candidate**: only campfire asset installed and already in production use; also reused for the Verdant Grove Hearth.
- **Fallback candidate**: none installed. Smelter and anvil facilities have no installed model at all and use first-party procedural geometry (`custom.facility-smelter`, `custom.facility-anvil`) — record this as a related gap, not a candidate substitution.
- **Unresolved blocker**: none.

## Path or ground detail

- **Runtime asset ID**: `nature.path-rocks`
- **Canonical source path**: `apps/client3d/public/models/kenney-nature/ground_pathRocks.glb`
- **Pack/source ID**: `kenney-nature`
- **Licence claim**: CC0-1.0
- **Evidence status**: `verified_local_evidence`
- **Current runtime usage**: path-edge detail.
- **Current status**: `approved-existing`.
- **Why strongest candidate**: only path-specific ground-detail asset installed and registered.
- **Fallback candidate**: `nature.stump-round`/`nature.stump-old`/`nature.log` for grove-floor variety.
- **Unresolved blocker**: none.

## Shoreline detail

- **Runtime asset ID**: `nature.lily-pad`, `nature.rock-flat`
- **Canonical source path**: `apps/client3d/public/models/kenney-nature/lily_large.glb`, `rock_smallFlatA.glb`
- **Pack/source ID**: `kenney-nature`
- **Licence claim**: CC0-1.0
- **Evidence status**: `verified_local_evidence`
- **Current runtime usage**: riverbank composition.
- **Current status**: `approved-existing`.
- **Why strongest candidate**: only shoreline-specific detail pieces installed and registered.
- **Fallback candidate**: none needed.
- **Unresolved blocker**: none.

## Water presentation

- **Runtime asset ID**: none — **procedural implementation** (`buildWater` in `apps/game/src/world/environment.ts`, a `THREE.ShaderMaterial`-based mesh, no external model or texture).
- **Pack/source ID**: `everloom-original`
- **Licence claim**: Project original
- **Evidence status**: `verified_local_evidence` (first-party code)
- **Current runtime usage**: all Meadowrest water surfaces.
- **Current status**: not in the visual-production manifest under a runtime asset ID (procedural, code-owned).
- **Why strongest candidate**: no water model or texture is installed in any pack; the existing shader implementation is real, working, first-party code, not a placeholder claim requiring further evidence.
- **Fallback candidate**: none needed.
- **Unresolved blocker**: none for the bake-off; visual quality/performance of the shader on mobile has not been measured.

## Animation sets

All animation candidates come from the two rigged registry assets above (`player.adventurer`, `enemy.skeleton-warrior`), which share the same 41-joint skeleton naming and largely overlapping clip names.

| Need | Clip name (confirmed present) | Confirmed code reference |
|---|---|---|
| Idle | `Idle` | `apps/game/src/world/GameWorld.tsx` |
| Walk/run | `Walking_A` (also `Walking_B`, `Walking_C`, `Walking_Backwards`, `Running_A`, `Running_B`) | `apps/game/src/world/GameWorld.tsx` |
| Woodcutting | `1H_Melee_Attack_Chop` (reused as the chop action; no dedicated "woodcutting" clip exists in either rig) | `apps/game/src/world/GameWorld.tsx` |
| Melee | `1H_Melee_Attack_Chop`, `1H_Melee_Attack_Stab` | `apps/game/src/world/GameWorld.tsx` |
| NPC idle/dialogue | `Idle` (Mara reuses the player rig; no dedicated dialogue/gesture clip is used) | `apps/game/src/world/GameWorld.tsx` |

**Limitation**: there is no animation clip named for woodcutting specifically; the game currently repurposes a melee chop animation for the gathering action. This is a real, working choice, not a placeholder claim, but it is a visual-fit compromise worth flagging for the bake-off review.

---

## Summary: roles with no credible existing candidate

- **Wolf/quadruped creature** — none installed; see above.
- **Smelter and anvil facility models** — none installed; both use first-party procedural geometry today (`custom.facility-smelter`, `custom.facility-anvil`), which is a legitimate but unmodelled placeholder.
- **Dedicated woodcutting animation clip** — none exists in either installed rig; melee chop is reused.

This is a candidate set for the bake-off, not an approved production asset list.
