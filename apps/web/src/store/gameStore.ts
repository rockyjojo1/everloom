import { create } from "zustand";
import type { PlayerState, ActionDescriptor, GameEvent, SkillId, CharacterAppearance } from "@everloom/engine";
import { resolve, levelFromXp } from "@everloom/engine";
import { GAME_DATA } from "@everloom/gamedata";
import { supabase } from "../lib/supabase";
import { LEDGER } from "@everloom/gamedata";
import { createNewPlayerState } from "../lib/playerInit";
import { buildReturnReport, type ReturnReportData } from "../lib/returnReport";

export type AppScreen = "landing" | "character_select" | "create" | "game" | "return_report";

export type ActivePanel = "none" | "satchel" | "bench" | "atlas" | "ledger" | "equipment" | "exchange" | "larder";

export interface Toast {
  id: number;
  message: string;
  kind: "normal" | "levelup" | "death" | "discovery";
}

export interface XpPopup {
  id: number;
  text: string;
  x: number;
  y: number;
}

interface GameStore {
  // Auth
  userId: string | null;

  // Screen
  screen: AppScreen;
  activePanel: ActivePanel;

  // Game state
  playerState: PlayerState | null;
  pendingEvents: GameEvent[];
  returnReport: ReturnReportData | null;

  // UI state
  toasts: Toast[];
  xpPopups: XpPopup[];
  shaking: boolean;
  activeGlimmer: { nodeId: string; x: number; y: number } | null;
  glimmerWindowOpen: boolean;

  // Offline
  lastCommitAt: number;
  isSyncing: boolean;
  isOffline: boolean;

  // Actions
  setScreen: (s: AppScreen) => void;
  setActivePanel: (p: ActivePanel) => void;
  initFromSupabase: () => Promise<void>;
  createCharacter: (name: string, mode: "cozy" | "standard" | "ironbound", appearance?: CharacterAppearance | undefined) => Promise<void>;
  startAction: (action: ActionDescriptor) => void;
  equipTool: (itemId: string) => void;
  tickFrame: () => void;
  commitToServer: () => Promise<void>;
  tapGlimmer: () => void;
  dismissReturnReport: () => void;
  addToast: (msg: string, kind?: Toast["kind"]) => void;
  spawnXpPopup: (text: string, x: number, y: number) => void;
  submitLedgerBundle: (bundleId: string) => void;
}

let toastCounter = 0;
let popupCounter = 0;

export const useGameStore = create<GameStore>((set, get) => ({
  userId: null,
  screen: "landing",
  activePanel: "none",
  playerState: null,
  pendingEvents: [],
  returnReport: null,
  toasts: [],
  xpPopups: [],
  shaking: false,
  activeGlimmer: null,
  glimmerWindowOpen: false,
  lastCommitAt: 0,
  isSyncing: false,
  isOffline: !navigator.onLine,

  setScreen: (s) => set({ screen: s }),
  setActivePanel: (p) => set({ activePanel: p }),

  initFromSupabase: async () => {
    const timeout = <T,>(ms: number, fallback: T): Promise<T> =>
      new Promise((res) => setTimeout(() => res(fallback), ms));

    const session = await Promise.race([
      supabase.auth.getSession().then((r) => r.data.session),
      timeout(5000, null),
    ]);

    if (!session) {
      // Sign in anonymously — no wall before the cozy first 10 minutes.
      const authResult = await Promise.race([
        supabase.auth.signInAnonymously(),
        timeout(5000, null as never),
      ]);
      if (!authResult || authResult.error || !authResult.data.session) {
        // Fully offline fallback — generate a local state.
        set({ screen: "create", userId: "local_" + Date.now() });
        return;
      }
      set({ userId: authResult.data.session.user.id, screen: "create" });
      return;
    }

    set({ userId: session.user.id });

    // Try to load existing player state (5s timeout — offline fallback to create).
    const stateResult = await Promise.race([
      supabase.from("el_player_state").select("*").eq("player_id", session.user.id).single(),
      timeout(5000, null),
    ]);
    const stateRow = stateResult?.data ?? null;

    if (!stateRow) {
      set({ screen: "create" });
      return;
    }

    // Reconstruct player state from Supabase row.
    const ps = rowToPlayerState(stateRow);

    // Compute offline progress.
    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - ps.checkpointAt;

    if (elapsed > 30) {
      const result = resolve(
        { state: ps, action: ps.currentAction as ActionDescriptor, elapsedSeconds: elapsed, nowSeconds: now, rngSeed: ps.rngSeed },
        GAME_DATA
      );

      const report = buildReturnReport(result.events, elapsed);
      set({
        playerState: result.state,
        returnReport: report,
        screen: elapsed > 120 ? "return_report" : "character_select",
        pendingEvents: [],
      });

      void get().commitToServer();
    } else {
      set({ playerState: ps, screen: "character_select" });
    }
  },

  createCharacter: async (name, mode, appearance) => {
    const { userId } = get();
    if (!userId) return;

    const newState: PlayerState = {
      ...createNewPlayerState(userId, name, mode),
      ...(appearance ? { appearance } : {}),
    };

    // Navigate to game immediately — don't wait on network.
    set({ playerState: newState, screen: "game" });

    // Persist in background; silently ignore failures (offline ok).
    void supabase.from("el_players").upsert({
      id: userId,
      display_name: name,
      mode,
      rng_seed: newState.rngSeed.toString(),
    });
    void supabase.from("el_player_state").upsert(playerStateToRow(newState));
  },

  startAction: (action) => {
    const { playerState } = get();
    if (!playerState) return;
    const now = Math.floor(Date.now() / 1000);
    const result = resolve(
      { state: playerState, action, elapsedSeconds: 0, nowSeconds: now, rngSeed: playerState.rngSeed },
      GAME_DATA
    );
    set({ playerState: result.state });
    void get().commitToServer();
  },

  equipTool: (itemId) => {
    const { playerState } = get();
    if (!playerState) return;

    // Determine tool type from itemId
    const hatchetIds = ["worn_hatchet", "copper_hatchet", "iron_hatchet"];
    const pickaxeIds = ["worn_pickaxe", "copper_pickaxe", "iron_pickaxe"];
    const rodIds = ["copper_fishing_rod", "iron_fishing_rod"];

    let toolSlot: "hatchet" | "pickaxe" | "fishingRod" | null = null;
    if (hatchetIds.includes(itemId)) toolSlot = "hatchet";
    else if (pickaxeIds.includes(itemId)) toolSlot = "pickaxe";
    else if (rodIds.includes(itemId)) toolSlot = "fishingRod";

    if (!toolSlot) return;

    // Find item in inventory
    const invIndex = playerState.inventory.findIndex((s) => s.itemId === itemId);
    if (invIndex === -1) return;

    const newInventory = [...playerState.inventory];
    newInventory.splice(invIndex, 1);

    // Get tool metadata from head tier (simplified: assume tier 0 for now)
    const toolComponent = {
      headId: itemId,
      haftId: null,
      bindingId: null,
      headTier: itemId.includes("copper") ? 1 : itemId.includes("iron") ? 2 : 0,
      haftTier: 1, // Default values for now
      bindingTier: 1,
      wearMastery: 0,
      wearPct: 1000,
    };

    const newEquipment = {
      ...playerState.equipment,
      [toolSlot]: toolComponent,
    };

    const newPlayerState = {
      ...playerState,
      inventory: newInventory,
      equipment: newEquipment,
    };

    set({ playerState: newPlayerState });
    void get().commitToServer();
  },

  tickFrame: () => {
    const { playerState, lastCommitAt } = get();
    if (!playerState || playerState.isDead) return;

    const now = Math.floor(Date.now() / 1000);
    const elapsed = now - playerState.checkpointAt;
    if (elapsed < 1) return;

    const result = resolve(
      {
        state: playerState,
        action: playerState.currentAction as ActionDescriptor,
        elapsedSeconds: elapsed,
        nowSeconds: now,
        rngSeed: playerState.rngSeed,
      },
      GAME_DATA
    );

    // Heartbeat commit every 60s (even if no events fired).
    if (now - lastCommitAt > 60) {
      void get().commitToServer();
    }

    // No events means no action completed yet — don't advance checkpointAt.
    // This lets `elapsed` keep growing until the action time is met.
    if (result.events.length === 0) return;

    // Process events for UI feedback.
    const newToasts: Toast[] = [];
    let shouldShake = false;

    for (const event of result.events) {
      if (event.kind === "level_up") {
        newToasts.push({ id: toastCounter++, message: `${event.skill} level ${event.newLevel}!`, kind: "levelup" });
        shouldShake = true;
      }
      if (event.kind === "death") {
        newToasts.push({ id: toastCounter++, message: event.record.lostItems.length > 0 ? "You died and lost an item." : "You fell, but kept everything.", kind: "death" });
        shouldShake = true;
      }
      if (event.kind === "pet_found") {
        newToasts.push({ id: toastCounter++, message: "A pet has found you!", kind: "discovery" });
      }
      if (event.kind === "blueprint_found") {
        newToasts.push({ id: toastCounter++, message: "Blueprint found!", kind: "discovery" });
      }
      if (event.kind === "glimmer") {
        set({ activeGlimmer: { nodeId: event.nodeId, x: 0, y: 0 }, glimmerWindowOpen: true });
        setTimeout(() => set({ activeGlimmer: null, glimmerWindowOpen: false }), 1200);
      }
    }

    const updates: Partial<GameStore> = { playerState: result.state };

    if (newToasts.length) {
      const existing = get().toasts;
      updates.toasts = [...existing, ...newToasts].slice(-3);
      setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => !newToasts.find((n) => n.id === t.id)) })), 3000);
    }
    if (shouldShake) {
      updates.shaking = true;
      setTimeout(() => set({ shaking: false }), 200);
    }

    set(updates);
  },

  commitToServer: async () => {
    const { playerState, isSyncing } = get();
    if (!playerState || isSyncing) return;

    set({ isSyncing: true, lastCommitAt: Math.floor(Date.now() / 1000) });

    try {
      await supabase
        .from("el_player_state")
        .upsert(playerStateToRow(playerState), { onConflict: "player_id" });
    } catch {
      // Queue for retry — offline mode.
    } finally {
      set({ isSyncing: false });
    }
  },

  tapGlimmer: () => {
    const { playerState, activeGlimmer } = get();
    if (!playerState || !activeGlimmer) return;

    const motesGained = 3 + Math.floor(Math.random() * 3);
    const newState: PlayerState = {
      ...playerState,
      motes: playerState.motes + motesGained,
    };

    set({ playerState: newState, activeGlimmer: null, glimmerWindowOpen: false });
    get().addToast(`+${motesGained} Motes`, "discovery");
  },

  dismissReturnReport: () => {
    set({ returnReport: null, screen: "game" });
  },

  addToast: (msg, kind = "normal") => {
    const toast: Toast = { id: toastCounter++, message: msg, kind };
    set((s) => ({ toasts: [...s.toasts, toast].slice(-3) }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== toast.id) })), 3000);
  },

  spawnXpPopup: (text, x, y) => {
    const popup: XpPopup = { id: popupCounter++, text, x, y };
    set((s) => ({ xpPopups: [...s.xpPopups, popup] }));
    setTimeout(() => set((s) => ({ xpPopups: s.xpPopups.filter((p) => p.id !== popup.id) })), 1300);
  },

  submitLedgerBundle: (bundleId) => {
    const { playerState } = get();
    if (!playerState) return;
    if (playerState.completedBundleIds.includes(bundleId)) return;

    const bundle = LEDGER.bundles.find((b) => b.id === bundleId);
    if (!bundle) return;

    // Verify items are still available.
    const hasAll = bundle.items.every((req) => {
      const inv = playerState.inventory.find((s) => s.itemId === req.itemId)?.qty ?? 0;
      const bank = playerState.bank.find((s) => s.itemId === req.itemId)?.qty ?? 0;
      return inv + bank >= req.qty;
    });
    if (!hasAll) return;

    // Consume items: inventory first, then bank.
    let newInventory = playerState.inventory.map((s) => ({ ...s }));
    let newBank = playerState.bank.map((s) => ({ ...s }));
    for (const req of bundle.items) {
      let rem = req.qty;
      const invIdx = newInventory.findIndex((s) => s.itemId === req.itemId);
      if (invIdx >= 0) {
        const take = Math.min(rem, newInventory[invIdx]!.qty);
        newInventory[invIdx] = { ...newInventory[invIdx]!, qty: newInventory[invIdx]!.qty - take };
        rem -= take;
      }
      if (rem > 0) {
        const bankIdx = newBank.findIndex((s) => s.itemId === req.itemId);
        if (bankIdx >= 0) {
          const take = Math.min(rem, newBank[bankIdx]!.qty);
          newBank[bankIdx] = { ...newBank[bankIdx]!, qty: newBank[bankIdx]!.qty - take };
        }
      }
    }
    newInventory = newInventory.filter((s) => s.qty > 0);
    newBank = newBank.filter((s) => s.qty > 0);

    // Apply reward.
    let newState: PlayerState = {
      ...playerState,
      inventory: newInventory,
      bank: newBank,
      completedBundleIds: [...playerState.completedBundleIds, bundleId],
    };

    const rewardType = bundle.rewardType as string;
    if (rewardType === "unlock_zone") {
      const zoneId = bundle.rewardValue as import("@everloom/engine").ZoneId;
      if (!newState.unlockedZones.includes(zoneId)) {
        newState = { ...newState, unlockedZones: [...newState.unlockedZones, zoneId] };
      }
    } else if (rewardType === "slot_bonus") {
      newState = { ...newState, slots: newState.slots + (bundle.rewardValue as number) };
    }

    set({ playerState: newState });
    get().addToast(`Bundle complete! ${bundle.rewardDescription}`, "levelup");
    void get().commitToServer();
  },
}));

// ── Serialisation helpers ─────────────────────────────────────

function rowToPlayerState(row: Record<string, unknown>): PlayerState {
  return {
    playerId: row["player_id"] as string,
    displayName: (row["display_name"] as string) ?? "Wanderer",
    mode: (row["mode"] as "cozy" | "standard" | "ironbound") ?? "standard",
    rngSeed: BigInt((row["rng_seed"] as string | number) ?? 0),
    checkpointAt: Math.floor(new Date(row["checkpoint_at"] as string).getTime() / 1000),
    currentAction: row["current_action"] as PlayerState["currentAction"],
    parallelActions: (row["parallel_actions"] as PlayerState["parallelActions"]) ?? [],
    skills: (row["skills"] as PlayerState["skills"]) ?? { woodcutting:0,mining:0,fishing:0,crafting:0,smithing:0,fletching:0,cooking:0,combat:0,wayfaring:0,slayer:0 },
    mastery: (row["mastery"] as PlayerState["mastery"]) ?? {},
    inventory: (row["inventory"] as PlayerState["inventory"]) ?? [],
    slots: (row["slots"] as number) ?? 10,
    stackCaps: (row["stack_caps"] as PlayerState["stackCaps"]) ?? {},
    bank: (row["bank"] as PlayerState["bank"]) ?? [],
    larder: (row["larder"] as PlayerState["larder"]) ?? [],
    equipment: (row["equipment"] as PlayerState["equipment"]),
    couriers: (row["couriers"] as PlayerState["couriers"]) ?? [],
    patterns: (row["patterns"] as PlayerState["patterns"]) ?? [],
    motes: (row["motes"] as number) ?? 0,
    rivalXpSnapshot: (row["rival_xp_snapshot"] as PlayerState["rivalXpSnapshot"]) ?? {},
    rivalLastUpdatedAt: (row["rival_last_updated_at"] as number) ?? 0,
    combat: {
      hp: (row["hp"] as number) ?? 10,
      maxHp: (row["max_hp"] as number) ?? 10,
      defenceRating: (row["defence_rating"] as number) ?? 0,
      attackRating: (row["attack_rating"] as number) ?? 1,
      strengthRating: (row["strength_rating"] as number) ?? 1,
    },
    zoneId: (row["zone_id"] as PlayerState["zoneId"]) ?? "meadowrest",
    unlockedZones: (row["unlocked_zones"] as PlayerState["unlockedZones"]) ?? ["meadowrest"],
    travelProgress: (row["travel_progress"] as number) ?? 0,
    collectedItemIds: (row["collected_item_ids"] as PlayerState["collectedItemIds"]) ?? [],
    completedBundleIds: (row["completed_bundle_ids"] as PlayerState["completedBundleIds"]) ?? [],
    completedWeeklyContractIds: (row["completed_weekly_contract_ids"] as PlayerState["completedWeeklyContractIds"]) ?? [],
    foundBlueprintIds: (row["found_blueprint_ids"] as PlayerState["foundBlueprintIds"]) ?? [],
    pets: (row["pets"] as PlayerState["pets"]) ?? [],
    version: (row["version"] as number) ?? 0,
    isDead: (row["is_dead"] as boolean) ?? false,
    appearance: (row["appearance"] as CharacterAppearance | undefined) ?? undefined,
  };
}

function playerStateToRow(ps: PlayerState): Record<string, unknown> {
  return {
    player_id: ps.playerId,
    checkpoint_at: new Date(ps.checkpointAt * 1000).toISOString(),
    current_action: ps.currentAction,
    parallel_actions: ps.parallelActions,
    skills: ps.skills,
    mastery: ps.mastery,
    inventory: ps.inventory,
    slots: ps.slots,
    stack_caps: ps.stackCaps,
    bank: ps.bank,
    larder: ps.larder,
    equipment: ps.equipment,
    couriers: ps.couriers,
    patterns: ps.patterns,
    motes: ps.motes,
    rival_xp_snapshot: ps.rivalXpSnapshot,
    rival_last_updated_at: ps.rivalLastUpdatedAt,
    hp: ps.combat.hp,
    max_hp: ps.combat.maxHp,
    defence_rating: ps.combat.defenceRating,
    attack_rating: ps.combat.attackRating,
    strength_rating: ps.combat.strengthRating,
    zone_id: ps.zoneId,
    unlocked_zones: ps.unlockedZones,
    travel_progress: ps.travelProgress,
    collected_item_ids: ps.collectedItemIds,
    completed_bundle_ids: ps.completedBundleIds,
    completed_weekly_contract_ids: ps.completedWeeklyContractIds,
    found_blueprint_ids: ps.foundBlueprintIds,
    pets: ps.pets,
    version: ps.version,
    is_dead: ps.isDead,
    appearance: ps.appearance ?? null,
  };
}
