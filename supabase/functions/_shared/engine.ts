// ============================================================
// EVERLOOM ENGINE — Deno-compatible single-file bundle.
// Combines types, RNG, XP, inventory, combat, and resolve.
// ============================================================

// ── Types ─────────────────────────────────────────────────────

export type SkillId =
  | "woodcutting" | "mining" | "fishing" | "crafting" | "smithing"
  | "fletching" | "cooking" | "combat" | "wayfaring" | "slayer";

export type ZoneId =
  | "meadowrest" | "bramblewood" | "ashen_delve" | "saltmarsh_reach"
  | "gloamfen" | "emberpeak" | "frayed_reach" | "loomheart";

export type DeathMode = "cozy" | "standard" | "ironbound";
export type ActionType =
  | "idle" | "woodcutting" | "mining" | "fishing" | "crafting"
  | "smithing" | "fletching" | "cooking" | "traveling" | "slayer";
export type CourierState = "idle" | "outbound" | "returning";

export interface ItemStack { readonly itemId: string; readonly qty: number }

export interface ToolComponent {
  readonly headId: string | null; readonly haftId: string | null;
  readonly bindingId: string | null; readonly headTier: number;
  readonly haftTier: number; readonly bindingTier: number;
  readonly wearMastery: number; readonly wearPct: number;
}

export interface Equipment {
  readonly hatchet: ToolComponent | null; readonly pickaxe: ToolComponent | null;
  readonly fishingRod: ToolComponent | null; readonly helmet: string | null;
  readonly body: string | null; readonly legs: string | null;
  readonly kitUnlocked: boolean;
}

export interface Courier {
  readonly id: string; readonly name: string; readonly personality: string;
  readonly state: CourierState; readonly etaSeconds: number;
  readonly tripsCompleted: number;
}

export interface LarderEntry {
  readonly itemId: string; readonly qty: number; readonly freshnessAt: number;
}

export interface CurrentAction {
  readonly type: ActionType; readonly nodeId: string | null;
  readonly zoneId: ZoneId; readonly startedAt: number;
  readonly recipeId: string | null; readonly targetZoneId: ZoneId | null;
}

export interface ParallelAction {
  readonly id: string; readonly type: "farming"; readonly plotId: string;
  readonly seedItemId: string; readonly plantedAt: number; readonly harvestAt: number;
}

export type SkillMap = Readonly<Record<SkillId, number>>;
export type MasteryMap = Readonly<Record<string, number>>;
export type StackCapMap = Readonly<Record<string, number>>;

export interface CombatStats {
  readonly hp: number; readonly maxHp: number; readonly defenceRating: number;
  readonly attackRating: number; readonly strengthRating: number;
}

export interface DeathRecord {
  readonly atSeconds: number; readonly causeEnemyId: string | null;
  readonly zoneId: ZoneId; readonly lostItems: readonly ItemStack[];
}

export interface Pattern {
  readonly id: string; readonly buffType: string;
  readonly buffValue: number; readonly expiresAt: number;
}

export interface PlayerState {
  readonly playerId: string; readonly displayName: string;
  readonly mode: DeathMode; readonly rngSeed: bigint;
  readonly checkpointAt: number; readonly currentAction: CurrentAction;
  readonly parallelActions: readonly ParallelAction[];
  readonly skills: SkillMap; readonly mastery: MasteryMap;
  readonly inventory: readonly ItemStack[]; readonly slots: number;
  readonly stackCaps: StackCapMap; readonly bank: readonly ItemStack[];
  readonly larder: readonly LarderEntry[]; readonly equipment: Equipment;
  readonly couriers: readonly Courier[]; readonly patterns: readonly Pattern[];
  readonly motes: number;
  readonly rivalXpSnapshot: Readonly<Partial<SkillMap>>;
  readonly rivalLastUpdatedAt: number; readonly combat: CombatStats;
  readonly zoneId: ZoneId; readonly unlockedZones: readonly ZoneId[];
  readonly travelProgress: number;
  readonly collectedItemIds: readonly string[];
  readonly completedBundleIds: readonly string[];
  readonly completedWeeklyContractIds: readonly string[];
  readonly foundBlueprintIds: readonly string[];
  readonly pets: readonly string[];
  readonly version: number; readonly isDead: boolean;
  // Character appearance
  readonly appearance?: CharacterAppearance;
}

export interface CharacterAppearance {
  readonly skinTone: number;   // 0-5
  readonly hairStyle: number;  // 0-7
  readonly hairColor: number;  // 0-9
  readonly torsoColor: number; // 0-9
  readonly legsColor: number;  // 0-9
}

export interface ActionDescriptor {
  readonly type: ActionType; readonly nodeId: string | null;
  readonly zoneId: ZoneId; readonly recipeId: string | null;
  readonly targetZoneId: ZoneId | null;
}

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
  | { readonly kind: "pet_found"; readonly petId: string; readonly atSeconds: number }
  | { readonly kind: "blueprint_found"; readonly blueprintId: string; readonly itemId: string; readonly atSeconds: number }
  | { readonly kind: "glimmer"; readonly nodeId: string; readonly motes: number; readonly atSeconds: number };

export interface ResolveOutput { readonly state: PlayerState; readonly events: readonly GameEvent[] }

// ── GameData interfaces ────────────────────────────────────────

export interface ZoneThreat {
  readonly zoneId: ZoneId; readonly danger: number;
  readonly ambientEnemyId: string; readonly damagePerHit: number;
  readonly hitIntervalSeconds: number;
}

export interface NodeData {
  readonly id: string; readonly skill: SkillId; readonly zoneId: ZoneId;
  readonly hardness: number; readonly baseActionTimeSec: number;
  readonly xpPerAction: number; readonly masteryXpPerAction: number;
  readonly drops: readonly { readonly itemId: string; readonly materialClass: string; readonly chance: number; readonly qty: number }[];
  readonly rareDrops: readonly { readonly itemId: string; readonly chance: number }[];
  readonly petChance: number; readonly petId: string;
}

export interface ItemData {
  readonly id: string; readonly name: string; readonly materialClass: string;
  readonly healAmount: number; readonly freshnessDecaySec: number;
  readonly baseValue: number; readonly tradeable: boolean;
}

export interface RecipeData {
  readonly id: string; readonly skill: SkillId; readonly levelReq: number;
  readonly inputs: readonly { readonly itemId: string; readonly qty: number }[];
  readonly output: { readonly itemId: string; readonly qty: number };
  readonly actionTimeSec: number; readonly xpPerAction: number;
  readonly masteryXpPerAction: number; readonly blueprintRequired: boolean;
}

export interface ZoneData {
  readonly id: ZoneId; readonly danger: number; readonly richness: number;
  readonly travelTimeSec: number; readonly threat: ZoneThreat | null;
  readonly unlockBundleId: string | null;
}

export interface GameData {
  readonly nodes: Readonly<Record<string, NodeData>>;
  readonly items: Readonly<Record<string, ItemData>>;
  readonly recipes: Readonly<Record<string, RecipeData>>;
  readonly zones: Readonly<Record<string, ZoneData>>;
  readonly healMap: Readonly<Record<string, number>>;
}

// ── RNG ───────────────────────────────────────────────────────

export function splitmix32(seed: number): () => number {
  let s = seed | 0;
  return function () {
    s = (s + 0x9e3779b9) | 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) | 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) | 0;
    return ((z ^ (z >>> 16)) >>> 0) / 0x100000000;
  };
}

export function deriveSeed(playerSeed: bigint, actionId: string, tickIndex: number): number {
  let h = Number(playerSeed & 0xffffffffn);
  for (let i = 0; i < actionId.length; i++) {
    h = Math.imul(h ^ actionId.charCodeAt(i), 0x9e3779b9) | 0;
  }
  h = Math.imul(h ^ tickIndex, 0xdeadbeef) | 0;
  return h >>> 0;
}

export function rollChanceFP(rng: () => number, chancePerMille: number): boolean {
  if (chancePerMille <= 0) return false;
  if (chancePerMille >= 100_000) return true;
  return rng() * 100_000 < chancePerMille;
}

// ── XP ────────────────────────────────────────────────────────

function xpForLevel(level: number): number {
  if (level <= 1) return 0;
  if (level > 99) return 13_034_431;
  let total = 0;
  for (let l = 1; l < level; l++) total += Math.floor(l + 300 * Math.pow(2, l / 7));
  return Math.floor(total / 4);
}

const XP_TABLE: readonly number[] = (() => {
  const t: number[] = [0];
  for (let lvl = 1; lvl <= 99; lvl++) t.push(xpForLevel(lvl));
  return t;
})();

export function levelFromXp(xp: number): number {
  let lo = 1, hi = 99;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((XP_TABLE[mid] ?? Infinity) <= xp) lo = mid; else hi = mid - 1;
  }
  return lo;
}

const MASTERY_SCALE = 0.15;
const MASTERY_TABLE: readonly number[] = (() => {
  const t: number[] = [0];
  for (let lvl = 1; lvl <= 99; lvl++) t.push(Math.floor(xpForLevel(lvl) * MASTERY_SCALE));
  return t;
})();

export function masteryLevelFromXp(xp: number): number {
  let lo = 1, hi = 99;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if ((MASTERY_TABLE[mid] ?? Infinity) <= xp) lo = mid; else hi = mid - 1;
  }
  return lo;
}

// ── Inventory ─────────────────────────────────────────────────

export function addToInventory(
  inventory: readonly ItemStack[], itemId: string, qty: number,
  slots: number, stackCaps: StackCapMap, materialClass: string
): { inventory: ItemStack[]; added: number; overflow: number } {
  const cap = stackCaps[materialClass] ?? 1;
  const mutable = inventory.map((s) => ({ ...s })) as Array<{ itemId: string; qty: number }>;
  const existing = mutable.find((s) => s.itemId === itemId);
  let added = 0;
  if (existing) {
    const canAdd = Math.max(0, cap - existing.qty);
    const toAdd = Math.min(qty, canAdd);
    existing.qty += toAdd; added = toAdd;
  } else if (mutable.length < slots) {
    const toAdd = Math.min(qty, cap);
    mutable.push({ itemId, qty: toAdd }); added = toAdd;
  }
  return { inventory: mutable, added, overflow: qty - added };
}

export function isInventoryFull(inventory: readonly ItemStack[], slots: number): boolean {
  return inventory.length >= slots && inventory.every((s) => s.qty > 0);
}

export function addToBank(bank: readonly ItemStack[], items: readonly ItemStack[]): ItemStack[] {
  const mutable = bank.map((s) => ({ ...s })) as Array<{ itemId: string; qty: number }>;
  for (const item of items) {
    const existing = mutable.find((s) => s.itemId === item.itemId);
    if (existing) existing.qty += item.qty; else mutable.push({ itemId: item.itemId, qty: item.qty });
  }
  return mutable;
}

export function addToLarder(
  larder: readonly LarderEntry[], itemId: string, qty: number,
  freshnessAt: number, larderCap: number
): { larder: LarderEntry[]; added: number } {
  const mutable = larder.map((e) => ({ ...e })) as Array<{ itemId: string; qty: number; freshnessAt: number }>;
  const totalQty = mutable.reduce((a, e) => a + e.qty, 0);
  const canAdd = Math.max(0, larderCap - totalQty);
  const toAdd = Math.min(qty, canAdd);
  if (toAdd <= 0) return { larder: mutable, added: 0 };
  const existing = mutable.find((e) => e.itemId === itemId);
  if (existing) { existing.qty += toAdd; existing.freshnessAt = Math.max(existing.freshnessAt, freshnessAt); }
  else mutable.push({ itemId, qty: toAdd, freshnessAt });
  return { larder: mutable, added: toAdd };
}

export function larderCapacity(cookingLevel: number): number {
  return 20 + Math.floor(cookingLevel * cookingLevel * 0.3);
}

export function consumeFromLarder(larder: readonly LarderEntry[], qty: number): { larder: LarderEntry[] } {
  const mutable = larder.map((e) => ({ ...e })) as Array<{ itemId: string; qty: number; freshnessAt: number }>;
  let remaining = qty;
  for (const entry of mutable) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, entry.qty);
    entry.qty -= take; remaining -= take;
  }
  return { larder: mutable.filter((e) => e.qty > 0) };
}

export function resolveCouriers(
  couriers: readonly Courier[], elapsedSeconds: number,
  inventory: readonly ItemStack[], bank: readonly ItemStack[], slots: number
): { couriers: Courier[]; bank: ItemStack[]; inventory: ItemStack[]; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let currentBank = bank as ItemStack[];
  let currentInventory = inventory as ItemStack[];
  const updatedCouriers: Courier[] = [];
  for (const courier of couriers) {
    let remaining = elapsedSeconds, state = courier.state as CourierState;
    let eta = courier.etaSeconds, trips = courier.tripsCompleted;
    while (remaining > 0 && state !== "idle") {
      if (remaining >= eta) {
        remaining -= eta;
        if (state === "outbound") {
          currentBank = addToBank(currentBank, currentInventory);
          currentInventory = [];
          events.push({ kind: "courier_dispatched", courierId: courier.id, couriername: courier.name, atSeconds: elapsedSeconds - remaining });
          state = "returning"; eta = 30;
        } else if (state === "returning") {
          events.push({ kind: "courier_returned", courierId: courier.id, couriername: courier.name, atSeconds: elapsedSeconds - remaining });
          trips++; state = "idle"; eta = 0;
        }
      } else { eta -= remaining; remaining = 0; }
    }
    updatedCouriers.push({ ...courier, state, etaSeconds: eta, tripsCompleted: trips });
  }
  return { couriers: updatedCouriers, bank: currentBank, inventory: currentInventory, events };
}

// ── Combat ────────────────────────────────────────────────────

function resolveDeath(mode: DeathMode, droppableItems: readonly { itemId: string; value: number }[]): Array<{ itemId: string; qty: number }> {
  if (mode === "cozy" || mode === "ironbound" || droppableItems.length === 0) return [];
  const sorted = [...droppableItems].sort((a, b) => a.value - b.value);
  const pool = sorted.slice(0, sorted.length - 1);
  if (pool.length === 0) return [];
  const maxVal = Math.max(1, ...pool.map((i) => i.value));
  const weights = pool.map((i) => maxVal - i.value + 1);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let roll = Math.floor(Math.random() * totalWeight);
  for (let i = 0; i < pool.length; i++) { roll -= weights[i]!; if (roll < 0) return [{ itemId: pool[i]!.itemId, qty: 1 }]; }
  return [{ itemId: pool[pool.length - 1]!.itemId, qty: 1 }];
}

function resolveAmbientCombat(params: {
  stats: CombatStats; threat: ZoneThreat | null; durationSeconds: number;
  food: readonly { itemId: string; qty: number; healAmount: number }[];
  mode: DeathMode; zoneId: ZoneId;
  droppableItems: readonly { itemId: string; value: number }[];
}): { hpRemaining: number; deaths: DeathRecord[]; events: GameEvent[] } {
  const { stats, threat, durationSeconds, food, mode, zoneId } = params;
  if (!threat || threat.danger === 0) return { hpRemaining: stats.hp, deaths: [], events: [] };
  const mitigationFP = Math.min(stats.defenceRating * 5, 750);
  const effectiveDamage = Math.max(1, Math.floor(threat.damagePerHit * (1000 - mitigationFP) / 1000));
  const hitInterval = Math.max(1, threat.hitIntervalSeconds);
  const totalHits = Math.floor(durationSeconds / hitInterval);
  const foodPool = food.filter((f) => f.qty > 0 && f.healAmount > 0)
    .map((f) => ({ itemId: f.itemId, qty: f.qty, heal: f.healAmount }))
    .sort((a, b) => b.heal - a.heal);
  let hp = stats.hp; const maxHp = stats.maxHp;
  const events: GameEvent[] = [], deaths: DeathRecord[] = [];
  for (let i = 0; i < totalHits; i++) {
    const hitAt = (i + 1) * hitInterval;
    hp -= effectiveDamage;
    events.push({ kind: "enemy_attacked", enemyId: threat.ambientEnemyId, damage: effectiveDamage, atSeconds: hitAt });
    while (hp < Math.floor(maxHp / 2) && foodPool.length > 0) {
      const f = foodPool[0]!; const heal = Math.min(f.heal, maxHp - hp);
      hp = Math.min(maxHp, hp + heal); f.qty--;
      events.push({ kind: "food_consumed", itemId: f.itemId, heal, atSeconds: hitAt });
      if (f.qty === 0) foodPool.shift();
    }
    if (hp <= 0) {
      hp = 0;
      const lostItems = resolveDeath(mode, params.droppableItems);
      const record: DeathRecord = { atSeconds: hitAt, causeEnemyId: threat.ambientEnemyId, zoneId, lostItems };
      deaths.push(record); events.push({ kind: "death", record });
      if (mode === "ironbound") break;
      hp = maxHp;
    }
  }
  return { hpRemaining: hp, deaths, events };
}

// ── Resolve ───────────────────────────────────────────────────

function buildCurrentAction(action: ActionDescriptor, nowSeconds: number): CurrentAction {
  return { type: action.type, nodeId: action.nodeId, zoneId: action.zoneId, startedAt: nowSeconds, recipeId: action.recipeId, targetZoneId: action.targetZoneId };
}

function getToolForSkill(state: PlayerState, skill: SkillId): ToolComponent | null {
  switch (skill) {
    case "woodcutting": return state.equipment.hatchet;
    case "mining": return state.equipment.pickaxe;
    case "fishing": return state.equipment.fishingRod;
    default: return null;
  }
}

function removeFromInventory(inventory: readonly ItemStack[], itemId: string, qty: number): ItemStack[] {
  const mutable = inventory.map((s) => ({ ...s })) as ItemStack[];
  const idx = mutable.findIndex((s) => s.itemId === itemId);
  if (idx < 0) return mutable;
  (mutable[idx] as { qty: number }).qty -= qty;
  if ((mutable[idx] as { qty: number }).qty <= 0) mutable.splice(idx, 1);
  return mutable;
}

function resolveGathering(state: PlayerState, action: ActionDescriptor, elapsedSeconds: number, nowSeconds: number, rngSeed: bigint, gameData: GameData): ResolveOutput {
  const nodeId = action.nodeId;
  if (!nodeId) return { state, events: [] };
  const node = gameData.nodes[nodeId];
  if (!node) return { state, events: [] };
  const skillXp = state.skills[node.skill] ?? 0;
  const masteryXp = state.mastery[nodeId] ?? 0;
  const tool = getToolForSkill(state, node.skill);
  const headTier = tool?.headTier ?? 0, haftTier = tool?.haftTier ?? 0;
  const tierGap = node.hardness - headTier;
  if (tierGap >= 3) return { state, events: [] };
  const hardnessMult = tierGap === 2 ? 12 : tierGap === 1 ? 3 : 1;
  const speedBonus = Math.floor(levelFromXp(skillXp) * 8 + haftTier * 200);
  const actionTimeSec = Math.floor(Math.max(4000, node.baseActionTimeSec * 1000 * hardnessMult - speedBonus) / 1000);
  const masteryLevel = masteryLevelFromXp(masteryXp);
  const doubleYieldFP = Math.min(masteryLevel * 200, 20_000);
  const richnessFP = gameData.zones[state.zoneId]?.richness ?? 1000;
  const rng = splitmix32(deriveSeed(rngSeed, nodeId, 0));
  const events: GameEvent[] = [];
  let newSkillXp = skillXp, newMasteryXp = masteryXp;
  let newInventory = [...state.inventory];
  let newLarder = [...state.larder];
  const newPets = [...state.pets], newCollected = [...state.collectedItemIds];
  const larderCap = larderCapacity(levelFromXp(state.skills.cooking ?? 0));
  let secondsRemaining = elapsedSeconds;
  let prevSkillLevel = levelFromXp(skillXp), prevMasteryLevel = masteryLevel;
  while (secondsRemaining >= actionTimeSec) {
    secondsRemaining -= actionTimeSec;
    const atSeconds = elapsedSeconds - secondsRemaining;
    const xpGain = Math.floor(node.xpPerAction * richnessFP / 1000);
    newSkillXp += xpGain;
    events.push({ kind: "xp_gain", skill: node.skill, amount: xpGain, atSeconds });
    newMasteryXp += node.masteryXpPerAction;
    events.push({ kind: "mastery_gain", nodeId, amount: node.masteryXpPerAction, atSeconds });
    const sl = levelFromXp(newSkillXp);
    if (sl > prevSkillLevel) { events.push({ kind: "level_up", skill: node.skill, newLevel: sl, atSeconds }); prevSkillLevel = sl; }
    const ml = masteryLevelFromXp(newMasteryXp);
    if (ml > prevMasteryLevel) { events.push({ kind: "mastery_level_up", nodeId, newLevel: ml, atSeconds }); prevMasteryLevel = ml; }
    for (const drop of node.drops) {
      if (!rollChanceFP(rng, drop.chance * 100)) continue;
      let qty = drop.qty;
      if (rollChanceFP(rng, doubleYieldFP)) qty *= 2;
      qty = Math.max(1, Math.floor(qty * richnessFP / 1000));
      if (node.skill === "cooking") {
        const r = addToLarder(newLarder, drop.itemId, qty, nowSeconds + 7 * 86400, larderCap);
        newLarder = r.larder;
        if (r.added > 0) events.push({ kind: "item_gained", itemId: drop.itemId, qty: r.added, atSeconds });
      } else {
        const r = addToInventory(newInventory, drop.itemId, qty, state.slots, state.stackCaps, drop.materialClass);
        newInventory = r.inventory;
        if (r.added > 0) { events.push({ kind: "item_gained", itemId: drop.itemId, qty: r.added, atSeconds }); if (!newCollected.includes(drop.itemId)) newCollected.push(drop.itemId); }
        if (isInventoryFull(newInventory, state.slots)) { events.push({ kind: "satchel_full", atSeconds }); if (!state.couriers.some((c) => c.state === "idle")) break; }
      }
      for (const rare of node.rareDrops) {
        if (rng() < 1 / rare.chance) {
          const r = addToInventory(newInventory, rare.itemId, 1, state.slots, state.stackCaps, "rare");
          newInventory = r.inventory;
          events.push({ kind: "item_gained", itemId: rare.itemId, qty: 1, atSeconds });
          if (!newCollected.includes(rare.itemId)) newCollected.push(rare.itemId);
        }
      }
    }
    if (node.petChance > 0 && !newPets.includes(node.petId) && rng() < 1 / node.petChance) {
      newPets.push(node.petId); events.push({ kind: "pet_found", petId: node.petId, atSeconds });
    }
    if (rng() < 1 / 30) events.push({ kind: "glimmer", nodeId, motes: 2, atSeconds });
  }
  return { state: { ...state, skills: { ...state.skills, [node.skill]: newSkillXp }, mastery: { ...state.mastery, [nodeId]: newMasteryXp }, inventory: newInventory, larder: newLarder, pets: newPets, collectedItemIds: newCollected }, events };
}

function resolveProduction(state: PlayerState, action: ActionDescriptor, elapsedSeconds: number, nowSeconds: number, _rngSeed: bigint, gameData: GameData): ResolveOutput {
  const recipeId = action.recipeId;
  if (!recipeId) return { state, events: [] };
  const recipe = gameData.recipes[recipeId];
  if (!recipe) return { state, events: [] };
  const skillXp = state.skills[recipe.skill] ?? 0;
  if (levelFromXp(skillXp) < recipe.levelReq) return { state, events: [] };
  if (recipe.blueprintRequired && !state.foundBlueprintIds.includes(recipeId)) return { state, events: [] };
  const events: GameEvent[] = [];
  let newSkillXp = skillXp;
  let newInventory = [...state.inventory], newLarder = [...state.larder];
  const larderCap = larderCapacity(levelFromXp(state.skills.cooking ?? 0));
  const newCollected = [...state.collectedItemIds];
  let secondsRemaining = elapsedSeconds, prevSkillLevel = levelFromXp(skillXp);
  while (secondsRemaining >= recipe.actionTimeSec) {
    const hasInputs = recipe.inputs.every((inp) => (newInventory.find((s) => s.itemId === inp.itemId)?.qty ?? 0) >= inp.qty);
    if (!hasInputs) break;
    secondsRemaining -= recipe.actionTimeSec;
    const atSeconds = elapsedSeconds - secondsRemaining;
    for (const inp of recipe.inputs) {
      const idx = newInventory.findIndex((s) => s.itemId === inp.itemId);
      if (idx >= 0) { (newInventory[idx] as { qty: number }).qty -= inp.qty; if ((newInventory[idx] as { qty: number }).qty <= 0) newInventory.splice(idx, 1); }
    }
    const { itemId, qty } = recipe.output;
    const item = gameData.items[itemId];
    if (recipe.skill === "cooking" && (item?.healAmount ?? 0) > 0) {
      const r = addToLarder(newLarder, itemId, qty, nowSeconds + 7 * 86400, larderCap);
      newLarder = r.larder;
      if (r.added > 0) events.push({ kind: "item_gained", itemId, qty: r.added, atSeconds });
    } else {
      const r = addToInventory(newInventory, itemId, qty, state.slots, state.stackCaps, item?.materialClass ?? "misc");
      newInventory = r.inventory;
      if (r.added > 0) { events.push({ kind: "item_gained", itemId, qty: r.added, atSeconds }); if (!newCollected.includes(itemId)) newCollected.push(itemId); }
    }
    newSkillXp += recipe.xpPerAction;
    events.push({ kind: "xp_gain", skill: recipe.skill, amount: recipe.xpPerAction, atSeconds });
    const sl = levelFromXp(newSkillXp);
    if (sl > prevSkillLevel) { events.push({ kind: "level_up", skill: recipe.skill, newLevel: sl, atSeconds }); prevSkillLevel = sl; }
  }
  return { state: { ...state, skills: { ...state.skills, [recipe.skill]: newSkillXp }, inventory: newInventory, larder: newLarder, collectedItemIds: newCollected }, events };
}

function resolveTravel(state: PlayerState, action: ActionDescriptor, elapsedSeconds: number, gameData: GameData): ResolveOutput {
  const targetZone = action.targetZoneId;
  if (!targetZone) return { state, events: [] };
  const zone = gameData.zones[targetZone];
  if (!zone) return { state, events: [] };
  const travelReduction = Math.min(levelFromXp(state.skills.wayfaring ?? 0) * 5, 50);
  const travelTimeSec = Math.max(10, Math.floor(zone.travelTimeSec * (100 - travelReduction) / 100));
  if (elapsedSeconds >= travelTimeSec) {
    const newUnlocked = state.unlockedZones.includes(targetZone) ? state.unlockedZones : [...state.unlockedZones, targetZone];
    const events: GameEvent[] = [];
    if (!state.unlockedZones.includes(targetZone)) events.push({ kind: "zone_unlocked", zoneId: targetZone, atSeconds: travelTimeSec });
    return { state: { ...state, zoneId: targetZone, unlockedZones: newUnlocked, travelProgress: 0 }, events };
  }
  return { state: { ...state, travelProgress: Math.floor((elapsedSeconds * 1000) / travelTimeSec) }, events: [] };
}

export function resolve(
  input: { state: PlayerState; action: ActionDescriptor; elapsedSeconds: number; nowSeconds: number; rngSeed: bigint },
  gameData: GameData
): ResolveOutput {
  const { state, action, elapsedSeconds, nowSeconds, rngSeed } = input;
  if (state.isDead) return { state, events: [] };
  if (elapsedSeconds <= 0) {
    return { state: { ...state, currentAction: buildCurrentAction(action, nowSeconds), checkpointAt: nowSeconds }, events: [] };
  }
  const allEvents: GameEvent[] = [];
  const cr = resolveCouriers(state.couriers, elapsedSeconds, [...state.inventory], [...state.bank], state.slots);
  allEvents.push(...cr.events);
  let ws: PlayerState = { ...state, couriers: cr.couriers, bank: cr.bank, inventory: cr.inventory };
  let ar: ResolveOutput;
  switch (action.type) {
    case "woodcutting": case "mining": case "fishing":
      ar = resolveGathering(ws, action, elapsedSeconds, nowSeconds, rngSeed, gameData); break;
    case "crafting": case "smithing": case "fletching": case "cooking":
      ar = resolveProduction(ws, action, elapsedSeconds, nowSeconds, rngSeed, gameData); break;
    case "traveling":
      ar = resolveTravel(ws, action, elapsedSeconds, gameData); break;
    default: ar = { state: ws, events: [] };
  }
  allEvents.push(...ar.events); ws = ar.state;
  const zone = gameData.zones[state.zoneId];
  if (zone?.threat && state.currentAction.type !== "traveling") {
    const healMap = gameData.healMap;
    const foodForCombat = ws.larder.filter((e) => e.qty > 0).map((e) => ({ itemId: e.itemId, qty: e.qty, healAmount: healMap[e.itemId] ?? 0 }));
    const droppable = ws.inventory.map((s) => ({ itemId: s.itemId, value: gameData.items[s.itemId]?.baseValue ?? 0 }));
    const combat = resolveAmbientCombat({ stats: ws.combat, threat: zone.threat, durationSeconds: elapsedSeconds, food: foodForCombat, mode: state.mode, zoneId: state.zoneId, droppableItems: droppable });
    allEvents.push(...combat.events);
    let newLarder = [...ws.larder];
    for (const e of combat.events) { if (e.kind === "food_consumed") { const r = consumeFromLarder(newLarder, 1); newLarder = r.larder; } }
    let newInventory = [...ws.inventory]; let isDead = ws.isDead;
    for (const death of combat.deaths) {
      for (const lost of death.lostItems) {
        newInventory = removeFromInventory(newInventory, lost.itemId, lost.qty);
        allEvents.push({ kind: "item_lost", itemId: lost.itemId, qty: lost.qty, atSeconds: death.atSeconds, reason: "death" });
      }
      if (state.mode === "ironbound") { isDead = true; break; }
    }
    ws = { ...ws, larder: newLarder, inventory: newInventory, isDead, combat: { ...ws.combat, hp: isDead ? 0 : combat.hpRemaining } };
  }
  return { state: { ...ws, currentAction: buildCurrentAction(action, nowSeconds), checkpointAt: nowSeconds, version: state.version + 1 }, events: allEvents };
}
