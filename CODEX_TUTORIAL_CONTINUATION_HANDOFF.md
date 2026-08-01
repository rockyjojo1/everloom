# Everloom Codex Tutorial Continuation Handoff

Updated: 2026-08-01 (Australia/Brisbane)

Branch: `codex/tutorial-continuation`

Base: Claude's reviewed tutorial checkpoint `fa260ac`

## Integrated commits

- `fa260ac` — corrected one-time Loomskiff opening conversation.
- `91b79d7` — exact batching for safe long offline production and corrected relative stop-time reporting.
- `a796a56` — validated physical guidance targets and contextual HUD help across the tutorial chain.
- `1dcb75d` — objective minimap marker and player-requested dotted world route.

## Claude audit

Claude's implementation was strongest where it reused real game systems:

- The Forge Trade test race was fixed with a navigation-only test hook rather than sleeps or weaker assertions.
- The objective beacon is persistent, follows real quest state, and was visually tuned in both supported viewports.
- The new opening uses the real Mara interaction, persists once, and has dedicated browser coverage.

The final uncommitted opening needed correction before integration:

- It directed the player to the pickaxe even though the persisted quest's real next step is the hatchet.
- Its story described leaving the village rather than repairing the Loomskiff and leaving the island.
- It could appear on already-progressed saves that merely lacked the newly introduced flag.
- Its browser run regenerated many unrelated screenshots; only the four intended opening images were retained.

The corrected opening now advances the real `meet_mara` step only for a genuinely untouched First Thread save, establishes the Loomskiff premise, and points honestly to the worn hatchet and three logs.

## Codex continuation changes

### Long offline production

- Safe deterministic cooking and smithing can batch extremely large action counts exactly.
- Ambiguous or state-sensitive cases still use the proven event-by-event path.
- The offline report now states when an activity stopped relative to the current absence, not the lifetime simulation clock.
- Production level gains are included in return reporting.

### Tutorial clarity

- Quest data can separately identify the semantic completion target and a physical guidance target.
- Every physical First Thread action now resolves to a real object: oak, copper, shoal, cooking fire, skeleton, tools, Mara, and Loomstone.
- Forge Trade and Grove's Gift gathering steps also receive physical guidance.
- Equip objectives show a direct `Open Pack` action; attunement shows `Open Skills`.
- The current target has a persistent world beacon, a shape-based minimap marker, and an optional `Show route` dotted path.
- Routes clear automatically when the objective changes and reject stale/non-current target requests.

## Validation observed

- Full unit/package suite: 10/10 tasks passed.
- Core: 44/44 tests passed.
- Content: 25/25 tests passed.
- Game/pathfinding: 7/7 tests passed.
- Full typecheck: 13/13 tasks passed.
- Full production build: 8/8 tasks passed.
- Player entry bundle: 308.9 KiB / 400 KiB budget.
- Tutorial guidance Playwright walkthrough: 2/2 passed on desktop and landscape-mobile using real pathfinding and interactions.
- Escape intro Playwright suite: 6/6 passed on desktop and landscape-mobile.
- PWA/offline reopening and world-chunk recovery: 2/2 passed.
- Route and minimap screenshots were personally inspected in both viewports.

The legacy `apps/client3d` bundle-size warning remains unrelated. Turbo may replay a cached absolute asset-catalog path from another worktree; no asset-catalog drift is part of these commits.

## Remaining priorities

1. Perform a full fresh-save manual clarity pass beyond the pickaxe through mining, fishing, cooking, combat, Forge Trade, and the Verdant attunement gate.
2. Add save-migrated Trail Sense preferences, accessible ground-item labels, rare/value emphasis, and in-game stop/full/rare-drop notifications.
3. Extend exact long-absence batching to gathering only when RNG, mastery, respawn, quest, capacity, and stop boundaries are mathematically preserved.
4. Introduce the hybrid stacking/storage progression without making storage literally unlimited.
5. Generalize mastery into per-action/per-recipe milestones and restrained Loom Resonance bonuses.
6. Build the departure payoff and first quest on the next island only after the Meadowrest loop is reliable.

Do not reorder existing quest step indexes without an explicit save migration. Do not merge the old `apps/client3d` visual experiment into the playable `apps/game` path wholesale.
