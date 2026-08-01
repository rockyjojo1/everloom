import { CONTENT } from "@everloom/content";
import { currentObjectiveStep, type GameSave, type ZoneInteractable } from "@everloom/core";

export const OBJECTIVE_ROUTE_EVENT = "everloom:objective-route";

export interface ObjectiveRouteDetail {
  readonly targetId: string;
}

/** Resolves quest semantics to the physical object used by world guidance. */
export function objectiveGuidanceTarget(save: GameSave | null): ZoneInteractable | null {
  if (!save) return null;
  const step = currentObjectiveStep(save, CONTENT);
  const targetId = step?.guidanceTargetId ?? step?.targetId;
  if (!targetId) return null;
  return CONTENT.zones[save.currentZone]?.interactables.find((target) => target.id === targetId) ?? null;
}

export function requestObjectiveRoute(targetId: string): void {
  window.dispatchEvent(new CustomEvent<ObjectiveRouteDetail>(OBJECTIVE_ROUTE_EVENT, {
    detail: { targetId },
  }));
}
