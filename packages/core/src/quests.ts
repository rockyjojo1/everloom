import type { ContentBundle, GameEvent, GameSave, QuestProgress, QuestStepDefinition } from "./types";

function eventMatchesStep(event: GameEvent, step: QuestStepDefinition): boolean {
  switch (step.kind) {
    case "talk":
    case "interact":
      return event.type === "world_interacted" && event.targetId === step.targetId;
    case "pickup":
      return event.type === "item_gained" && event.itemId === step.itemId && event.sourceId === step.targetId;
    case "equip":
      return event.type === "item_equipped" && event.itemId === step.itemId;
    case "gather":
      return event.type === "item_gained" && event.itemId === step.itemId;
    case "cook":
      return event.type === "item_gained" && event.itemId === step.itemId;
    case "defeat":
      return event.type === "enemy_defeated" && event.enemyId === step.targetId;
    default:
      return false;
  }
}

export function applyQuestEvents(
  state: GameSave,
  sourceEvents: readonly GameEvent[],
  content: ContentBundle,
): { readonly state: GameSave; readonly questEvents: readonly GameEvent[] } {
  let quests: Readonly<Record<string, QuestProgress>> = { ...state.quests };
  const questEvents: GameEvent[] = [];

  for (const event of sourceEvents) {
    for (const [questId, progress] of Object.entries(quests)) {
      if (progress.status !== "active") continue;
      const definition = content.quests[questId];
      const step = definition?.steps[progress.stepIndex];
      if (!definition || !step || !eventMatchesStep(event, step)) continue;

      const eventQuantity = event.type === "item_gained" ? event.quantity : 1;
      const nextProgress = progress.stepProgress + eventQuantity;
      if (nextProgress < step.count) {
        quests = { ...quests, [questId]: { ...progress, stepProgress: nextProgress } };
        continue;
      }

      const nextStepIndex = progress.stepIndex + 1;
      if (nextStepIndex >= definition.steps.length) {
        quests = {
          ...quests,
          [questId]: { status: "completed", stepIndex: nextStepIndex, stepProgress: 0 },
        };
        questEvents.push({ type: "quest_completed", questId });
      } else {
        quests = {
          ...quests,
          [questId]: { status: "active", stepIndex: nextStepIndex, stepProgress: 0 },
        };
        questEvents.push({ type: "quest_advanced", questId, stepIndex: nextStepIndex });
      }
    }
  }

  return { state: { ...state, quests }, questEvents };
}

export function currentObjective(state: GameSave, content: ContentBundle): string | null {
  for (const [questId, progress] of Object.entries(state.quests)) {
    if (progress.status !== "active") continue;
    return content.quests[questId]?.steps[progress.stepIndex]?.objective ?? null;
  }
  return null;
}
