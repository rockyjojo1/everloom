import type {
  ActionResult,
  ContentBundle,
  EquipmentSlot,
  GameEvent,
  GameSave,
  InventoryStack,
} from "./types";
import { applyQuestEvents } from "./quests";

export function itemQuantity(inventory: readonly InventoryStack[], itemId: string): number {
  return inventory.reduce((total, stack) => total + (stack.itemId === itemId ? stack.quantity : 0), 0);
}

export function canAddItem(
  inventory: readonly InventoryStack[],
  slots: number,
  itemId: string,
  quantity: number,
  content: ContentBundle,
): boolean {
  const item = content.items[itemId];
  if (!item || quantity < 0) return false;
  if (quantity === 0) return true;

  const existingCapacity = inventory.reduce((capacity, stack) => {
    if (stack.itemId !== itemId) return capacity;
    return capacity + Math.max(0, item.maxStack - stack.quantity);
  }, 0);
  const freeSlots = Math.max(0, slots - inventory.length);
  return existingCapacity + freeSlots * item.maxStack >= quantity;
}

export function addItem(
  inventory: readonly InventoryStack[],
  slots: number,
  itemId: string,
  quantity: number,
  content: ContentBundle,
): readonly InventoryStack[] | null {
  const item = content.items[itemId];
  if (!item || !canAddItem(inventory, slots, itemId, quantity, content)) return null;
  const next = inventory.map((stack) => ({ ...stack }));
  let remaining = quantity;

  for (let index = 0; index < next.length && remaining > 0; index += 1) {
    const stack = next[index];
    if (!stack || stack.itemId !== itemId || stack.quantity >= item.maxStack) continue;
    const added = Math.min(remaining, item.maxStack - stack.quantity);
    next[index] = { ...stack, quantity: stack.quantity + added };
    remaining -= added;
  }

  while (remaining > 0) {
    const added = Math.min(remaining, item.maxStack);
    next.push({ itemId, quantity: added });
    remaining -= added;
  }

  return next;
}

export function removeItem(
  inventory: readonly InventoryStack[],
  itemId: string,
  quantity: number,
): readonly InventoryStack[] | null {
  if (quantity < 0 || itemQuantity(inventory, itemId) < quantity) return null;
  const next = inventory.map((stack) => ({ ...stack }));
  let remaining = quantity;

  for (let index = 0; index < next.length && remaining > 0; index += 1) {
    const stack = next[index];
    if (!stack || stack.itemId !== itemId) continue;
    const removed = Math.min(remaining, stack.quantity);
    next[index] = { ...stack, quantity: stack.quantity - removed };
    remaining -= removed;
  }

  return next.filter((stack) => stack.quantity > 0);
}

export function hasItems(inventory: readonly InventoryStack[], requirements: readonly InventoryStack[]): boolean {
  return requirements.every((requirement) => itemQuantity(inventory, requirement.itemId) >= requirement.quantity);
}

export function equipItem(state: GameSave, itemId: string, content: ContentBundle): ActionResult {
  const item = content.items[itemId];
  if (!item?.equipmentSlot || itemQuantity(state.inventory, itemId) < 1) {
    return { state, events: [], ok: false, reason: "activity_invalid" };
  }

  const slot: EquipmentSlot = item.equipmentSlot;
  const previous = state.equipment[slot];
  let inventory = removeItem(state.inventory, itemId, 1);
  if (!inventory) return { state, events: [], ok: false, reason: "activity_invalid" };

  if (previous) {
    const returned = addItem(inventory, state.inventorySlots, previous, 1, content);
    if (!returned) return { state, events: [], ok: false, reason: "inventory_full" };
    inventory = returned;
  }

  const nextState: GameSave = {
    ...state,
    inventory,
    equipment: { ...state.equipment, [slot]: itemId },
  };
  const event: GameEvent = { type: "item_equipped", itemId, slot };
  const applied = applyQuestEvents(nextState, [event], content);
  return {
    state: applied.state,
    events: [event, ...applied.questEvents],
    ok: true,
    reason: "none",
  };
}
