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

- [ ] Shared expedition engine (PHASE 4)
- [ ] Save migration and idempotency (PHASE 5)
- [ ] Forecast and configuration (PHASE 6)
- [ ] Active gameplay integration (PHASE 7)
- [ ] UI and return report (PHASE 8)
- [ ] End-to-end testing (PHASE 9)
- [ ] Performance and lifecycle (PHASE 10)
- [ ] Documentation and commit (PHASE 11)
