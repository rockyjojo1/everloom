# Phase Five Smithing Foundation Handoff

Base commit: `09afb4a` (`codex/phase-five-smithing-foundation`)

## Runtime boundary

The playable tutorial is `apps/game`, backed by `packages/core`, `packages/content`, and `packages/assets`. The `apps/client3d` + `packages/engine` + `packages/gamedata` stack is a separate prototype and must not receive tutorial implementation work.

## Contracts now available

- `SkillId` includes `smithing`; new saves seed it at zero XP.
- Save version is 3. Version 1 and 2 saves migrate without losing progress.
- A legacy in-progress `{ type: "cooking" }` activity migrates to `{ type: "production" }` with its exact timer preserved.
- Recipes support `cooking | smithing` and facilities support `cooking_fire | furnace | anvil`.
- Content validation rejects incompatible skill/facility pairs.
- Facilities start generic `production` activities; Smithing uses the same deterministic live/offline/reload resolver as Cooking.
- Quest steps support `kind: "produce"`; `targetId` may bind the objective to a specific facility.
- Smithing is visible in the skills panel but intentionally is not one of the five Verdant attunement skills.
- Production effects distinguish Cooking and Smithing visually.

## Verified invariants

- Core: 27 tests pass, including v2 migration and Smithing live/offline/reload equivalence.
- Content: 16 tests pass, including recipe/facility compatibility and `produce` quest schema.
- Game pathfinding: 4 tests pass.
- Full monorepo test, typecheck, and build pass.
- Browser: 8 applicable desktop foundation and First Thread tests pass (8 mobile variants configured as skipped).
- Player entry bundle: 297.7 KiB / 400 KiB.

## Implementation target

Add one small, legible physical Smithing loop to Meadowrest: mine starter copper, use a clearly recognizable furnace or anvil, receive a useful persistent output, earn Smithing XP, and advance an authored tutorial objective. Prefer a useful equipment or progression reward over a decorative collectible. Keep the original Verdant five-skill attunement gate unchanged unless the game narrative is deliberately revised together with migration and tests.

## Repository hygiene

Do not touch the user-owned dirty `apps/client3d` files in the main working tree. Implement in a clean worktree rooted at `09afb4a`. Do not copy logic from the parallel `packages/engine`/`packages/gamedata` prototype.
