# Everloom Phase Three — Integration and Forensic Review

Date: 31 July 2026  
Integrated branch: `codex/phase-three-foundation`  
Integrated head: `b425ea8`

## Outcome

Phase Three is integrated on top of a production-hardened game foundation. The result adds a deterministic Verdant Loomstone chapter and a complete post-awakening reward loop without weakening save integrity, offline play, initial load performance, or the existing First Thread.

The playable production entry is **282.2 KiB raw / 82.75 KiB gzip**, below the enforced **400 KiB** entry budget. The Three.js renderer remains in a lazy world chunk and split vendor chunks. A generated service worker precaches the production application and world assets.

## What Claude delivered well

1. **Deterministic progression model**
   - Added a first-class `attune` quest step instead of faking progression in the HUD.
   - Recomputes attunement from earned skill XP, preventing duplicate events from inflating progress.
   - Added reusable `nextQuestId` and `completionFlag` semantics.

2. **Save migration**
   - Migrated save version 1 to version 2.
   - Preserved incomplete First Thread saves.
   - Seeded Verdant progress for returning players from their actual skill state.
   - Added migration idempotence and unknown-version coverage.

3. **Real world gating**
   - Added `requiredFlag` enforcement in both simulation and rendering.
   - Kept Heartwood and the Grove Hearth unavailable until the Verdant Loomstone is awakened.

4. **Meaningful authored content**
   - Added Heartwood, Verdant Sap, the Grove Hearth, and Verdant Tonic.
   - The new resource provides a higher woodcutting tier.
   - The tonic heals materially more than the tutorial food.
   - Reused licensed CC0 assets rather than adding an unnecessary dependency or untracked art source.

5. **Useful test seams**
   - Browser helpers drive the same store events and quest engine used by normal play.
   - The browser test uses real Mara, Loomstone, resource, and hearth interactions for the new chapter.

6. **Good commit separation**
   - Core mechanics, content, presentation, tests, and handoff material were separated into reviewable commits.

## What needed correction

1. **Level and skill-count were accidentally coupled**
   - The required level is 5 and the number of starter skills is also 5.
   - Migration, HUD denominators, and readiness checks reused the level constant as a skill count.
   - `countAttunedSkills` counted every key in the save, so a future sixth skill could incorrectly open the gate.

2. **The reward stopped being a formal objective**
   - Awakening the Loomstone completed the chapter and left only generic ambience text.
   - Heartwood and the tonic existed, but the game never asked the player to use them.

3. **The healing claim was not proven**
   - Claude's browser test only asserted that a tonic appeared in inventory.
   - It did not damage the player, consume the tonic, or assert a health change.

4. **The quest panel was hardcoded**
   - The HUD knew specifically about `first_thread` and `verdant_loomstone`.
   - A third quest would exist in persisted state but not render in the panel.

5. **The new landmark was visually understated**
   - The Verdant Loomstone reused the First Loomstone model at the default presentation scale.
   - A daylight point light alone was not enough to distinguish it in the grove.

6. **Landscape event logs crowded the world**
   - Eight stacked messages could cover a large portion of a short landscape viewport.

7. **Claude's standalone branch retained the old load profile**
   - Its player entry remained approximately 981 KiB because it did not contain the separate foundation work.
   - This was not a regression in Claude's content work, but it was not production-ready in isolation.

8. **Handoff wording was slightly imprecise**
   - “First Thread untouched” was true of its step sequence, but its chaining metadata changed.
   - One commit summary omitted the final handoff-report commit.
   - A First Thread timeout conclusion was environment-specific; the real issue was a stale global browser-test ceiling under cold or contended WebGL.

## Corrections applied

1. Added `ATTUNEMENT_SKILLS`, `ATTUNEMENT_SKILL_COUNT`, and the independent `ATTUNEMENT_REQUIRED_LEVEL`.
2. Restricted attunement counting and debug advancement to the five authored skills.
3. Added a regression proving an unrelated future skill cannot affect the gate.
4. Chained awakening into the persisted **The Grove's Gift** quest:
   - Harvest two Heartwood Logs.
   - Brew one Verdant Tonic.
   - Persist `groves_gift_completed`.
5. Reworked the quest panel to render every persisted authored quest generically while retaining the special attunement checklist.
6. Expanded the browser API and test to damage the player, consume the tonic, assert full healing, and assert inventory consumption.
7. Added a larger semantic Verdant Loomstone asset variant plus animated concentric grove rings and an awakened light pulse.
8. Limited landscape layouts to the four newest event messages.
9. Updated the Phase Three capture scenario for the new post-awakening objective.
10. Raised only the complete First Thread journey's global test ceiling from 150 to 240 seconds; its interaction-level timeouts remain bounded.

## Foundation completed independently

- Split runtime asset metadata from the 554-model development catalogue.
- Lazy-loaded the 3D world and development asset browser.
- Split Three.js core and add-ons from the player entry.
- Enforced a 400 KiB player-entry budget during production builds.
- Tested the generated service worker by reopening the built game with the browser genuinely offline.
- Added a save-safe world chunk recovery screen.
- Added playable fallback meshes for failed player and interactable models.
- Added a WebGL initialization error state.
- Added WebGL context-loss checkpointing and renderer recovery.
- Serialized IndexedDB writes so an older checkpoint cannot overwrite a newer one.
- Reconciled deterministic offline progress when an already-open PWA returns to the foreground.
- Preserved active offline-capable work through renderer recovery.
- Isolated Playwright servers with configurable ports.
- Stabilized cold mobile world-readiness assertions without weakening gameplay assertions.

## Verification evidence

All final verification commands passed:

- Monorepo typecheck: **8 packages passed**
- Unit/content/pathfinding:
  - Core: **22 passed**
  - Content: **11 passed**
  - Game pathfinding: **4 passed**
  - Assets: **49 semantic assets and 554 catalogue models validated**
- Production build: **passed**
  - Player entry: **282.2 KiB / 400 KiB**
  - PWA precache: **11 entries / 981.75 KiB**
- Production PWA:
  - Offline installed-game reopen with world and IndexedDB save: **passed**
  - Failed production world chunk recovery: **passed**
- Foundation browser suite: **7 passed**, **7 intentional project skips**
- Player flow:
  - Landscape first-tree persisted flow: **passed**
  - Desktop first-tree persisted flow: **passed**
  - Asset catalogue on both projects: **passed**
  - Desktop real IndexedDB offline resume: **passed**
  - Landscape offline-resume duplicate: **intentionally skipped**
- Complete First Thread desktop journey: **passed in 2.7 minutes**
- Complete Verdant chapter:
  - Desktop: **passed**
  - Landscape mobile: **passed**
- Phase Three capture scenarios:
  - Desktop: **passed**
  - Landscape mobile: **passed**

The first run of the complete First Thread reached its final Loomstone objective but hit the old 150-second suite ceiling. After correcting that ceiling to 240 seconds, the unchanged gameplay journey completed successfully in 2.7 minutes.

## Known unrelated workspace note

The existing user-owned `apps/client3d` changes were deliberately left untouched and uncommitted. The root build succeeds, but Vite reports two non-fatal export warnings from the untracked `apps/client3d/src/world/assets.ts` import of `SkeletonUtils`. These files are outside this integration branch's changes.

