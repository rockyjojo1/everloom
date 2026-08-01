# Everloom Continuation Brief

Updated: 2026-08-01 (Australia/Brisbane)

This document is the durable handoff for a new coding agent with no access to prior chats. Read it before changing code.

## Repository and source of truth

- GitHub: `https://github.com/rockyjojo1/everloom`
- Newest playable implementation checkpoint: `claude/tutorial-island-playable`
- Checkpoint commit at handoff: `3c82156` (`Checkpoint tutorial island implementation WIP`)
- Stable foundation immediately before that implementation: `codex/phase-five-smithing-foundation` at `db9559e`
- The playable product is primarily `apps/game`, `packages/core`, `packages/content`, and `packages/assets`.
- `apps/client3d`, `packages/engine`, and `packages/gamedata` are an older/separate prototype path. Do not treat them as the current playable architecture.
- Owner visual experiments for that prototype are preserved separately on `wip/client3d-owner-visual-snapshot-2026-08-01`. Do not blindly merge that branch into the playable game.

Create a new branch from `claude/tutorial-island-playable` for further work. Do not rewrite or force-push historical branches.

## Product vision

Everloom is an original low-poly browser RPG/idle game. Its intended blend is:

- the readable world, deliberate skill grind, and long AFK sessions associated with HighSpell;
- the per-action mastery, idle planning, and satisfying long-tail progression associated with Melvor;
- the clarity and optional quality-of-life tooling associated with RuneLite;
- substantially stronger narrative direction and onboarding than those inspirations;
- deterministic, local-first progression with no arbitrary offline-time cap.

These are design references, not licenses to copy names, UI, maps, writing, art, numerical balance, or proprietary implementation.

The visual target is warm, charming, stylized low-poly fantasy with clear silhouettes, attractive terrain composition, legible interactables, and a cohesive game UI. It should feel closer to a polished small RPG than a developer visualization. Preserve performance and mobile readability.

## Tutorial-island promise

The first session must be exceptionally clear. A fresh player should never wonder what to do or where a required tool is.

The player should enter a short initial conversation with Mara. The story premise is that the Loomskiff or escape route is stranded and the islanders need materials, provisions, and protection before departure. After the brief opening, restore player control and use persistent guidance rather than repeatedly trapping the player in modal dialogue.

The intended learning arc is approximately:

1. Speak with Mara and understand the goal of leaving Meadowrest.
2. Follow explicit guidance to the starter pickaxe/tool source.
3. Mine the requested copper with visible progress.
4. Smelt copper at the furnace and smith starter equipment at the anvil.
5. Learn woodcutting and obtain the starter hatchet where required.
6. Obtain a fishing tool, catch fish, and cook food.
7. Learn basic combat, equipment, food, and recovery.
8. Finish preparations, leave the island, and immediately receive a meaningful quest on the next island.

The exact order may be adjusted to fit real mechanics, but the causal story must make sense. By departure the player should own the basic tools, understand gathering, production, equipment, combat, storage, offline progress, and the next long-term goal.

Use a compact persistent guide card with an objective, progress, and target controls, for example:

`THE LOOMSKIFF — Mine Copper Ore — 3/5 — [Show route] [Highlight target]`

Objective-critical targets need a world highlight, readable label/icon, and route or minimap cue. The manual playtest defect "I couldn't find the pickaxe" is a release-blocking onboarding problem, not a player mistake. Add a fresh-save regression test that proves the target is discoverable without debug controls or force-completion.

## Current implementation checkpoint

The `claude/tutorial-island-playable` snapshot contains an unfinished but substantial Phase Five implementation:

- save version 4 and migration work;
- a quest chain of `first_thread -> forge_trade -> verdant_loomstone -> groves_gift`;
- copper smelting and battleaxe smithing;
- furnace at `(15,5)` and anvil at `(16,6)`;
- procedural smelter, anvil, and battleaxe assets;
- Forge Trade content and expanded tests;
- updated screenshots in `artifacts/phase-five`.

The previous Codex foundation already supplied Smithing as a skill, generic production activities, furnace/anvil facility support, source-bound production quest progress, save-safe migrations, and core/content validation.

At the last audit, core tests passed 40/40, content tests passed 23/23, pathfinding tests passed 7/7, and full typecheck passed. Do not assume those numbers still hold after later changes; rerun them.

## Known immediate defect

The dedicated Forge Trade browser test previously passed at the landscape-mobile project and failed on desktop around the smelter step. The likely root cause is the test helper, not production gameplay:

- test `walkTo()` calls `__EVERLOOM_TEST__.activateTarget(id)`;
- `activateTarget()` routes to the target and automatically calls `actOn(target)` on arrival;
- the test then calls `activateTarget()` again to begin production;
- on desktop, the first activation can already consume all inputs and stop with `inputs_exhausted`, so the second activation has nothing to process and the test waits forever for a Stop button.

Preferred correction:

1. Add a test API method such as `navigateToTarget(targetId)` that validates the target and sets the route using the real pathfinding route, but never invokes `actOn()` and never changes activity.
2. Update the Forge Trade test's navigation helper to use it.
3. Let the explicit `activateTarget()` call begin each activity exactly once.
4. Apply navigation-only calls consistently for copper, smelter, anvil, Mara, and Verdant targets.
5. Run the desktop and landscape-mobile Forge Trade test twice.

Do not fix this with arbitrary sleeps, weakened assertions, direct state mutation, or by changing production semantics merely to satisfy the test.

## Trail Sense: native clarity tooling

Build an original first-party system tentatively named **Trail Sense**. It should provide RuneLite-adjacent clarity without copying RuneLite's branding or interface.

Recommended persisted options:

- objective world highlight, enabled by default;
- objective route/path display, enabled by default;
- ground-item labels: Off / Nearby / All, default Nearby;
- ground-item colour mode: Rarity / Value / Type / Quest, default Rarity;
- beam or emphasis threshold, default Rare;
- in-game notifications for action stopped, inventory/storage full, rare drops, level/mastery milestones, and quest progress;
- outlines and minimap icons for important targets;
- reduced visual assistance mode;
- colourblind-safe shapes/icons/text so colour is never the only signal.

Do not make every object glow intensely by default. Current objectives and required tutorial tools receive the strongest treatment; rare/value items receive distinct but restrained treatment; ordinary items remain subtle and proximity-limited. Do not request browser notification permission automatically.

## Inventory and AFK direction

Use a hybrid inventory rather than one extreme:

- ore, logs, fish, bars, herbs, and similar bulk materials stack from the beginning;
- food may use moderate stacks;
- tools, weapons, armour, quest objects, and unique collectibles remain individually meaningful;
- slot count, stack caps, and specialised storage continue to matter;
- crafted satchels and later ore crates, lumber racks, larders, and storehouses extend session length.

Do not make inventory literally unlimited. The desired promise is unlimited offline **time**, not infinite storage. A task may stop naturally because storage filled, inputs ran out, the player died, or another real game condition occurred. The return summary must state exactly what happened, such as: `Mined for 6h 42m, then the ore satchel filled.`

Current raw-material caps around 99 are probably too small for the desired long-AFK loop. Tune through progression and specialised capacity rather than simply removing all constraints.

Offline simulation must be deterministic and equivalent to online outcomes. For extremely long absences, use mathematically exact batching or event-boundary simulation rather than looping once per action for weeks or months.

## Mastery direction

Add per-action or per-recipe mastery on top of broad skill XP. Existing resource mastery data should be generalized rather than duplicated.

Use restrained milestone rewards around 10, 25, 50, 75, and 99 mastery. A small per-skill shared pool can be framed as Loom Resonance. Bonuses should improve efficiency, consistency, capacity, or convenience without making early balance collapse. Avoid building an enormous completion matrix before the tutorial loop is stable.

## Engineering boundaries

- Preserve old saves with explicit, tested migrations.
- Do not casually reorder existing quest step indexes; active saves may depend on them.
- Keep content data-driven and validate identifiers/source binding.
- Keep deterministic core rules out of React/Three rendering code.
- Preserve cold-start, renderer-recovery, PWA, desktop, and mobile behavior.
- Avoid unrelated dependency upgrades or broad refactors.
- Do not change economy/combat balance silently.
- Avoid committing generated caches, dependency folders, credentials, or machine-local configuration.
- Existing screenshots are evidence, not substitutes for assertions.

## Recommended execution order

1. Inspect the WIP diff and rerun focused core/content/pathfinding/typecheck gates.
2. Fix the Forge Trade test navigation/action race and prove it twice on desktop and landscape-mobile.
3. Manually play from a genuinely fresh save. Catalogue every unclear or broken tutorial transition, especially the missing-pickaxe experience.
4. Finish and stabilize the six-skill Meadowrest escape loop.
5. Implement reusable objective-target resolution, the persistent guide card, and target/route highlights.
6. Add the Trail Sense preferences and accessible ground-item/important-object clarity foundation.
7. Introduce the hybrid stacking/storage model and exact unlimited-time offline simulation in small save-safe phases.
8. Generalize mastery and add modest milestones after the tutorial loop is reliable.
9. Only then expand the next island, immediately continuing the story with a real quest.

Work in vertical slices that are genuinely playable. A phase is not complete merely because data schemas exist; it needs UI/world integration, migrations where relevant, automated coverage, and a short manual verification path.

## Validation and handoff standard

Before presenting work as finished, run the relevant combination of:

- `pnpm --filter @everloom/core test`
- `pnpm --filter @everloom/content test`
- game/pathfinding tests
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`
- focused Playwright tests on desktop and landscape-mobile

Report commands and results honestly. Distinguish existing warnings, environment limitations, flaky test infrastructure, and product defects. Commit work to a new branch, push it, and leave a concise repository handoff containing commits, changed files, tests, remaining risks, and a fresh-save manual test script.
