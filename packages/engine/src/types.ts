// ============================================================
// EVERLOOM ENGINE — TYPE SYSTEM
// All quantities are integers. Rates are fixed-point (×1000).
// No floats anywhere. Time is in whole seconds.
// ============================================================

// ── Primitives ───────────────────────────────────────────────

export type SkillId =
  | "woodcutting"
  | "mining"
  | "fishing"
  | "crafting"
  | "smithing"
  | "fletching"
  | "cooking"
  | "combat"
  | "wayfaring"
  | "slayer";

export type ZoneId =
  | "meadowrest"
  | "bramblewood"
  | "ashen_delve"
  | "saltmarsh_reach"
  | "gloamfen"
  | "emberpeak"
  | "frayed_reach"
  | "loomheart";

export type DeathMode = "cozy" | "standard" | "ironbound";

export type ActionType =
  | "idle"
  | "woodcutting"
  | "mining"
  | "fishing"
  | "crafting"
  | "smithing"
  | "fletching"
  | "cooking"
  | "traveling"
  | "slayer";

export type CourierState = "idle" | "outbound" | "returning";

export type ExchangeOfferSide = "buy" | "sell";
export type ExchangeOfferStatus = "open" | "partial" | "filled" | "cancelled";

// ── Item & Stack ─────────────────────────────────────────────

export interface ItemStack {
  readonly itemId: string;
  readonly qty: number; // integer >= 0
}

// ── Tool component ────────────────────────────────────────────

export interface ToolComponent {
  readonly headId: string | null;  // smith output
  readonly haftId: string | null;  // fletch output
  readonly bindingId: string | null; // craft output
  readonly headTier: number;   // 0-8
  readonly haftTier: number;
  readonly bindingTier: number;
  readonly wearMastery: number; // 0-9900 (integer XP)
  readonly wearPct: number;     // 0-1000 (1000 = 100% fresh, fixed-point ×10)
}

export interface Equipment {
  readonly hatchet: ToolComponent | null;
  readonly pickaxe: ToolComponent | null;
  readonly fishingRod: ToolComponent | null;
  readonly helmet: string | null;  // item_id
  readonly body: string | null;
  readonly legs: string | null;
  readonly kitUnlocked: boolean;  // late Crafting milestone
}

// ── Courier ──────────────────────────────────────────────────

export interface Courier {
  readonly id: string;
  readonly name: string;     // "Wren", "Pip", "Old Moss", etc.
  readonly personality: string; // for Return Report flavour
  readonly state: CourierState;
  readonly etaSeconds: number; // seconds until next state transition (0 if idle)
  readonly tripsCompleted: number;
}

// ── Larder entry ─────────────────────────────────────────────

export interface LarderEntry {
  readonly itemId: string;
  readonly qty: number;           // integer
  readonly freshnessAt: number;   // unix timestamp (seconds) when freshness decays
}

// ── Active action ────────────────────────────────────────────

export interface CurrentAction {
  readonly type: ActionType;
  readonly nodeId: string | null;
  readonly zoneId: ZoneId;
  readonly startedAt: number;    // unix timestamp (seconds)
  readonly recipeId: string | null; // for crafting/smithing/fletching/cooking
  readonly targetZoneId: ZoneId | null; // for traveling
}

// ── Parallel action (Farming, future) ────────────────────────

export interface ParallelAction {
  readonly id: string;
  readonly type: "farming";
  readonly plotId: string;
  readonly seedItemId: string;
  readonly plantedAt: number;    // unix timestamp (seconds)
  readonly harvestAt: number;    // unix timestamp (seconds)
}

// ── Skills ───────────────────────────────────────────────────

export type SkillMap = Readonly<Record<SkillId, number>>; // XP values (integers)

// ── Mastery ──────────────────────────────────────────────────

export type MasteryMap = Readonly<Record<string, number>>; // nodeId -> XP (integer)

// ── Pattern (daily Loom passive) ─────────────────────────────

export interface Pattern {
  readonly id: string;
  readonly buffType: string;
  readonly buffValue: number;    // fixed-point ×1000
  readonly expiresAt: number;    // unix timestamp (seconds)
}

// ── Stack caps ───────────────────────────────────────────────

export type StackCapMap = Readonly<Record<string, number>>; // materialClass -> max stack (integer)

// ── Combat stats ─────────────────────────────────────────────

export interface CombatStats {
  readonly hp: number;           // current HP (integer)
  readonly maxHp: number;        // max HP (integer)
  readonly defenceRating: number; // from gear + Defence level (integer)
  readonly attackRating: number;  // for Slayer
  readonly strengthRating: number;
}

// ── Death record (for Return Report) ─────────────────────────

export interface DeathRecord {
  readonly atSeconds: number;    // seconds into the offline window
  readonly causeEnemyId: string | null;
  readonly zoneId: ZoneId;
  readonly lostItems: readonly ItemStack[]; // Standard mode penalty
}

// ── Character appearance ──────────────────────────────────────

export interface CharacterAppearance {
  readonly skinTone: number;   // 0-5
  readonly hairStyle: number;  // 0-7
  readonly hairColor: number;  // 0-9
  readonly torsoColor: number; // 0-9
  readonly legsColor: number;  // 0-9
}

// ── Main player state ────────────────────────────────────────

export interface PlayerState {
  // Identity
  readonly playerId: string;
  readonly displayName: string;
  readonly mode: DeathMode;
  readonly rngSeed: bigint;
  readonly appearance?: CharacterAppearance;

  // Checkpoint — THE critical field
  readonly checkpointAt: number;   // unix timestamp (seconds)

  // Action
  readonly currentAction: CurrentAction;
  readonly parallelActions: readonly ParallelAction[];

  // Progression
  readonly skills: SkillMap;
  readonly mastery: MasteryMap;

  // Storage
  readonly inventory: readonly ItemStack[];
  readonly slots: number;         // max inventory slots (integer)
  readonly stackCaps: StackCapMap;
  readonly bank: readonly ItemStack[];
  readonly larder: readonly LarderEntry[];
  readonly equipment: Equipment;

  // Economy
  readonly couriers: readonly Courier[];
  readonly patterns: readonly Pattern[];
  readonly motes: number;         // integer

  // Rival (synthetic — for competitive feel without multiplayer)
  readonly rivalXpSnapshot: Readonly<Partial<SkillMap>>;
  readonly rivalLastUpdatedAt: number; // unix timestamp (seconds)

  // Combat
  readonly combat: CombatStats;

  // Zone
  readonly zoneId: ZoneId;
  readonly unlockedZones: readonly ZoneId[];
  readonly travelProgress: number; // 0-1000 (fixed-point ×10) if traveling

  // Unlock tracking
  readonly collectedItemIds: readonly string[];
  readonly completedBundleIds: readonly string[];
  readonly completedWeeklyContractIds: readonly string[];
  readonly foundBlueprintIds: readonly string[];

  // Pets (1 per skill, ~1/50000 per action)
  readonly pets: readonly string[];

  // Anti-cheat
  readonly version: number;        // optimistic lock (integer)
  readonly isDead: boolean;        // ironbound permanent death
}

// ── Action descriptor (what the player wants to do) ──────────

export interface ActionDescriptor {
  readonly type: ActionType;
  readonly nodeId: string | null;
  readonly zoneId: ZoneId;
  readonly recipeId: string | null;
  readonly targetZoneId: ZoneId | null;
}

// ── Resolve inputs ────────────────────────────────────────────

export interface ResolveInput {
  readonly state: PlayerState;
  readonly action: ActionDescriptor;
  readonly elapsedSeconds: number;  // integer (clamped server-side)
  readonly nowSeconds: number;      // unix timestamp (seconds)
  readonly rngSeed: bigint;
}

// ── Resolve output ────────────────────────────────────────────

export interface ResolveOutput {
  readonly state: PlayerState;
  readonly events: readonly GameEvent[];
}

// ── Game events (for Return Report narrative) ─────────────────

export type GameEvent =
  | { readonly kind: "xp_gain"; readonly skill: SkillId; readonly amount: number; readonly atSeconds: number }
  | { readonly kind: "mastery_gain"; readonly nodeId: string; readonly amount: number; readonly atSeconds: number }
  | { readonly kind: "item_gained"; readonly itemId: string; readonly qty: number; readonly atSeconds: number }
  | { readonly kind: "item_lost"; readonly itemId: string; readonly qty: number; readonly atSeconds: number; readonly reason: string }
  | { readonly kind: "level_up"; readonly skill: SkillId; readonly newLevel: number; readonly atSeconds: number }
  | { readonly kind: "mastery_level_up"; readonly nodeId: string; readonly newLevel: number; readonly atSeconds: number }
  | { readonly kind: "satchel_full"; readonly atSeconds: number }
  | { readonly kind: "courier_dispatched"; readonly courierId: string; readonly couriername: string; readonly atSeconds: number }
  | { readonly kind: "courier_returned"; readonly courierId: string; readonly couriername: string; readonly atSeconds: number }
  | { readonly kind: "enemy_attacked"; readonly enemyId: string; readonly damage: number; readonly atSeconds: number }
  | { readonly kind: "food_consumed"; readonly itemId: string; readonly heal: number; readonly atSeconds: number }
  | { readonly kind: "death"; readonly record: DeathRecord }
  | { readonly kind: "zone_unlocked"; readonly zoneId: ZoneId; readonly atSeconds: number }
  | { readonly kind: "bundle_completed"; readonly bundleId: string; readonly atSeconds: number }
  | { readonly kind: "weekly_contract_completed"; readonly contractId: string; readonly atSeconds: number }
  | { readonly kind: "tool_degraded"; readonly toolSlot: "hatchet" | "pickaxe" | "fishingRod"; readonly atSeconds: number }
  | { readonly kind: "pet_found"; readonly petId: string; readonly atSeconds: number }
  | { readonly kind: "blueprint_found"; readonly blueprintId: string; readonly itemId: string; readonly atSeconds: number }
  | { readonly kind: "glimmer"; readonly nodeId: string; readonly motes: number; readonly atSeconds: number };
