import { CONTENT } from "@everloom/content";
import type { ZoneInteractable } from "@everloom/core";

// Pure default-verb resolution for the context menu / default tap action —
// see section 10/11 of the OSRS-feel direction (Ground -> Walk here,
// Tree -> Chop, Rock -> Mine, Fishing spot -> Fish, Ground item -> Take,
// NPC -> Talk-to, Storage/Facility -> Use, Enemy -> Attack). Kept free of
// Three.js/DOM so the verb text is unit-testable on its own.
export function defaultVerbFor(target: ZoneInteractable): string {
  if (target.kind === "ground_item") return `Take ${target.displayName}`;
  if (target.kind === "npc") return `Talk-to ${target.displayName}`;
  if (target.kind === "enemy") return `Attack ${target.displayName}`;
  if (target.kind === "facility") return `Use ${target.displayName}`;
  if (target.kind === "resource") {
    const skill = target.resourceId ? CONTENT.resources[target.resourceId]?.skill : undefined;
    const verb = skill === "fishing" ? "Fish" : skill === "mining" ? "Mine" : "Chop down";
    return `${verb} ${target.displayName}`;
  }
  return `Interact with ${target.displayName}`;
}
