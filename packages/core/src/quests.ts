import { countAttunedSkills } from "./progression";
import type { ContentBundle, GameEvent, GameSave, QuestDefinition, QuestProgress, QuestStepDefinition } from "./types";

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
    case "attune":
      // Re-evaluated (not accumulated) any time a skill actually levels up.
      return event.type === "level_gained";
    default:
      return false;
  }
}

/**
 * Most steps accumulate one unit per matching event (or an item's quantity).
 * The "attune" step is different: its progress is always the CURRENT number of
 * skills at or above the attunement level, recomputed from live skill state
 * rather than incremented, so it can never drift from the truth and works
 * identically whether it advances live or is recomputed during a save migration.
 */
function stepProgressFor(state: GameSave, step: QuestStepDefinition, previousProgress: number, event: GameEvent): number {
  if (step.kind === "attune") return countAttunedSkills(state.skills);
  const eventQuantity = event.type === "item_gained" ? event.quantity : 1;
  return previousProgress + eventQuantity;
}

function completeQuestState(
  state: GameSave,
  questId: string,
  definition: QuestDefinition,
  quests: Readonly<Record<string, QuestProgress>>,
): { readonly state: GameSave; readonly quests: Readonly<Record<string, QuestProgress>>; readonly events: readonly GameEvent[] } {
  const events: GameEvent[] = [{ type: "quest_completed", questId }];
  let nextQuests: Readonly<Record<string, QuestProgress>> = {
    ...quests,
    [questId]: { status: "completed", stepIndex: definition.steps.length, stepProgress: 0 },
  };
  let nextState = state;
  if (definition.completionFlag) {
    nextState = { ...nextState, worldFlags: { ...nextState.worldFlags, [definition.completionFlag]: true } };
  }
  if (definition.nextQuestId && !nextQuests[definition.nextQuestId]) {
    nextQuests = { ...nextQuests, [definition.nextQuestId]: { status: "active", stepIndex: 0, stepProgress: 0 } };
  }
  return { state: nextState, quests: nextQuests, events };
}

export function applyQuestEvents(
  state: GameSave,
  sourceEvents: readonly GameEvent[],
  content: ContentBundle,
): { readonly state: GameSave; readonly questEvents: readonly GameEvent[] } {
  let workingState = state;
  let quests: Readonly<Record<string, QuestProgress>> = { ...state.quests };
  const questEvents: GameEvent[] = [];

  for (const event of sourceEvents) {
    for (const [questId, progress] of Object.entries(quests)) {
      if (progress.status !== "active") continue;
      const definition = content.quests[questId];
      const step = definition?.steps[progress.stepIndex];
      if (!definition || !step || !eventMatchesStep(event, step)) continue;

      const nextProgress = stepProgressFor(workingState, step, progress.stepProgress, event);
      if (nextProgress < step.count) {
        quests = { ...quests, [questId]: { ...progress, stepProgress: nextProgress } };
        continue;
      }

      const nextStepIndex = progress.stepIndex + 1;
      if (nextStepIndex >= definition.steps.length) {
        const completed = completeQuestState(workingState, questId, definition, quests);
        workingState = completed.state;
        quests = completed.quests;
        questEvents.push(...completed.events);
      } else {
        quests = {
          ...quests,
          [questId]: { status: "active", stepIndex: nextStepIndex, stepProgress: 0 },
        };
        questEvents.push({ type: "quest_advanced", questId, stepIndex: nextStepIndex });
      }
    }
  }

  return { state: { ...workingState, quests }, questEvents };
}

/**
 * Deterministically force a still-active quest straight to its completed state,
 * running the exact same completion/chaining/flag logic as normal play. Used by
 * debug tooling and tests to skip time-consuming grinds without duplicating or
 * diverging from the real completion rules in applyQuestEvents.
 */
export function forceCompleteQuest(state: GameSave, questId: string, content: ContentBundle): GameSave {
  const definition = content.quests[questId];
  if (!definition) throw new Error(`Unknown quest: ${questId}`);
  const progress = state.quests[questId];
  if (progress?.status === "completed") return state;
  const completed = completeQuestState(state, questId, definition, state.quests);
  return { ...completed.state, quests: completed.quests };
}

export function currentObjective(state: GameSave, content: ContentBundle): string | null {
  for (const [questId, progress] of Object.entries(state.quests)) {
    if (progress.status !== "active") continue;
    return content.quests[questId]?.steps[progress.stepIndex]?.objective ?? null;
  }
  return null;
}
