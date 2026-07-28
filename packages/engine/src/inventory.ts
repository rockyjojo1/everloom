// Inventory management — slots, stacks, larder, couriers.
// All quantities are integers.

import type {
  Courier,
  CourierState,
  GameEvent,
  ItemStack,
  LarderEntry,
  StackCapMap,
} from "./types.js";

// ── Inventory helpers ─────────────────────────────────────────

export function findStack(inventory: readonly ItemStack[], itemId: string): ItemStack | undefined {
  return inventory.find((s) => s.itemId === itemId);
}

export function addToInventory(
  inventory: readonly ItemStack[],
  itemId: string,
  qty: number,
  slots: number,
  stackCaps: StackCapMap,
  materialClass: string
): { inventory: ItemStack[]; added: number; overflow: number } {
  const cap = stackCaps[materialClass] ?? 1;
  const mutable = inventory.map((s) => ({ ...s })) as Array<{ itemId: string; qty: number }>;
  const existing = mutable.find((s) => s.itemId === itemId);

  let added = 0;

  if (existing) {
    const canAdd = Math.max(0, cap - existing.qty);
    const toAdd = Math.min(qty, canAdd);
    existing.qty += toAdd;
    added = toAdd;
  } else if (mutable.length < slots) {
    const toAdd = Math.min(qty, cap);
    mutable.push({ itemId, qty: toAdd });
    added = toAdd;
  }

  return { inventory: mutable, added, overflow: qty - added };
}

export function removeFromInventory(
  inventory: readonly ItemStack[],
  itemId: string,
  qty: number
): { inventory: ItemStack[]; removed: number } {
  const mutable = inventory.map((s) => ({ ...s })) as Array<{ itemId: string; qty: number }>;
  const existing = mutable.find((s) => s.itemId === itemId);
  if (!existing) return { inventory: mutable, removed: 0 };
  const toRemove = Math.min(qty, existing.qty);
  existing.qty -= toRemove;
  const filtered = mutable.filter((s) => s.qty > 0);
  return { inventory: filtered, removed: toRemove };
}

export function countInInventory(inventory: readonly ItemStack[], itemId: string): number {
  return findStack(inventory, itemId)?.qty ?? 0;
}

export function isInventoryFull(inventory: readonly ItemStack[], slots: number): boolean {
  return inventory.length >= slots && inventory.every((s) => s.qty > 0);
}

// ── Bank helpers ──────────────────────────────────────────────

export function addToBank(
  bank: readonly ItemStack[],
  items: readonly ItemStack[]
): ItemStack[] {
  const mutable = bank.map((s) => ({ ...s })) as Array<{ itemId: string; qty: number }>;
  for (const item of items) {
    const existing = mutable.find((s) => s.itemId === item.itemId);
    if (existing) {
      existing.qty += item.qty;
    } else {
      mutable.push({ itemId: item.itemId, qty: item.qty });
    }
  }
  return mutable;
}

// ── Larder helpers ────────────────────────────────────────────

export function addToLarder(
  larder: readonly LarderEntry[],
  itemId: string,
  qty: number,
  freshnessAt: number, // unix ts (seconds)
  larderCap: number
): { larder: LarderEntry[]; added: number } {
  const mutable = larder.map((e) => ({ ...e })) as Array<{
    itemId: string;
    qty: number;
    freshnessAt: number;
  }>;

  const totalQty = mutable.reduce((a, e) => a + e.qty, 0);
  const canAdd = Math.max(0, larderCap - totalQty);
  const toAdd = Math.min(qty, canAdd);
  if (toAdd <= 0) return { larder: mutable, added: 0 };

  const existing = mutable.find((e) => e.itemId === itemId);
  if (existing) {
    existing.qty += toAdd;
    // Refresh freshness to the later of current or new.
    existing.freshnessAt = Math.max(existing.freshnessAt, freshnessAt);
  } else {
    mutable.push({ itemId, qty: toAdd, freshnessAt });
  }

  return { larder: mutable, added: toAdd };
}

// Returns total heal value available in larder (integer HP).
export function larderTotalHeal(
  larder: readonly LarderEntry[],
  healMap: Readonly<Record<string, number>>, // itemId -> heal amount
  nowSeconds: number
): number {
  let total = 0;
  for (const entry of larder) {
    const isFresh = entry.freshnessAt > nowSeconds;
    const heal = healMap[entry.itemId] ?? 0;
    // Stale food heals at 50%.
    const effectiveHeal = isFresh ? heal : Math.floor(heal / 2);
    total += effectiveHeal * entry.qty;
  }
  return total;
}

export function consumeFromLarder(
  larder: readonly LarderEntry[],
  qty: number
): { larder: LarderEntry[]; consumed: Array<{ itemId: string; qty: number; heal: number }>; } {
  const mutable = larder.map((e) => ({ ...e })) as Array<{
    itemId: string;
    qty: number;
    freshnessAt: number;
  }>;
  const consumed: Array<{ itemId: string; qty: number; heal: number }> = [];
  let remaining = qty;

  for (const entry of mutable) {
    if (remaining <= 0) break;
    const take = Math.min(remaining, entry.qty);
    entry.qty -= take;
    remaining -= take;
    consumed.push({ itemId: entry.itemId, qty: take, heal: 0 }); // heal filled by caller
  }

  return { larder: mutable.filter((e) => e.qty > 0), consumed };
}

// ── Courier helpers ────────────────────────────────────────────

export const COURIER_NAMES = ["Wren", "Pip", "Old Moss", "Brindle", "Tuck"] as const;

export const COURIER_PERSONALITIES: Readonly<Record<string, string>> = {
  Wren: "always leaves a pebble on top of the satchel",
  Pip: "hums while running, badly",
  "Old Moss": "moves slowly but never loses a single item",
  Brindle: "adds a pressed flower to every delivery",
  Tuck: "arrives slightly out of breath, every time",
};

export function resolveCouriers(
  couriers: readonly Courier[],
  elapsedSeconds: number,
  inventory: readonly ItemStack[],
  bank: readonly ItemStack[],
  slots: number
): {
  couriers: Courier[];
  bank: ItemStack[];
  inventory: ItemStack[];
  events: GameEvent[];
} {
  const events: GameEvent[] = [];
  let currentBank = bank as ItemStack[];
  let currentInventory = inventory as ItemStack[];
  const updatedCouriers: Courier[] = [];

  for (const courier of couriers) {
    let remaining = elapsedSeconds;
    let state = courier.state as CourierState;
    let eta = courier.etaSeconds;
    let trips = courier.tripsCompleted;

    while (remaining > 0 && state !== "idle") {
      if (remaining >= eta) {
        remaining -= eta;

        if (state === "outbound") {
          // Bank the inventory.
          currentBank = addToBank(currentBank, currentInventory);
          currentInventory = [];
          events.push({
            kind: "courier_dispatched",
            courierId: courier.id,
            couriername: courier.name,
            atSeconds: elapsedSeconds - remaining,
          });
          state = "returning";
          eta = 30; // 30s to return
        } else if (state === "returning") {
          events.push({
            kind: "courier_returned",
            courierId: courier.id,
            couriername: courier.name,
            atSeconds: elapsedSeconds - remaining,
          });
          trips++;
          state = "idle";
          eta = 0;
        }
      } else {
        eta -= remaining;
        remaining = 0;
      }
    }

    updatedCouriers.push({
      ...courier,
      state,
      etaSeconds: eta,
      tripsCompleted: trips,
    });
  }

  return { couriers: updatedCouriers, bank: currentBank, inventory: currentInventory, events };
}

// Dispatch idle couriers when satchel is full.
export function dispatchCouriers(couriers: readonly Courier[]): Courier[] {
  return couriers.map((c) =>
    c.state === "idle"
      ? { ...c, state: "outbound" as CourierState, etaSeconds: 60 }
      : c
  );
}

// Larder capacity: 20 at level 1, scales to ~3000 at level 99.
export function larderCapacity(cookingLevel: number): number {
  return 20 + Math.floor(cookingLevel * cookingLevel * 0.3);
}
