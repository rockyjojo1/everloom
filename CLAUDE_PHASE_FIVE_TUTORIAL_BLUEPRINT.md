# Everloom Phase Five — Tutorial Blueprint (Smithing)

Author: Claude (design/audit only, no production code changed)
Date: 1 August 2026
Base commit: `afcedb0` (`codex/phase-four-combat-progression`)
Worktree: `D:\Downloads\Everloom-claude-phase-five-design` on branch `claude/phase-five-tutorial-design`
Companion, NOT read by this author: Codex's `codex/phase-five-smithing-foundation` branch in the other worktree (`D:\Downloads\Everloom`). Everything below is derived independently from the shipped Phase Four code, not from Codex's in-progress work, per this task's isolation constraint.

## How this document was produced

Everything stated as fact below was checked directly in this worktree:

- `pnpm install` succeeded (12.1s, no network downloads — shared pnpm store).
- `pnpm --filter @everloom/core test` → **25/25 passed**.
- `pnpm --filter @everloom/content test` → **14/14 passed**.
- `pnpm --filter @everloom/game test` (vitest, includes `pathfinding.test.ts`) → **4/4 passed**.
- `pnpm typecheck` (turbo, all 8 workspace packages) → **13/13 tasks passed**.
- Every source file discussed below (`packages/core/src/*.ts`, `packages/content/src/*.ts`/`*.json`, `packages/assets/src/*`, `apps/game/src/**/*.ts(x)`, `apps/game/tests/*.spec.ts`) was opened and read in full, not inferred from filenames.
- The Meadowrest placement proposal was verified twice with throwaway `tsx` scripts that imported the **real, shipped** `blockedSet`/`findPath`/`pathToTarget`/`surfaceAt` from `apps/game/src/game/pathfinding.ts` against the **real** `CONTENT.zones.meadowrest`, including a run that added the two proposed facility interactables as real blocking cells and re-ran every existing `pathfinding.test.ts` target plus the new ones. Both scripts were deleted immediately after use; `git status --porcelain` is clean except for this document.
- I did **not** open, execute, or capture screenshots of the running 3D client (no dev server was started), so nothing here claims visual/frame-rate proof — that is called out explicitly wherever it matters.

---

## 1. Recommendation

**Add Smithing**, scoped much smaller than the ambitious `everloom-design.md` vision (that legacy doc describes ore tiers, Emberpeak, tradeable components — none of that is in scope here; it is cited only as background evidence that Mining→Smithing was always the intended pairing). Concretely:

- One new skill, `smithing`, added to `SkillId` but **not** added to the five-skill Verdant attunement gate.
- Two new facility interactables in the existing Meadowrest quarry: a **Copper Smelter** (ore → ingot) and an **Anvil** (ingot + log → weapon), reusing the exact same "facility + recipe" simulation path Cooking already uses.
- One new weapon reward, the **Copper Battleaxe**, a genuine upgrade over the tutorial Militia Sword.
- One new short quest, **The Forge's Trade**, chained after the existing `groves_gift` quest.
- Zero new binary 3D assets (see §12 — there is no forge/anvil model anywhere in the currently installed CC0 packs, and adding one would require touching `apps/client3d/public/models`, a directory the assignment says to leave alone). Two new **procedural** (code-generated) facility meshes instead, following the project's own established pattern.

### Why Smithing over the alternatives I actually considered

| Skill | Verdict | Reasoning |
|---|---|---|
| **Smithing** | **Recommended** | `copper_ore` (from the existing `meadowrest_copper` Mining resource) is mined by the tutorial today and then has **zero use** — it sits in the inventory forever. Smithing is the only candidate that fixes a real, already-existing dead resource instead of inventing a new one. It also reuses the `CookingActivity`/`facility`+`recipeId` code path in `simulation.ts` **verbatim** (see §9) — no new `Activity` variant, no new equipment slot, no new tool kind. And it is the only candidate that satisfies "one meaningful equipment choice that connects gathering/crafting to combat" with a literal weapon, not an indirect buff. |
| Fletching | Rejected | Would reuse `meadow_log`/`heartwood_log`, but those aren't dead resources (logs are already quest-required and burn into `verdant_tonic`). Fletching's payoff is a ranged weapon, but `combat.ts`/`simulation.ts` model a single opposed melee exchange with no ranged/ammo concept — adding one would be a bigger structural change than reusing the existing facility pattern. |
| Crafting (leatherworking) | Rejected | No hide/leather resource exists anywhere in `resources.json` or `enemies.json` (the only enemy, `restless_skeleton`, drops bones, not hides). Would require inventing an entire new resource chain from nothing — more new surface area than Smithing, no dead-resource fix. |
| Herblore/Alchemy | Rejected | Could reuse the same recipe/facility pattern, but the only unused "reagents" are `amber_sap`/`verdant_sap`, which are rare **collection** drops (`collection: true`) — consuming them in a recipe would fight their existing role as curios. Alchemy's natural payoff is a consumable buff, which is a weaker, less "tangible" answer to requirement 4 than armour/weapon gear. |
| Farming | Rejected | Not a tap-and-wait action; it needs a "plant, wait, return" mechanic that doesn't fit the existing `GatheringActivity`/`CookingActivity`/`CombatActivity` union without a new `Activity` type and new save fields — the single biggest-diff option of everything considered, for the least payoff. |

---

## 2. The exact player loop

1. Player already has a pickaxe (from The First Thread) and already mines `copper_ore` at the three existing `copper_north_*` nodes in the quarry (`meadowrest_copper` resource, unchanged).
2. Player walks ~1 grid cell further into the quarry to the new **Meadowrest Smelter** (`meadowrest_smelter`, kind `facility`), activates it, and smelts 2 `copper_ore` → 1 `copper_ingot` per action (no tool required, exactly like the Cooking Fire needs no tool).
3. Player walks one cell to the adjacent **Anvil** (`meadowrest_anvil`, kind `facility`) and smiths 2 `copper_ingot` + 2 `meadow_log` → 1 `copper_battleaxe`.
4. Player opens the Pack panel and equips the Copper Battleaxe in the `weapon` slot, replacing the Militia Sword (or leaves the sword equipped — this is a real choice, not forced).
5. XP is awarded to the new `smithing` skill on every successful smelt/smith, exactly like Cooking XP today.
6. Save/reload and offline behavior are free: `advanceSimulation` never inspects `recipe.skill`, so an interrupted smelt/smith resumes deterministically on reload or after any offline gap, with no new code (see §9).

This is a physical loop with a real landmark (two facility props), real pathfinding between them, real inputs/outputs, real XP, no new tool/equipment slot, and a real weapon reward — satisfying requirement 2 in full.

---

## 3. Quest integration — "The Forge's Trade"

Current quest chain (verified in `packages/content/src/data/quests.json`, `content-validation.test.ts`, and `core.test.ts`):

```
first_thread  --nextQuestId-->  verdant_loomstone  --nextQuestId-->  groves_gift  --nextQuestId--> (null today)
```

`groves_gift` is the existing 2-step epilogue quest (gather Heartwood, brew Verdant Tonic) that plays after the Verdant Loomstone is awakened. Phase Five adds one more short epilogue after it — it does **not** touch `first_thread` or `verdant_loomstone`, and it deliberately does **not** join the 5-skill Verdant attunement gate (see §8 for why that would break existing tests/schema).

Change `groves_gift.nextQuestId` from `null` to `"forge_trade"` and append:

```json
{
  "id": "forge_trade",
  "name": "The Forge's Trade",
  "summary": "Village iron is thin work, but the quarry has copper enough to start. Learn what Meadowrest's forge can make.",
  "steps": [
    { "id": "mine_forge_copper", "kind": "gather", "objective": "Mine four Copper Ore from the northern quarry.", "targetId": null, "itemId": "copper_ore", "count": 4 },
    { "id": "smelt_ingots", "kind": "cook", "objective": "Smelt two Copper Ingots at the Meadowrest Smelter.", "targetId": null, "itemId": "copper_ingot", "count": 2 },
    { "id": "smith_battleaxe", "kind": "cook", "objective": "Forge a Copper Battleaxe at the Anvil.", "targetId": null, "itemId": "copper_battleaxe", "count": 1 },
    { "id": "equip_battleaxe", "kind": "equip", "objective": "Equip the Copper Battleaxe.", "targetId": null, "itemId": "copper_battleaxe", "count": 1 }
  ],
  "nextQuestId": null,
  "completionFlag": "forge_trade_completed"
}
```

Notes verified against `packages/core/src/quests.ts`:
- `kind: "cook"` and `kind: "gather"` both match on `item_gained` events regardless of source (`eventMatchesStep`), which is exactly how `groves_gift`'s `brew_verdant_tonic` step already works for a non-cooking-named recipe output — no quest-engine change needed, it is already generic.
- No `attune` step is used, so the schema's `count === 5` refine constraint (`schemas.ts` line 93-96) is untouched.
- 4 steps is comparable to `groves_gift`'s 2 steps plus the 2-stage craft chain Smithing needs (mine → smelt → smith → equip); far shorter than `first_thread`'s 16 steps.
- No explicit "gather 2 meadow_log" step: the player already gathered ≥3 `meadow_log` earlier in `first_thread` with nothing that ever consumes it, so they will already hold enough. If not, the recipe naturally stops with `inputs_exhausted` (existing HUD feedback), exactly like `groves_gift`'s brew step silently assumes a spare `raw_riverling`.

---

## 4. Equipment reward and the combat tie-in (requirement 4)

Verified against `packages/core/src/combat.ts` and the passing assertions in `apps/game/tests/combat-progression.spec.ts` (which prove, at melee level 5 with the Militia Sword equipped, HUD text `Accuracy35`, `Max hit7`, `Defence20`):

```
accuracy = 12 + level*3 + Σ(equipped combatBonuses.accuracy)
maxHit   = max(1, 2 + floor(level/4)) + Σ(equipped combatBonuses.strength)
defence  = 10 + level*2 + Σ(equipped combatBonuses.defence)
```

At level 5: unarmed accuracy 27, maxHit 3, defence 20. Militia Sword (`{accuracy:8, strength:4, defence:0}`) → 35 / 7 / 20 (matches the shipped test exactly, confirming I have the live formula, not a guess).

Proposed **Copper Battleaxe**: `{accuracy: 13, strength: 8, defence: 0}` → at level 5, accuracy 40 (+5 over the sword), maxHit 11 (+4 over the sword). A genuine, optional upgrade in the same `weapon` slot as the Militia Sword — equipping it is a real choice (give up the free tutorial sword for a crafted one), and it is intentionally a strict upgrade with no downside, matching the existing precedent set by the Boneguard Vest (`+10 defence`, no downside) in Phase Four.

---

## 5. Proposed content — items, recipes, facilities, balance

Current content sizes (counted directly from the JSON, not estimated): 14 items, 4 resources, 2 recipes, 1 enemy, 3 quests, 1 zone with 19 interactables / 105 scenery pieces, 65 asset registry entries.

### New items (`packages/content/src/data/items.json`)

```json
{
  "id": "copper_ingot",
  "name": "Copper Ingot",
  "description": "A cooled bar of smelted quarry copper, ready for the anvil.",
  "category": "resource",
  "stackable": true,
  "maxStack": 99,
  "iconId": "icon.ingot",
  "worldAssetId": "nature.rock-large",
  "equipmentSlot": null,
  "toolKind": null,
  "healAmount": 0,
  "value": 9,
  "collection": false,
  "combatBonuses": null
},
{
  "id": "copper_battleaxe",
  "name": "Copper Battleaxe",
  "description": "A forge-fresh battleaxe, heavier and truer than a village blade.",
  "category": "weapon",
  "stackable": false,
  "maxStack": 1,
  "iconId": "icon.battleaxe",
  "worldAssetId": "custom.weapon-sword",
  "equipmentSlot": "weapon",
  "toolKind": null,
  "healAmount": 0,
  "value": 20,
  "collection": false,
  "combatBonuses": { "accuracy": 13, "strength": 8, "defence": 0 }
}
```

`copper_ingot.worldAssetId` reuses the already-registered `nature.rock-large` (never actually spawned in the world — it exists only to satisfy the schema's "every item needs a registered asset" rule, exactly like `cooked_riverling` reuses the unrelated `custom.fishing-ripples` for the same reason). `copper_battleaxe.worldAssetId` reuses the procedural `custom.weapon-sword` mesh (see §12 for the honest limitation this creates, and the optional fix).

### New recipes (`packages/content/src/data/recipes.json`)

```json
{
  "id": "smelt_copper_ore",
  "name": "Smelt Copper Ore",
  "skill": "smithing",
  "actionDurationMs": 2600,
  "xpPerSuccess": 30,
  "inputs": [{ "itemId": "copper_ore", "quantity": 2 }],
  "output": { "itemId": "copper_ingot", "quantity": 1 },
  "facilityKind": "forge"
},
{
  "id": "smith_copper_battleaxe",
  "name": "Smith Copper Battleaxe",
  "skill": "smithing",
  "actionDurationMs": 3600,
  "xpPerSuccess": 60,
  "inputs": [{ "itemId": "copper_ingot", "quantity": 2 }, { "itemId": "meadow_log", "quantity": 2 }],
  "output": { "itemId": "copper_battleaxe", "quantity": 1 },
  "facilityKind": "forge"
}
```

Balance reasoning, anchored to existing numbers rather than invented from scratch: `cook_riverling` is 30xp/2500ms, `cook_verdant_tonic` is 40xp/3000ms — the two existing recipes. `smelt_copper_ore` (30xp/2600ms) sits right alongside `cook_riverling`. `smith_copper_battleaxe` (60xp, the new highest recipe XP) is deliberately the biggest single recipe reward in the game, reflecting that it is the "complete the loop" action, in the same spirit as `restless_skeleton`'s 45xp being the biggest single reward before it.

Full resource cost to reach one battleaxe: 4 `copper_ore` (2 smelts) + 2 `meadow_log`. At the existing `meadowrest_copper` resource's `actionDurationMs: 3200` and `successChancePpm: 1_000_000` (always succeeds), that's ~13s of mining, ~5.2s of smelting, ~3.6s of smithing — a few minutes of total play including walking, not a grind wall. This matches "keep the quest short," not the multi-day pacing language in the legacy `scripts/pace-sim.ts` (which is stale — it reads `packages/gamedata/src/data/nodes.json`, part of the unrelated `apps/client3d`/`apps/web` stack, not `packages/content`, and should not be used as a balance reference for this game).

### Mastery: deliberately not added

`ResourceDefinition` carries `masteryXpPerAttempt`/`masterySpeedPpmPerRank`/`masteryRarePpmPerRank`; `RecipeDefinition` does not, and `simulation.ts`'s `addMastery()` is only ever called from the **gathering** branch, never the **cooking** (facility/recipe) branch — Cooking has no mastery today. Since Smithing is modeled the same way as Cooking (facility + recipe, not a gather node), it should not have mastery either, for consistency with the one precedent that already exists. This is a deliberate decision, not an oversight.

### Inventory limits, save/reload, offline: no new rules needed

`copper_ore` (existing, `maxStack: 99`), `copper_ingot` (`maxStack: 99`, stackable), `copper_battleaxe` (`maxStack: 1`, not stackable) all flow through the existing generic `addItem`/`canAddItem`/`inventorySlots` system in `packages/core/src/inventory.ts` with zero changes. Save/reload and offline resumption are likewise free — see §9.

---

## 6. Exact Meadowrest placement — verified, not guessed

The quarry (`stone` terrain, `packages/content/src/data/zones.json` region `x:14,z:0,width:12,depth:7`) already holds the three `copper_north_*` ore nodes at `(18,3)`, `(21,3)`, `(23,5)`. I mapped the real blocked-cell grid there with a throwaway script importing the shipped `blockedSet`/`surfaceAt`:

```
Column header (x=12..28):
        12 13 14 15 16 17 18 19 20 21 22 23 24 25 26 27 28
z= 2:   .  .  .  #  .  .  .  .  .  .  .  .  .  .  .  .  .   (# = quarry_rock_1 blocking scenery at 15,2)
z= 3:   .  .  .  .  .  .  I  .  .  I  .  .  #  .  .  .  .   (copper_north_1 @18,3, copper_north_2 @21,3, quarry_rock_2 @24,3)
z= 5:   .  .  .  .  .  .  .  .  .  .  .  I  .  .  .  .  .   (copper_north_3 @23,5)
z= 6:   .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .  .   (fully open row)
```

Proposed sites: **`meadowrest_smelter` at `(15,5)`** and **`meadowrest_anvil` at `(16,6)`**, both on `stone` surface, both currently open cells with all four orthogonal neighbours open.

I then re-verified with a second script that actually **added** both as real `blocks: true` facility interactables to a copy of the zone and re-ran the exact same reachability check `pathfinding.test.ts` uses (`pathToTarget` + distance-to-radius assertion) against every affected target:

```
New stations blocked? true true
spawn -> meadowrest_smelter: REACHABLE (10 steps), final dist=1.00, radius=1
spawn -> meadowrest_anvil:   REACHABLE (9 steps),  final dist=1.00, radius=1
spawn -> copper_north_1:     REACHABLE (12 steps), final dist=1.00, radius=1
spawn -> copper_north_2:     REACHABLE (12 steps), final dist=1.00, radius=1
spawn -> copper_north_3:     REACHABLE (10 steps), final dist=1.00, radius=1
spawn -> first_loomstone:    REACHABLE (5 steps),  final dist=1.00, radius=1
spawn -> ground_worn_pickaxe:REACHABLE (9 steps),  final dist=0.00, radius=0
smelter -> anvil:            1 step  [{"x":16,"z":5}]   <- a real one-cell walk between the two stations
regression spawn -> oak_west_1:          REACHABLE (10 steps)
regression spawn -> verdant_loomstone:   REACHABLE (16 steps)
regression spawn -> verdant_heartwood_1: REACHABLE (14 steps)
regression spawn -> verdant_heartwood_2: REACHABLE (18 steps)
regression spawn -> grove_hearth:        REACHABLE (14 steps)
```

Nothing already in the world becomes unreachable, and the two new stations are themselves reachable and one grid-step apart, giving the "smelt, then walk to the anvil" beat real physical weight instead of being a menu action. This directly answers Phase Four's own documented mistake (`PHASE_FOUR_INTEGRATION_REPORT.md` finding #1: two decorative quarry cliffs were accidentally marked `blocks: true` and silently changed pathfinding). I deliberately re-ran the exact reachability check the shipped test suite uses, not just an eyeball check, precisely because that mistake happened before.

New interactables to append to `zones.json`'s `meadowrest.interactables`:

```json
{ "id": "meadowrest_smelter", "kind": "facility", "displayName": "Meadowrest Smelter", "assetId": "custom.facility-smelter", "x": 15, "z": 5, "resourceId": null, "itemId": null, "recipeId": "smelt_copper_ore", "enemyId": null, "quantity": 0, "interactionRadius": 1, "blocks": true },
{ "id": "meadowrest_anvil", "kind": "facility", "displayName": "Anvil", "assetId": "custom.facility-anvil", "x": 16, "z": 6, "resourceId": null, "itemId": null, "recipeId": "smith_copper_battleaxe", "enemyId": null, "quantity": 0, "interactionRadius": 1, "blocks": true }
```

I recommend **no** new decorative scenery around them — the zone already has 105 scenery pieces, and requirement 5 ("keep Meadowrest compact and readable") argues for the two functional props only, not a new visual set-piece.

---

## 7. Existing CC0 asset candidates — and the one genuinely important negative finding

I searched the full local catalog (`packages/assets/src/catalog.generated.json`, 554 models across `kaykit-adventurers` (1), `kaykit-dungeon` (40), `kaykit-skeletons` (17), `kenney-fantasy` (167), `kenney-nature` (329)) for `forge`, `anvil`, `smith`, `hammer`, `furnace`, `kiln`, `ingot`, `cauldron`, `oven`. **None exist.** There is no forge, anvil, or smithing-adjacent model anywhere in the currently installed CC0 packs.

This matters architecturally, not just artistically: `apps/game/vite.config.ts` serves `/models/*` via a dev middleware and a build-time `cpSync` that both point at `../client3d/public/models` — **apps/game has no model files of its own; every non-procedural asset is physically sourced from `apps/client3d/public/models`.** That directory is exactly the one this assignment says is off-limits (shared with the other worktree's separate, unrelated uncommitted `apps/client3d/*` task). Adding a new GLB-backed registry entry would mean adding a binary file there.

Both problems are solved the same way the project has already solved this exact situation four times before: `packages/content/src/data/items.json`'s `worn_hatchet`, `worn_pickaxe`, `worn_fishing_rod`, and `meadowrest_sword` are all `procedural://` entries, documented in `THIRD_PARTY_ASSETS.md`'s "Everloom-original geometry" section with the reasoning "the installed packs contain no suitable standalone model." I recommend the same pattern for the forge:

```json
{ "id": "custom.facility-smelter", "sourceFile": "procedural://facility/smelter", "pack": "everloom-original", "category": "facility", "scale": 1, "interactionType": "facility", "licence": "Project original", "sourceUrl": null, "notes": "Original low-poly geometry; the installed packs contain no smelter/kiln model." },
{ "id": "custom.facility-anvil", "sourceFile": "procedural://facility/anvil", "pack": "everloom-original", "category": "facility", "scale": 1, "interactionType": "facility", "licence": "Project original", "sourceUrl": null, "notes": "Original low-poly geometry; the installed packs contain no anvil model." }
```

Geometry spec for `apps/game/src/world/assets.ts`'s `procedural(id)` dispatcher (which today branches on `id.includes("hatchet"|"pickaxe"|"sword")` inside `proceduralTool()`, plus a separate `proceduralRipples()`): add two sibling builders.

- **Smelter**: a squat dark stone/brick block (~0.9m wide, 0.6m tall — box or short cylinder geometry, `MeshStandardMaterial` roughness ~0.9, dark grey-brown) with a small glowing interior — a short cone or torus using an emissive/basic material in warm orange (`~0xff6a2b`), echoing `nature.campfire`'s role but reading as industrial stone rather than a wood campfire.
- **Anvil**: a dark worked-iron block on a short wooden stump base — a flat top box (~0.5×0.15×0.25) with a tapered horn (cone or elongated box) on one end, `MeshStandardMaterial` roughness ~0.4 / metalness ~0.6 for a distinct "worked metal" look versus the matte tool geometry already in the file, sitting on a short cylinder (reuse the same wood material already defined for tool handles).

Both require **zero new binary files** and zero changes outside `apps/game/src/world/assets.ts` + `packages/assets/src/registry.json`. `packages/assets/scripts/validate-assets.mjs` only checks non-`://`-prefixed source files against the model directory, so `procedural://` entries pass validation automatically (confirmed by reading the script — it does `if (asset.sourceFile.includes("://")) continue;` before the file-existence check).

**Optional, not required**: `copper_battleaxe` currently reuses the `custom.weapon-sword` procedural mesh, so in-world it will render identically to the Militia Sword. If a visually distinct upgrade matters, extend `proceduralTool()`'s `id.includes(...)` chain with a `battleaxe` branch (wider blade geometry) — a small, contained, zero-binary addition to the same function. I did not make this mandatory because the equipment choice is already meaningful in stats and inventory/HUD icon (a new `icon.battleaxe` SVG), independent of the 3D silhouette.

---

## 8. Exact files/contracts to change

### `packages/core/src`
- **`types.ts`**: `SkillId` → add `"smithing"`. `RecipeDefinition.skill: "cooking"` → `"cooking" | "smithing"`. `RecipeDefinition.facilityKind: "cooking_fire"` → `"cooking_fire" | "forge"`. `SAVE_VERSION` → `3`.
- **`progression.ts`**: `emptySkills()` → add `smithing: { xp: 0 }`. `ATTUNEMENT_SKILLS` **unchanged** (stays the 5 original skills — see below for why).
- **`save.ts`**: add `migrateV2ToV3` (see §8b). Chain the dispatcher so a v1 save runs v1→v2→v3. Widen the version-acceptance guard from `!== SAVE_VERSION && !== 1` to accept `1`, `2`, or current.
- **`core.test.ts`**: the "never over-counts" test (`ATTUNEMENT_SKILLS` describe block, ~line 341) builds a manual `skills: {...}` object literal missing `smithing` — once `GameSave["skills"]` is `Record<SkillId, SkillProgress>` with `smithing` included, this literal needs `smithing: { xp: 0 }` added or TypeScript fails to compile. The four `saveVersion` migration tests hardcode `.toBe(2)` in one assertion and build v1-fixture `skills: {...}` literals in two others — these need the same treatment plus new coverage for the v2→v3 step (see §8b). Add new tests: a smithing recipe simulated end-to-end through `advanceSimulation` (reusing the existing `TEST_CONTENT` pattern with an added `forge` recipe fixture), and explicit v1→v3 / v2→v3 migration coverage.

### `packages/content/src`
- **`schemas.ts`**: `recipeSchema.skill: z.literal("cooking")` → `z.enum(["cooking", "smithing"])`. `facilityKind: z.literal("cooking_fire")` → `z.enum(["cooking_fire", "forge"])`.
- **`data/items.json`**: add `copper_ingot`, `copper_battleaxe` (exact JSON in §5).
- **`data/recipes.json`**: add `smelt_copper_ore`, `smith_copper_battleaxe` (exact JSON in §5).
- **`data/zones.json`**: add `meadowrest_smelter`, `meadowrest_anvil` interactables (exact JSON in §6).
- **`data/quests.json`**: set `groves_gift.nextQuestId` to `"forge_trade"`; append the `forge_trade` quest (exact JSON in §3).
- **`content-validation.test.ts`**: add assertions mirroring the existing "Verdant Loomstone chapter" describe block — chain from `groves_gift` to `forge_trade`, `copper_battleaxe.combatBonuses` stronger than `meadowrest_sword`'s, the two new facilities exist with correct `recipeId` links.

### `packages/assets/src`
- **`registry.json`**: add `custom.facility-smelter`, `custom.facility-anvil` (exact JSON in §7). No change to `catalog.generated.json` (that file is machine-generated from `apps/client3d/public/models` by `build-catalog.mjs` — do not hand-edit it, and do not add binaries).

### `apps/game/src`
- **`world/assets.ts`**: extend the `procedural(id)` dispatcher with smelter/anvil builders (spec in §7).
- **`components/ItemIcon.tsx`**: add `icon.ingot` and `icon.battleaxe` inline SVG paths (same pattern as the 12 existing entries).
- **`game/pathfinding.test.ts`**: add assertions reaching `meadowrest_smelter` and `meadowrest_anvil` from spawn, mirroring the existing "reaches every Verdant Grove target from the village spawn" test.
- **`components/DebugPanel.tsx`** (optional, dev-only convenience): a "+ copper ore ×6" button and a "Force-complete Forge's Trade" button. Not required — `store.debugCompleteQuest(questId)` and `__EVERLOOM_TEST__.completeQuest(questId)` already accept any quest ID generically with zero `store.ts` changes.
- **`tests/forge-trade.spec.ts`** (new): see §14.

### `THIRD_PARTY_ASSETS.md`
- Add the two new `procedural://` entries to the existing "Everloom-original geometry" paragraph, matching its existing prose style.

### What does **not** need to change (verified, not assumed)
- `packages/core/src/simulation.ts` — **zero changes**. The `"cooking"` `Activity` branch never inspects `recipe.skill` except to pass it straight through to the already-generic `addXp(state, skill, amount)`; it only reads `recipe.inputs`/`output`/`actionDurationMs`/`xpPerSuccess`/`facilityKind` is never read at runtime at all (confirmed by `grep`, see §9).
- `apps/game/src/game/store.ts`, `apps/game/src/world/GameWorld.tsx` (except the asset registry lookup already described) — the facility/activity/animation plumbing is already fully generic over any recipe.
- `apps/game/src/components/Hud.tsx` — **zero changes**. It renders skills via `Object.entries(save.skills)`, mastery via `Object.entries(save.mastery)`, inventory via `CONTENT.items[stack.itemId]`, and quests via `Object.entries(save.quests)` — all already generic (verified by reading the full 190-line file). The hardcoded "Loomstone Network" section (`["First","Verdant","Tidal","Ember","Astral"]`) is deliberately left untouched — see §15.

---

## 8b. Save-version/migration implications — exact algorithm

`SAVE_VERSION` moves from `2` to `3`. The existing `migrateV1ToV2` (in `packages/core/src/save.ts`) conditionally seeds the `verdant_loomstone` quest for already-completed `first_thread` saves, recomputing attunement progress live rather than trusting stored counters. `migrateV2ToV3` should follow the same discipline:

```
function migrateV2ToV3(save: GameSave): GameSave {
  // Unconditional: no v1 or v2 save could possibly have smithing progress.
  const skills = save.skills.smithing ? save.skills : { ...save.skills, smithing: { xp: 0 } };
  // Conditional, mirroring migrateV1ToV2's pattern exactly: if groves_gift is
  // already completed and forge_trade hasn't been seeded yet, activate it —
  // it chains automatically for anyone who finishes groves_gift from now on,
  // this only matters for saves that reached groves_gift-completed under v2.
  const grovesGift = save.quests.groves_gift;
  const quests = grovesGift?.status === "completed" && !save.quests.forge_trade
    ? { ...save.quests, forge_trade: { status: "active" as const, stepIndex: 0, stepProgress: 0 } }
    : save.quests;
  return { ...save, saveVersion: SAVE_VERSION, skills, quests };
}
```

`migrateSave`'s dispatcher must chain rather than branch exclusively: a stored `saveVersion: 1` needs `migrateV1ToV2` **then** `migrateV2ToV3` applied in sequence, not either/or. The version-acceptance guard (`candidate.saveVersion !== SAVE_VERSION && candidate.saveVersion !== 1`) must become an explicit allow-list of `1 | 2 | 3` (current). The "rejects a genuinely unknown save version" test (`saveVersion: 99`) needs no change; it will still throw.

**Existing tests that will need deliberate edits, not silent breakage**: `core.test.ts`'s "upgrades a v1 save in place..." test asserts `migrated.saveVersion` `.toBe(2)` — this becomes `.toBe(3)`. The two v1-fixture tests that hand-build partial `skills: {...}` objects need no change (they don't reference `smithing` and TypeScript won't force it onto ad-hoc `{...createNewSave(...).skills, first_thread: ...}`-style spreads — only fully-manual `Record<SkillId, ...>`-typed literals need the new key, and I've identified exactly one of those, at the "never over-counts" test in §8).

**Why Smithing is not in `ATTUNEMENT_SKILLS`**: `ATTUNEMENT_SKILL_COUNT` is hardcoded to `5` and asserted directly (`core.test.ts` line 283: `expect(ATTUNEMENT_SKILL_COUNT).toBe(5)`), and `questSchema`'s `attune` step refine requires `count === 5` (`schemas.ts` line 93-96), and `content-validation.test.ts` asserts `verdant.steps[0]` matches `{ kind: "attune", count: 5, ... }`. Adding Smithing to the gate would break three independent, already-passing tests plus the schema contract for a quest that's already shipped and (per the save-migration tests) already completable by real players. Keeping Smithing outside the gate is not a compromise — it is what keeps this phase additive-only rather than requiring a breaking change to already-shipped content.

---

## 9. Deterministic simulation and offline rules

`advanceSimulation` (`packages/core/src/simulation.ts`) is fully deterministic — every roll goes through `deterministicRollPpm`/`deterministicRange`, which hash `(rngSeed, activitySequence, rollType, targetId)` via `fnv1a32`+`mix32` (`rng.ts`), no `Math.random` anywhere (enforced by an existing test that mocks `Math.random` to throw). The `"cooking"` `Activity` branch (used for both real cooking and the new smithing recipes) does not special-case `recipe.skill` anywhere except the one `addXp(state, recipe.skill, recipe.xpPerSuccess)` call, and `addXp` is already generic over any `SkillId`. This means:

- **Offline resumption is free.** `useGameStore.initialize()` calls `calculateOfflineElapsed` then `advanceSimulation(save, elapsed, CONTENT)` on load, exactly as it does for cooking today — an in-progress smelt/smith left mid-action when the tab closed will complete (or repeat, bounded by `inputs_exhausted`/`inventory_full`) the same way an in-progress cook does.
- **Save/reload mid-activity is free.** `core.test.ts`'s "retains the same result across a serialized mid-activity reload" test already proves this invariant generically for the cooking `Activity` type; it will hold for smithing recipes without new test infrastructure, only new fixture data.
- **Time-partition invariance is free.** The existing "produces the same final state for sixty one-minute updates and one sixty-minute update" test exercises the same code path.

I verified this by `grep`-ing every reference to `facilityKind` in the repository (four: the schema, the type, the two existing recipe JSON entries) — it is never read by any runtime code, only used for content typing/documentation. This is why widening it is zero-risk.

---

## 10. UI changes — genuinely minimal

Confirmed by reading the full `Hud.tsx` (190 lines) end to end:

- **Skills panel**: automatic. Iterates `Object.entries(save.skills)`; `smithing` will appear the moment it exists in the save.
- **Mastery panel**: automatic (and correctly empty for Smithing — see §5).
- **Combat profile**: automatic. `save.equipment.weapon` name and derived stats already read live from `CONTENT.items`/`combat.ts`.
- **Inventory panel**: automatic. Any item with `equipmentSlot` set gets an "Equip" button; any item renders via `ItemIcon` once its `iconId` exists.
- **Quest panel**: automatic. Renders any quest's steps generically; the `attune`-specific rendering branch is not triggered because `forge_trade` uses no `attune` step.
- **Activity/objective banner**: automatic, already reads `CONTENT.recipes[activity.recipeId]` generically for name/duration.
- **Loomstone Network section**: intentionally **not** touched (§15).

The only required non-generic UI work is the two new inline SVG icons in `ItemIcon.tsx` (§8). Everything else is a data-only change.

---

## 11. Automated regression matrix

Run in this order (matches the project's own `build`/`test` script wiring):

1. **Typecheck** — `pnpm typecheck` (turbo, all 8 packages). Baseline today: 13/13 tasks pass.
2. **Core unit** — `pnpm --filter @everloom/core test`. Baseline: 25/25. Add: smithing recipe simulated end-to-end (fixture-based, mirrors the existing cooking tests), v2→v3 migration test, chained v1→v3 migration test, updated `saveVersion` assertion.
3. **Content validation** — `pnpm --filter @everloom/content test`. Baseline: 14/14. This suite already re-validates **all** content generically via `buildValidatedContent()`, so the new items/recipes/interactables/quest are cross-reference-checked for free the moment they're added; add the explicit assertions from §8 on top.
4. **Game unit (pathfinding)** — `pnpm --filter @everloom/game test`. Baseline: 4/4. Add the two new reachability assertions (§6).
5. **Asset validation** — part of `pnpm --filter @everloom/assets build` (`validate-assets.mjs`). Baseline: "Validated 65 semantic assets and 554 catalog models." Expect 67 semantic assets after adding the two procedural entries; catalog count unchanged (no new binaries).
6. **Production build + bundle budget** — `pnpm --filter @everloom/game build` (runs `tsc --noEmit && vite build && node scripts/check-bundle.mjs`). Must stay under the enforced 400 KiB player-entry budget (see §12 for current headroom).
7. **Browser/e2e (both `desktop` and `landscape-mobile` Playwright projects, per `playwright.config.ts`)**:
   - All existing specs must still pass: `foundation.spec.ts`, `phase-one-flow.spec.ts`, `player-flow.spec.ts`, `verdant-loomstone.spec.ts`, `combat-progression.spec.ts`, `phase-four-world-polish.spec.ts` (including its explicit `≤350` draw-call assertion — re-check this at the new forge location too, since new geometry adds draw calls even if procedural), `visual-capture.spec.ts`, `phase-three-artifacts.spec.ts`.
   - New `forge-trade.spec.ts`, structured like `verdant-loomstone.spec.ts`: use `completeQuest("groves_gift")` to skip to the new content quickly (matching the existing precedent of not re-walking already-proven earlier flows), then do the smelt/smith/equip loop **for real** through `activateTarget`/`simulate`/`stop`, assert the quest completes, assert the combat profile actually changes after equipping (`Accuracy40`, `Max hit11` at level 5 — computed in §4), assert save/reload persistence of the new equipment and quest state, assert an offline gap (`debugSimulateOffline`) completes an in-progress smelt.
8. **Production PWA** — `pnpm --filter @everloom/game test:pwa`. No precache config changes needed (procedural assets add no binaries to precache), but re-run as a full gate since the JS bundle itself grows.

---

## 12. Mobile/performance/bundle risk and budgets

Verified current numbers from `PHASE_FOUR_INTEGRATION_REPORT.md` (produced by that phase's own measured, enforced build, not estimated by me): production player entry **297.2 KiB raw / 85.20 KiB gzip**, enforced budget **400 KiB raw** (`apps/game/scripts/check-bundle.mjs`, hard-fails the build above that line) — **~102.8 KiB raw headroom today**. PWA precache: 11 entries / 999.82 KiB.

Phase Five's addition is: ~40-60 lines of procedural geometry in `assets.ts`, two small `zod` schema widenings, six new JSON content records (2 items, 2 recipes, 2 interactables) plus one quest, two inline SVG icon paths. This is JSON/code growth, not asset weight — no new GLB, no new texture, no new precache entry. I expect low-single-digit-KiB raw growth, comfortably inside the ~103 KiB headroom, but this is a **prediction**, not a measurement — I did not build production and run `check-bundle.mjs` against the actual new content (that would require writing the production files, which this design-only task must not do). Codex must run step 6 of §11 and treat a budget failure as a real blocker.

Draw-call risk: the existing enforced ceiling is `≤350` draws at Meadowrest (Phase Four measured 272 desktop / 307 iPhone-landscape against that ceiling — real headroom is 43-78 draws). Two new low-poly procedural props (each likely 1-3 draw calls, similar to the existing procedural tools) should fit easily, but this must be **measured**, not assumed — extend `phase-four-world-polish.spec.ts`'s pattern (or the new `forge-trade.spec.ts`) to capture a screenshot and re-check the draw-call ceiling with the player standing at the forge, on both `desktop` and `landscape-mobile` projects.

No real-device iPhone measurement exists anywhere in this project's history (the Phase Four report says so explicitly — SwiftShader software rendering is the only available proxy in this sandbox). This blueprint changes nothing about that limitation; it inherits it.

---

## 13. Dependency-ordered implementation plan

1. `packages/core/src/types.ts` — widen `SkillId`, `RecipeDefinition.skill`, `RecipeDefinition.facilityKind`, bump `SAVE_VERSION`.
2. `packages/core/src/progression.ts` — `emptySkills()` gains `smithing: { xp: 0 }`.
3. `packages/core/src/save.ts` — add `migrateV2ToV3`, chain the dispatcher, widen the version guard.
4. `packages/core/src/core.test.ts` — fix the one manual `skills` literal that will now fail to compile; update the `saveVersion` assertion; add v2→v3 and chained v1→v3 migration tests; add an end-to-end smithing-recipe simulation test using a fixture recipe.
5. Run `pnpm --filter @everloom/core test` — must pass before touching content.
6. `packages/content/src/schemas.ts` — widen `recipeSchema.skill`/`facilityKind` enums.
7. `packages/content/src/data/items.json` — add `copper_ingot`, `copper_battleaxe`.
8. `packages/content/src/data/recipes.json` — add `smelt_copper_ore`, `smith_copper_battleaxe`.
9. `packages/assets/src/registry.json` — add `custom.facility-smelter`, `custom.facility-anvil`.
10. `packages/content/src/data/zones.json` — add `meadowrest_smelter`, `meadowrest_anvil` interactables at `(15,5)`/`(16,6)`.
11. `packages/content/src/data/quests.json` — set `groves_gift.nextQuestId`, append `forge_trade`.
12. `packages/content/src/content-validation.test.ts` — add the new assertions.
13. Run `pnpm --filter @everloom/content test` — cross-reference validation must pass before touching the client.
14. `apps/game/src/world/assets.ts` — add the smelter/anvil procedural builders.
15. `apps/game/src/components/ItemIcon.tsx` — add `icon.ingot`, `icon.battleaxe`.
16. `apps/game/src/game/pathfinding.test.ts` — add the two new reachability assertions.
17. Run `pnpm --filter @everloom/game test` — must pass.
18. (Optional) `apps/game/src/components/DebugPanel.tsx` — convenience buttons.
19. `THIRD_PARTY_ASSETS.md` — document the two new procedural entries.
20. `pnpm typecheck` (full monorepo) — must pass.
21. `apps/game/tests/forge-trade.spec.ts` — new e2e spec (§11 point 7).
22. Extend `phase-four-world-polish.spec.ts` (or the new spec) with a forge-site screenshot + draw-call assertion on both Playwright projects.
23. `pnpm --filter @everloom/game build` — confirm `check-bundle.mjs` still passes; record the real new bundle size.
24. `pnpm --filter @everloom/game test:e2e` — full suite, both projects.
25. `pnpm --filter @everloom/game test:pwa` — full PWA regression.
26. Update whichever integration report this phase produces with the real, measured numbers (bundle size, draw calls, test counts) — do not carry forward this document's predicted numbers as if they were measured.

---

## 14. Do-not-change boundaries

- Do not add Smithing to `ATTUNEMENT_SKILLS` / touch the 5-skill Verdant gate, its schema `count: 5` constraint, or any of the three tests that assert it (§8b).
- Do not touch `apps/client3d/**` at all, including its `public/models` directory — this phase must ship with zero new binary assets specifically because of that constraint (§7).
- Do not touch `packages/engine/**` or `packages/gamedata/**` — those back the unrelated legacy `apps/client3d`/`apps/web` stack, not `apps/game` (confirmed by `package.json` dependency graphs — `apps/game` depends on `@everloom/core`/`@everloom/content`/`@everloom/assets` only).
- Do not hand-edit `packages/assets/src/catalog.generated.json` — it is machine-generated by `build-catalog.mjs` from `apps/client3d/public/models`.
- Do not modify `simulation.ts`'s activity loop — the whole point of modeling Smithing as a second `facility`+`recipeId` consumer is that it requires zero changes there (§9).
- Do not regenerate the production build or catalog output as part of this design pass (per the assignment).
- Do not touch `PHASE_FOUR_INTEGRATION_REPORT.md`, `PHASE_THREE_INTEGRATION_REPORT.md`, `CLAUDE_PHASE_THREE_HANDOFF.md`, or any other existing report/handoff file.
- Root `CREDITS.md` and `scripts/pace-sim.ts` are stale (they describe the legacy `apps/web` LPC-pixel-art stack and the legacy `packages/gamedata`, not this game) — do not use them as a reference for this phase, and do not "fix" them as part of this work; that is out of scope.

---

## 15. RISKS CODEX SHOULD DECIDE BEFORE IMPLEMENTATION

1. **Repeatable non-stackable craft output.** `copper_battleaxe` is `stackable: false`/`maxStack: 1`. `simulation.ts`'s recipe/facility branch has no "already owns this unique" guard — that guard (`ownsUniqueItem`) exists today only in the enemy-loot branch, to stop repeat kills from flooding the inventory with duplicate Boneguard Vests. A player can grind `smith_copper_battleaxe` repeatedly and fill inventory slots with duplicate axes (each costing 2 ingots + 2 logs). There is no economy to exploit, so I judge this harmless and recommend accepting it, but Codex should confirm — the alternative is generalizing `ownsUniqueItem`'s check into the recipe branch too, which is a small but real behavior change to shared code.
2. **Visual identity of the Copper Battleaxe.** As specified, it reuses the `custom.weapon-sword` procedural mesh (identical silhouette to the Militia Sword). I recommend the optional `proceduralTool()` extension in §7 for a distinct look, but did not make it mandatory. Codex should decide whether the stat-only + icon-only differentiation is acceptable for this phase.
3. **Forge/anvil art direction.** I specified rough dimensions and material properties (§7) but not exact geometry — whether it should read as "quarry-stone industrial" (my inclination, matching its quarry siting) or "warm village-craft" (matching the cottage/lantern palette) is a genuine art call.
4. **The "Ember Loomstone" hook.** `Hud.tsx`'s Loomstone Network track already lists `["First","Verdant","Tidal","Ember","Astral"]` with `Ember` sitting unused at index 3 — a striking, already-present narrative foreshadowing. I deliberately did **not** wire Smithing's completion into it, judging that a full Loomstone-tier chapter gate is bigger than "add a sixth skill" calls for and risks scope inflation (§1, §3). Codex may reasonably disagree and treat this as a cheap, high-value narrative payoff worth the extra HUD line.
5. **Exact balance numbers.** §5's ore/ingot/log quantities and XP values are my proposal, reasoned from existing numbers, not tuned by simulation or playtesting (the legacy `pace-sim.ts` cannot be reused — see §5). Treat them as a starting point.
6. **Two separate facility interactables vs. one multi-recipe facility.** I chose two adjacent single-recipe interactables (`meadowrest_smelter`, `meadowrest_anvil`) specifically because `ZoneInteractable.recipeId` is a single field, and a multi-recipe picker would require new UI (a recipe-choice menu) plus `startActivityForTarget` logic changes — real scope growth I judged not worth it for one extra recipe. If Codex anticipates more smithing recipes later, a picker might be worth building now instead of twice.
7. **Coordination with Codex's own branch.** I did not read `codex/phase-five-smithing-foundation` (explicitly out of bounds per the task). If that branch has already bumped `SAVE_VERSION`, chosen different item/recipe IDs, or placed a forge elsewhere in the quarry, this document's exact IDs/coordinates/version number will need reconciling at integration time — the *architecture* (facility+recipe reuse, no attunement-gate membership, procedural asset, quest chained after `groves_gift`) is the part I'm confident in; the exact literal values are a starting proposal.

---

## 16. HANDOFF PROMPT FACTS

- Base: `codex/phase-four-combat-progression` @ `afcedb0`. Current game: `apps/game` (`@everloom/game`), depends on `@everloom/core` + `@everloom/content` + `@everloom/assets` only — **not** `@everloom/engine`/`@everloom/gamedata` (those back the unrelated legacy `apps/client3d`/`apps/web`).
- Add skill `"smithing"` to `SkillId` (`packages/core/src/types.ts`). Do **not** add it to `ATTUNEMENT_SKILLS` (stays exactly the original 5; `ATTUNEMENT_SKILL_COUNT === 5` is asserted in 3 places).
- Bump `SAVE_VERSION` 2 → 3. Add `migrateV2ToV3`: unconditionally backfill `skills.smithing = {xp:0}`; conditionally seed `quests.forge_trade` active if `quests.groves_gift` is already completed and `forge_trade` isn't seeded yet. Chain `migrateSave` so v1 runs v1→v2→v3.
- Model Smithing as two new `facility`-kind `ZoneInteractable`s reusing the exact `CookingActivity`/`recipeId` code path (`simulation.ts` requires zero changes) — do not invent a new `Activity` variant.
- Widen `RecipeDefinition.skill` to `"cooking" | "smithing"` and `facilityKind` to `"cooking_fire" | "forge"` (in both `types.ts` and `schemas.ts`); `facilityKind` is pure metadata, never read at runtime.
- New items: `copper_ingot` (resource, stack 99), `copper_battleaxe` (weapon, `{accuracy:13,strength:8,defence:0}`, stronger than Militia Sword's `{8,4,0}` — verified formula in `combat.ts` gives 40/11 vs 35/7 accuracy/maxHit at melee level 5).
- New recipes: `smelt_copper_ore` (2 `copper_ore` → 1 `copper_ingot`, forge, 2600ms, 30xp), `smith_copper_battleaxe` (2 `copper_ingot` + 2 `meadow_log` → 1 `copper_battleaxe`, forge, 3600ms, 60xp).
- New facilities: `meadowrest_smelter` at grid `(15,5)`, `meadowrest_anvil` at grid `(16,6)` — both verified reachable and non-blocking of every existing route via the real shipped pathfinding code, stone-surface quarry cells, one grid-step apart.
- New quest `forge_trade` ("The Forge's Trade"), chained via `groves_gift.nextQuestId`, 4 steps (mine 4 ore → smelt 2 ingots → smith 1 battleaxe → equip it), `completionFlag: "forge_trade_completed"`.
- No new binary 3D assets — `apps/game` has zero models of its own (all sourced from `apps/client3d/public/models` via a dev middleware + build-time copy in `vite.config.ts`), and that directory is explicitly off-limits. Use two new `procedural://` registry entries (`custom.facility-smelter`, `custom.facility-anvil`) exactly like the four existing `custom.tool-*`/`custom.weapon-sword` entries.
- No mastery for Smithing (matches Cooking, the only existing precedent for a facility/recipe skill).
- `Hud.tsx` needs zero code changes for skills/mastery/inventory/quest/combat-profile rendering (all already generic); only two new inline SVG icons (`icon.ingot`, `icon.battleaxe`) in `ItemIcon.tsx`.
- Current verified baselines to compare against after implementation: 25 core tests, 14 content tests, 4 pathfinding tests, 13/13 typecheck tasks, 297.2 KiB / 400 KiB raw bundle (85.20 KiB gzip), ≤350 draws enforced at Meadowrest (272 desktop / 307 iPhone-landscape measured in Phase Four).
- Do not touch `apps/client3d/**`, `packages/engine/**`, `packages/gamedata/**`, `packages/assets/src/catalog.generated.json`, or any existing phase report/handoff `.md` file.
