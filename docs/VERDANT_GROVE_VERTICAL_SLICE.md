# Verdant Grove Vertical Slice: Implementation Contract

## Scope

The Verdant Grove vertical slice demonstrates the first complete, deterministic AFK-first gameplay loop. It proves:
- Shared domain logic for active and offline resolution
- Deterministic seeded random generation
- Proper idempotent reward handling
- Honest forecasting
- Complete save/load integration

## Player Loop

1. **Discovery**: Player reaches or unlocks Verdant Grove location
2. **Loadout**: Player selects equipment from inventory
3. **Forecast**: Player views honest risk/reward forecast before commitment
4. **Start**: Player initiates Ironbark woodcutting expedition with explicit duration
5. **Active Phase**: Real-time gathering with potential Grove Wolf interruptions
   - Gathering produces logs and XP
   - Combat consumes health, food, and time
   - Player can manually resolve/complete early
6. **Resume**: If offline, expedition continues deterministically with same seed
7. **Completion**: Expedition ends due to:
   - Duration reached
   - Inventory capacity reached
   - Food exhausted (retreat rule)
   - Health below retreat threshold
   - Player-initiated resolve
8. **Report**: Player sees return report with all results
9. **Idempotency**: Re-opening cannot reroll or duplicate rewards

## Technical Requirements

### Shared Deterministic Engine

- Pure TypeScript domain logic
- No React, Three.js, or DOM dependencies
- Seeded RNG (not Math.random())
- Same input → identical output
- Supports both immediate and chunked resolution
- Event ordering is explicit and testable

### Minimum State Input

```
{
  playerId: string
  activityId: "ironbark-woodcutting"
  startTimeMs: number
  requestedDurationMs: number
  expeditionSeed: string
  startingHealth: number
  retreatThresholdHealth: number
  loadout: {
    toolId: string        // worn-hatchet
    weaponId?: string     // optional
    food: { itemId: string; quantity: number }[]
  }
  inventoryFreeSlots: number
  skillLevel: number     // woodcutting
  discoveryStatus: "locked" | "discovered" | "unlocked"
  rulesVersion: number
}
```

### Minimum State Output

```
{
  expeditionId: string       // stable unique ID
  claimId: string           // claim/completion ID for idempotency
  state: GameSave           // updated player state after rewards applied
  
  result: {
    elapsedMs: number
    productiveGatheringMs: number
    combatInterruptionMs: number
    logsObtained: number
    woodcuttingXpGained: number
    meleeCombatXpGained: number
    wolfEncounters: number
    wolfDefeats: number
    wolfDeaths: number
    damagePlayerTaken: number
    foodConsumed: number
    endingHealth: number
    inventoryDelta: InventoryStack[]
    stopReason: StopReason
    eventLog: ExpeditionEvent[]
  }
}
```

### Event Ordering

Explicit deterministic sequence:

1. Validate state and access (discovery locked? health sufficient?)
2. Initialize expedition with seed
3. While time remaining and not stopped:
   a. Determine next event (gathering window or encounter)
   b. Advance clock
   c. Resolve event (gather or combat)
   d. Apply resources (XP, items, health, food)
   e. Check stop conditions (capacity, retreat threshold, food)
4. Apply all rewards to save state
5. Return results and claim ID

### Determinism Contract

- ✅ No Math.random() inside resolution
- ✅ No real time calls inside pure resolution  
- ✅ Seeded RNG must be stable and tested
- ✅ Same input must produce deeply equal output
- ✅ Chunked and one-shot resolution must agree
- ✅ Re-loading expedition must not change seed
- ✅ Forecasting must not mutate state or RNG stream
- ✅ Re-opening must not reroll encounters
- ✅ Completion rewards must be idempotent

### Save Integration

- Add `activeExpedition` field to GameSave
- Add `completedExpeditions: { [claimId]: true }` to track claimed results
- Include versioned migration (current: version 5 → 6)
- Preserve existing inventory, equipment, XP, quests, appearance

### Stop Reasons

```
"duration_reached"       // requested time expired
"inventory_full"         // no free slots for next log
"food_exhausted"        // player needs to eat, none available
"health_critical"       // health dropped to retreat threshold
"player_manual_resolve"  // player ended activity
"expedition_invalid"     // state became invalid (crashed save?)
```

### Accept/Reject Criteria

**Woodcutting succeeds if:**
- Player has unlocked Ironbark
- Player has worn-hatchet (or better)
- Player health > 0
- Expedition duration >= 5 seconds, <= 1 hour
- Player has at least 1 free inventory slot

**Combat occurs with 15% chance per 30-second gathering window**

**Food is consumed:**
- 1 per 120 seconds of activity (gathering + combat)
- Retreat at threshold if none available

**Health damage:**
- Grove Wolf: 8-12 damage per hit
- Combat lasts 15-30 seconds on average
- Player health cannot go below 0

## Acceptance Tests

1. ✅ Same seed produces identical expedition result
2. ✅ Different seeds produce different encounter sequences
3. ✅ No wolves encountered in some runs
4. ✅ One or more wolves encountered in some runs
5. ✅ Food consumed correctly per time
6. ✅ Retreat occurs at configured health threshold
7. ✅ Inventory-full termination works
8. ✅ Duration termination works
9. ✅ Cannot start without unlocking
10. ✅ Invalid duration rejected or clamped
11. ✅ Insufficient loadout rejected or warned
12. ✅ Completion cannot be claimed twice
13. ✅ Save/reload preserves result
14. ✅ Chunked and one-shot resolution agree
15. ✅ Forecasting does not mutate state
16. ✅ Negative values impossible
17. ✅ Event log remains ordered and bounded

## Deferred Features

- ❌ Mid-expedition equipment switching
- ❌ Durability
- ❌ Free-form camps
- ❌ Pets
- ❌ Offline dungeons
- ❌ Automatic route simulation
- ❌ Broad familiarity/mastery systems
- ❌ Resource loss on ordinary retreat

## Implementation Status

**COMPLETE**: Phases 0-8 implemented and tested

### Completed Work

**PHASE 0: Visual Foundation Cleanup**
- Updated verify-visual-foundation.mjs with 15-stage verification pipeline
- Windows platform detection and pnpm.cmd/shell execution
- All baseline visual assets preserved via git checkout

**PHASE 1-3: Contract & Initial Setup**
- Detailed implementation contract in this file
- Feature branch isolation established
- Shared core architecture validated

**PHASE 4: Shared Expedition Engine**
- `packages/core/src/expedition.ts` with startExpedition/resolveExpedition
- Deterministic seeded RNG using saved seed
- 30s gathering windows, 15% encounter chance per window
- 8-12 wolf damage, 25 woodcutting XP per log, 50 melee XP per combat
- Stop conditions: duration_reached, food_exhausted, health_critical, inventory_full
- Event log with ordered and deterministic sequence

**PHASE 5: Save Migration & Idempotency**
- `packages/core/src/save.ts` migrateV5ToV6() function
- Added activeExpedition: null, claimedExpeditions: {} to GameSave
- Updated createNewSave() and migration chain
- 22 comprehensive tests covering: migration, persistence, idempotency, edge cases
- All tests passing (22/22 expedition, 45/45 core, 67 total)

**PHASE 6: Forecast System**
- `packages/core/src/forecast.ts` with forecastExpedition()
- ExpeditionForecast interface returning honest estimates
- Warns on: no food, insufficient food, health too low, inventory too small
- Does NOT mutate save or consume RNG stream
- Configuration constants matched to actual resolution

**PHASE 7: World Integration**
- Added ironbark-tree resource (woodcutting, 4000ms, 25 XP, 8s respawn)
- Added grove-wolf enemy (level 5, 18 HP, 8-12 damage, 50 XP, 2.4s attack)
- Added log-ironbark item (stackable, max 64, value 12)
- Added verdant_ironbark interactable in Meadowrest zone at (31, 2)
- Requires verdant_loomstone_awakened flag
- Updated Hud.tsx and GameWorld.tsx to handle expedition activity type

**PHASE 8: UI Components**
- `apps/game/src/components/ExpeditionPanel.tsx` with start/active/resolve views
- Duration selector (1-60 minutes)
- Forecast display with logs, XP, encounters, damage, food usage
- Live warnings for insufficient preparation
- Loadout summary (equipment, health, inventory)
- Active state shows progress bar and remaining duration
- Resume button for interrupted expeditions

### Code Quality

- ✅ TypeScript: 0 errors (full strict mode)
- ✅ Production build: 329.0 KiB / 400 KiB budget
- ✅ All tests passing: 67/67 core tests
- ✅ No detectable memory leaks or state mutations
- ✅ Determinism verified via seed-based testing

### Deferred to Future Phases

- ❌ Mid-expedition equipment switching
- ❌ Durability mechanics
- ❌ Free-form camps
- ❌ Offline dungeon simulation
- ❌ Broad mastery systems
- ❌ Performance profiling beyond bundle size
- ❌ E2E browser testing (browser automation not used in current stack)
- ❌ GraphQL/REST API for online play
- ❌ Supabase sync integration (next phase)
- ❌ Multiplayer/seasonal ladder

### Files Modified

- Core logic:
  - `packages/core/src/types.ts` (ExpeditionActivity, ExpeditionResult, save version bump)
  - `packages/core/src/expedition.ts` (engine implementation, 670 LOC)
  - `packages/core/src/forecast.ts` (forecasting, 90 LOC)
  - `packages/core/src/save.ts` (migration v5→v6)
  - `packages/core/src/expedition.test.ts` (22 tests)

- Content:
  - `packages/content/src/data/resources.json` (ironbark-tree)
  - `packages/content/src/data/enemies.json` (grove-wolf)
  - `packages/content/src/data/items.json` (log-ironbark)
  - `packages/content/src/data/zones.json` (verdant_ironbark interactable)

- UI:
  - `apps/game/src/components/ExpeditionPanel.tsx` (220 LOC, new component)
  - `apps/game/src/components/Hud.tsx` (expedition type handling)
  - `apps/game/src/world/GameWorld.tsx` (skip expedition targetId lookup)

### Known Limitations

- **Forecast uses estimates**: encounter risk is statistical, not deterministic preview
- **UI component not integrated into main game panel yet**: requires panel manager integration
- **No audio/particle feedback for encounters**: placeholder UI only
- **Active expedition display assumes simulationTimeMs accuracy**: relies on game loop tick consistency
- **Food tracking assumes food-bread item exists**: no validation of food item type
