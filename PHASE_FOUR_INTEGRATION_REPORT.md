# Everloom Phase Four — Combat Progression and World Polish

Date: 31 July 2026  
Branch: `codex/phase-four-combat-progression`  
Base: `2af5fb9` (`codex/phase-three-foundation`)

## Outcome

Phase Four is complete on an integrated, production-tested branch. It adds a deterministic equipment-driven combat profile, opposed enemy combat, a guaranteed persistent armour upgrade, clearer combat HUD feedback, and a materially fuller Meadowrest composition. The richer world remains data-driven, locally licensed, traversable, offline-safe, and below enforced mobile-oriented bundle and draw-call budgets.

The visual pass is a clear step toward the supplied references: locations now have stronger silhouettes, denser authored detail, a continuous riverbank, distinct quarry/training/grove identities, landmark framing, and a world-edge treatment. It is still an indie low-poly foundation rather than final-reference-quality art; improving models, terrain blending, animation, and environmental lighting remains future art work.

## Combat and progression delivered independently

- Added `packages/core/src/combat.ts` as the single deterministic source of player combat stats.
- Derives live accuracy, maximum hit, and defence from melee XP plus actually equipped, validated content items. No cached combat value can drift from equipment or save state.
- Added integer-only opposed hit chance with a 10–95% clamp.
- Added enemy combat level, accuracy, evasion, and armour to validated content.
- Replaced guaranteed/inverted damage rules with deterministic player and enemy hit rolls.
- Added the Militia Sword's accuracy/strength bonuses.
- Added a guaranteed, unique, non-stackable `Boneguard Vest` body upgrade with +10 defence.
- Prevented unique equipment drops from repeatedly filling inventory.
- Made multi-drop capacity selection sequential and deterministic.
- Added HUD combat profile, enemy level/HP feedback, and visible item combat bonuses.
- Proved foreground, offline, and serialized mid-fight simulation equivalence.
- Proved the sword/vest stat changes, skeleton reward, collection entry, equip action, save, reload, and restored stats in desktop and iPhone-landscape browser flows.

## Claude work integrated

Integrated commits:

- `fd1e32f` — authored terrain/scenery and 16 semantic CC0 asset variants.
- `6e545c7` — world-edge presentation and composite cottage tint correction.
- `30c4678` — real-path visual regression scenario and inspected desktop captures.

Claude's later `a5114e5` trim was reviewed but deliberately not merged. The final branch contains Codex's audited alternative.

## What Claude did well

1. **Stayed substantially inside the assigned visual lane.** The three integrated commits did not touch combat, quest logic, saves, PWA code, HUD/CSS, or user-owned `apps/client3d` work.
2. **Used verifiable local art.** All 16 registry additions point to existing Kenney Nature/Fantasy files, retain CC0-1.0 metadata and source URLs, and pass the asset validator.
3. **Improved regional identity.** Village lanterns/hedges, worked-grove debris, quarry cliffs and stone rings, riverbank dressing, training fences/banners, and a deeper Verdant ground palette make the single zone read as authored locations rather than one test field.
4. **Addressed the hard map edge cheaply.** A vertex-coloured terrain skirt and instanced distant silhouettes avoid loading new models or adding many draw calls.
5. **Found a real presentation bug.** Composite cottage tint values existed in data but were discarded during assembly; the fix now applies those authored variants.
6. **Built useful visual evidence.** Its Playwright scenario walks real routes to the grove, quarry, river, training area, Mara, and Verdant Loomstone; checks page/model failures; and captures each location.
7. **Reverted a bad experiment.** Claude visually detected that global material normalization washed out roofs/canopies and removed it rather than defending the code.
8. **Investigated cold-start pressure honestly.** Its late pass measured a 195-draw baseline versus the fuller scene and recognized that extra authored GLBs affected SwiftShader start time.

## What Claude got wrong or left incomplete

1. **Two decorative cliffs changed pathfinding semantics.** `quarry_cliff_west` and `quarry_cliff_east` were added with `blocks: true`, contrary to the visual-only brief. Claude's handoff claimed gameplay blockers were unchanged, but scenery blockers feed the runtime blocked set even when `blockedCells` JSON is byte-identical.
2. **The first horizon treatment was visually crude.** Large, trunkless dark cones dominated several captures and looked less like the reference target than the authored foreground.
3. **Performance was observed, not enforced.** The test recorded metric strings as annotations but had no draw-call assertion, so a future regression could still pass.
4. **The late performance fix optimized around the test proxy.** Claude treated the renderer's arbitrary “30 frames means ready” condition as off-limits and removed 13 pieces of scenery to meet 12-second assertions. That reduced art to accommodate a misleading readiness signal rather than correcting readiness itself.
5. **It documented but did not fix frame-rate time dilation.** The visual test explained the 50 ms delta clamp, yet the full First Thread later proved that slow rendering could reduce walking speed enough to miss a real rod-pickup objective window.
6. **The late trim still retained both blocking cliffs and the oversized cone geometry.** It therefore did not resolve the most important audit findings.
7. **The handoff was late and unfinished.** It remained uncommitted and contained placeholders for the final commit list, full e2e result, and both worktree statuses. Several counts/descriptions were stale after the late trim.
8. **No real-device performance proof exists.** SwiftShader FPS is not an iPhone result. Draws, triangles, bundle size, and responsive browser behavior are the available proxies.

## Corrections applied after audit

1. Made both quarry cliffs non-blocking and re-proved real routes.
2. Replaced giant trunkless boundary spikes with smaller seven-sided canopies plus instanced trunks, tightened the scale distribution, and reduced quality-tier counts.
3. Added an explicit `≤350` draw-call assertion at fresh Meadowrest and awakened Verdant Grove.
4. Preserved the visually richer authored placement set because it passes the explicit budget and real journeys; rejected Claude's deletion-based late trim.
5. Split movement time from conservative animation time. Animation/water remain capped at 50 ms; traversal accepts up to 250 ms of real frame time, preventing severe low-FPS walking slowdown without allowing background-frame teleportation.
6. Replaced the arbitrary 30-rendered-frame ready flag with `Promise.allSettled` over the player, every scenery model, and every interactable. “Ready” now means assets loaded or resolved to defined fallbacks.
7. Added fresh, inspected desktop and iPhone-landscape world captures.
8. Isolated the production failed-chunk browser test from service-worker precaching so failure injection is deterministic.

## Final performance evidence

The browser environment uses SwiftShader, so its 3–4 FPS is not representative of real GPU hardware. The structural measurements are:

| View | Draws | Triangles |
|---|---:|---:|
| Meadowrest, desktop | 272 | 54,495 |
| Verdant Grove, desktop | 157 | 38,078 |
| Meadowrest, iPhone landscape | 307 | 61,786 |
| Verdant Grove, iPhone landscape | 226 | 52,445 |

All measured views pass the enforced 350-draw ceiling.

Production player entry: **297.2 KiB raw / 85.20 KiB gzip**, below the enforced **400 KiB** budget. The PWA precache contains 11 entries / **999.66 KiB**.

## Verification

- Monorepo typecheck: **8 packages passed**.
- Core: **25 tests passed**.
- Content validation: **14 tests passed**.
- Game pathfinding: **4 tests passed**.
- Assets: **65 semantic assets and 554 catalogue models validated**.
- Production build: **passed**.
- Production PWA:
  - installed game reopens genuinely offline with world and IndexedDB save: **passed**;
  - failed world-chunk recovery preserves save and offers recovery: **passed**.
- World-polish visual suite: **2 passed** (desktop + iPhone landscape), including real paths, awakened state, model/page error checks, and draw budget.
- Combat progression: **2 passed** (desktop + iPhone landscape).
- Complete 16-step First Thread: **passed** in 3.1 minutes after the movement correction.
- Complete Verdant chapter and reward: **2 passed** (desktop + iPhone landscape) in 1.7 minutes after asset-settled readiness.
- Foundation/player matrix: all 7 desktop foundation checks, both first-tree flows, both asset-browser checks, and desktop offline resume passed. The last offline-resume check flaked once only after the longest shared SwiftShader sequence, then passed alone in a fresh process; the production offline PWA test independently passed.

## Captures

- `artifacts/phase-four-world-polish/meadowrest-village-desktop.png`
- `artifacts/phase-four-world-polish/meadowrest-village-landscape.png`
- `artifacts/phase-four-world-polish/western-grove-desktop.png`
- `artifacts/phase-four-world-polish/quarry-desktop.png`
- `artifacts/phase-four-world-polish/river-desktop.png`
- `artifacts/phase-four-world-polish/training-ground-desktop.png`
- `artifacts/phase-four-world-polish/verdant-grove-desktop.png`
- `artifacts/phase-four-world-polish/verdant-grove-landscape.png`

## Known unrelated workspace note

The user's existing dirty `apps/client3d` files were preserved and never staged or committed. The root build succeeds, while that separate user work still emits two non-fatal `SkeletonUtils` export warnings from its untracked `apps/client3d/src/world/assets.ts`.

## Recommended next phase

Move from foundation-level combat into a small encounter/reward arc rather than adding more raw systems: one additional enemy archetype, one meaningful weapon/body choice, a compact combat objective, clearer hit/miss feedback, and actual-device iPhone profiling. Keep Meadowrest's current composition stable until real-device numbers and a deliberate asset/lighting pass justify further visual density.
