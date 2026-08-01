export const SAVE_VERSION = 4 as const;
export const PROBABILITY_SCALE = 1_000_000 as const;

export type SkillId = "woodcutting" | "mining" | "fishing" | "cooking" | "smithing" | "melee";
export type GatherSkillId = "woodcutting" | "mining" | "fishing";
export type ProductionSkillId = "cooking" | "smithing";
export type FacilityKind = "cooking_fire" | "furnace" | "anvil";
export type ToolKind = "hatchet" | "pickaxe" | "fishing_rod";
export type EquipmentSlot = "tool" | "weapon" | "body";
export type QualityLevel = "low" | "standard" | "high";
export type InteractableKind =
  | "resource"
  | "ground_item"
  | "npc"
  | "enemy"
  | "facility"
  | "landmark"
  | "door"
  | "exit";

export interface GridPosition {
  readonly x: number;
  readonly z: number;
}

export interface PlayerPosition extends GridPosition {
  readonly facingX: number;
  readonly facingZ: number;
}

export interface InventoryStack {
  readonly itemId: string;
  readonly quantity: number;
}

export interface ItemDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: "tool" | "weapon" | "resource" | "food" | "rare" | "quest" | "collection";
  readonly stackable: boolean;
  readonly maxStack: number;
  readonly iconId: string;
  readonly worldAssetId: string;
  readonly equipmentSlot: EquipmentSlot | null;
  readonly toolKind: ToolKind | null;
  readonly healAmount: number;
  readonly value: number;
  readonly collection: boolean;
  readonly combatBonuses: CombatBonuses | null;
}

export interface CombatBonuses {
  readonly accuracy: number;
  readonly strength: number;
  readonly defence: number;
}

export interface PlayerCombatStats {
  readonly level: number;
  readonly accuracy: number;
  readonly maxHit: number;
  readonly defence: number;
}

export interface DropDefinition {
  readonly itemId: string;
  readonly minQuantity: number;
  readonly maxQuantity: number;
  readonly chancePpm: number;
}

export interface ResourceDefinition {
  readonly id: string;
  readonly name: string;
  readonly skill: GatherSkillId;
  readonly requiredTool: ToolKind;
  readonly actionDurationMs: number;
  readonly successChancePpm: number;
  readonly xpPerSuccess: number;
  readonly masteryXpPerAttempt: number;
  readonly yield: DropDefinition;
  readonly rareDrops: readonly DropDefinition[];
  readonly respawnMs: number;
  readonly masterySpeedPpmPerRank: number;
  readonly masteryRarePpmPerRank: number;
}

export interface RecipeDefinition {
  readonly id: string;
  readonly name: string;
  readonly skill: ProductionSkillId;
  readonly actionDurationMs: number;
  readonly xpPerSuccess: number;
  readonly inputs: readonly InventoryStack[];
  readonly output: InventoryStack;
  readonly facilityKind: FacilityKind;
}

export interface EnemyDefinition {
  readonly id: string;
  readonly name: string;
  readonly combatLevel: number;
  readonly maxHp: number;
  readonly attackIntervalMs: number;
  readonly accuracy: number;
  readonly evasion: number;
  readonly armor: number;
  readonly minDamage: number;
  readonly maxDamage: number;
  readonly xpReward: number;
  readonly loot: readonly DropDefinition[];
  readonly respawnMs: number;
  readonly assetId: string;
}

export type QuestStepKind =
  | "talk"
  | "pickup"
  | "equip"
  | "gather"
  | "cook"
  | "produce"
  | "defeat"
  | "interact"
  | "attune";

export interface QuestStepDefinition {
  readonly id: string;
  readonly kind: QuestStepKind;
  readonly objective: string;
  readonly targetId: string | null;
  readonly itemId: string | null;
  readonly count: number;
}

export interface QuestDefinition {
  readonly id: string;
  readonly name: string;
  readonly summary: string;
  readonly steps: readonly QuestStepDefinition[];
  /** Quest ID automatically activated the moment this quest completes, if not already present. */
  readonly nextQuestId?: string | null;
  /** World flag set to true the moment this quest completes (e.g. awakening a Loomstone). */
  readonly completionFlag?: string | null;
}

export interface TerrainRegion {
  readonly surface: "grass" | "meadow" | "path" | "stone" | "water" | "soil";
  readonly shape: "rect" | "circle" | "path";
  readonly x: number;
  readonly z: number;
  readonly width: number;
  readonly depth: number;
  readonly endX: number | null;
  readonly endZ: number | null;
}

export interface SceneryPlacement extends GridPosition {
  readonly id: string;
  readonly assetId: string;
  readonly rotation: number;
  readonly scale: number;
  readonly elevation: number;
  readonly blocks: boolean;
  readonly tint: string | null;
}

export interface ZoneInteractable extends GridPosition {
  readonly id: string;
  readonly kind: InteractableKind;
  readonly displayName: string;
  readonly assetId: string;
  readonly resourceId: string | null;
  readonly itemId: string | null;
  readonly recipeId: string | null;
  readonly enemyId: string | null;
  readonly quantity: number;
  readonly interactionRadius: number;
  readonly blocks: boolean;
  /** Optional runtime material tint, mirroring SceneryPlacement.tint. */
  readonly tint?: string | null;
  /** Optional world flag that must be true for this target to be visible/usable. */
  readonly requiredFlag?: string | null;
}

export interface ZoneDefinition {
  readonly id: string;
  readonly name: string;
  readonly width: number;
  readonly depth: number;
  readonly cellSize: number;
  readonly spawn: GridPosition;
  readonly terrain: readonly TerrainRegion[];
  readonly blockedCells: readonly GridPosition[];
  readonly scenery: readonly SceneryPlacement[];
  readonly interactables: readonly ZoneInteractable[];
}

export interface ContentBundle {
  readonly items: Readonly<Record<string, ItemDefinition>>;
  readonly resources: Readonly<Record<string, ResourceDefinition>>;
  readonly recipes: Readonly<Record<string, RecipeDefinition>>;
  readonly enemies: Readonly<Record<string, EnemyDefinition>>;
  readonly quests: Readonly<Record<string, QuestDefinition>>;
  readonly zones: Readonly<Record<string, ZoneDefinition>>;
}

export interface SkillProgress {
  readonly xp: number;
}

export interface MasteryProgress {
  readonly xp: number;
}

export interface QuestProgress {
  readonly status: "active" | "completed";
  readonly stepIndex: number;
  readonly stepProgress: number;
}

export interface ResourceWorldState {
  readonly depletedUntilMs: number;
}

export interface EnemyWorldState {
  readonly defeatedUntilMs: number;
}

export interface GatheringActivity {
  readonly type: "gathering";
  readonly targetId: string;
  readonly resourceId: string;
  readonly progressMs: number;
}

export interface ProductionActivity {
  readonly type: "production";
  readonly targetId: string;
  readonly recipeId: string;
  readonly progressMs: number;
}

export interface CombatActivity {
  readonly type: "combat";
  readonly targetId: string;
  readonly enemyId: string;
  readonly progressMs: number;
  readonly enemyHp: number;
}

export type Activity = GatheringActivity | ProductionActivity | CombatActivity;

export interface GameSettings {
  readonly quality: QualityLevel;
  readonly musicVolume: number;
  readonly effectsVolume: number;
  readonly reducedMotion: boolean;
}

export interface GameSave {
  readonly saveVersion: typeof SAVE_VERSION;
  readonly player: {
    readonly id: string;
    readonly name: string;
    readonly hp: number;
    readonly maxHp: number;
  };
  readonly position: PlayerPosition;
  readonly currentZone: string;
  readonly inventory: readonly InventoryStack[];
  readonly inventorySlots: number;
  readonly equipment: Readonly<Record<EquipmentSlot, string | null>>;
  readonly skills: Readonly<Record<SkillId, SkillProgress>>;
  readonly mastery: Readonly<Record<string, MasteryProgress>>;
  readonly quests: Readonly<Record<string, QuestProgress>>;
  readonly worldFlags: Readonly<Record<string, boolean>>;
  readonly worldResources: Readonly<Record<string, ResourceWorldState>>;
  readonly worldEnemies: Readonly<Record<string, EnemyWorldState>>;
  readonly collections: readonly string[];
  readonly currentActivity: Activity | null;
  readonly activitySequence: number;
  readonly rngSeed: string;
  readonly simulationTimeMs: number;
  readonly lastSavedAt: number;
  readonly lastActiveAt: number;
  readonly settings: GameSettings;
}

export type StopReason =
  | "none"
  | "inventory_full"
  | "missing_tool"
  | "inputs_exhausted"
  | "output_blocked"
  | "player_died"
  | "target_defeated"
  | "activity_invalid"
  | "cancelled";

export type GameEvent =
  | { readonly type: "item_gained"; readonly itemId: string; readonly quantity: number; readonly sourceId: string }
  | { readonly type: "item_consumed"; readonly itemId: string; readonly quantity: number }
  | { readonly type: "item_equipped"; readonly itemId: string; readonly slot: EquipmentSlot }
  | { readonly type: "xp_gained"; readonly skill: SkillId; readonly amount: number }
  | { readonly type: "level_gained"; readonly skill: SkillId; readonly from: number; readonly to: number }
  | { readonly type: "mastery_gained"; readonly targetId: string; readonly amount: number }
  | { readonly type: "mastery_rank_gained"; readonly targetId: string; readonly from: number; readonly to: number }
  | { readonly type: "rare_drop"; readonly itemId: string; readonly quantity: number; readonly sourceId: string }
  | { readonly type: "resource_depleted"; readonly targetId: string; readonly untilMs: number }
  | { readonly type: "damage"; readonly target: "player" | "enemy"; readonly amount: number }
  | { readonly type: "enemy_defeated"; readonly enemyId: string; readonly targetId: string }
  | { readonly type: "player_died"; readonly enemyId: string }
  | { readonly type: "quest_advanced"; readonly questId: string; readonly stepIndex: number }
  | { readonly type: "quest_completed"; readonly questId: string }
  | { readonly type: "world_interacted"; readonly targetId: string }
  | { readonly type: "activity_stopped"; readonly reason: StopReason };

export interface ActivityReport {
  readonly elapsedMs: number;
  readonly productiveMs: number;
  /** Elapsed time within this simulation window when the activity stopped. */
  readonly stoppedAfterMs: number | null;
  readonly stopReason: StopReason;
  readonly xpGained: Readonly<Partial<Record<SkillId, number>>>;
  readonly itemsGained: readonly InventoryStack[];
  readonly masteryGained: Readonly<Record<string, number>>;
  readonly rareDrops: readonly InventoryStack[];
  readonly levelGains: readonly { readonly skill: SkillId; readonly from: number; readonly to: number }[];
  readonly deaths: number;
}

export interface SimulationResult {
  readonly state: GameSave;
  readonly events: readonly GameEvent[];
  readonly report: ActivityReport;
}

export interface ActionResult {
  readonly state: GameSave;
  readonly events: readonly GameEvent[];
  readonly ok: boolean;
  readonly reason: StopReason;
}
