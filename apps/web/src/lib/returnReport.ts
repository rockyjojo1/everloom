import type { GameEvent, SkillId } from "@everloom/engine";
import { NODES, ITEMS, ENEMIES } from "@everloom/gamedata";

export interface ReportLine {
  timeLabel: string; // "Hour 3", "Min 45"
  text: string;
  kind: "normal" | "death" | "levelup" | "discovery";
}

export interface ReturnReportData {
  absenceSeconds: number;
  absenceLabel: string;
  lines: ReportLine[];
  summary: {
    xpBySkill: Partial<Record<SkillId, number>>;
    itemsGained: Array<{ itemId: string; qty: number }>;
    deaths: number;
    levelUps: number;
    glimmersTotal: number;
  };
}

const nodeNames: Record<string, string> = Object.fromEntries(
  NODES.map((n) => [n.id, n.name])
);
const itemNames: Record<string, string> = Object.fromEntries(
  ITEMS.map((i) => [i.id, i.name])
);
const enemyNames: Record<string, string> = Object.fromEntries(
  ENEMIES.map((e) => [e.id, e.name])
);

const SKILL_NAMES: Record<SkillId, string> = {
  woodcutting: "Woodcutting",
  mining: "Mining",
  fishing: "Fishing",
  crafting: "Crafting",
  smithing: "Smithing",
  fletching: "Fletching",
  cooking: "Cooking",
  combat: "Combat",
  wayfaring: "Wayfaring",
  slayer: "Slayer",
};

function fmtTime(seconds: number): string {
  if (seconds < 3600) return `Min ${Math.floor(seconds / 60)}`;
  return `Hour ${Math.floor(seconds / 3600)}`;
}

// Courier flavour lines — makes them feel like characters.
const COURIER_LINES: Record<string, string[]> = {
  Wren: [
    "Wren packed the satchel tight and left a pebble on top, as always.",
    "Wren headed for the bank at a steady trot.",
    "Wren returned, slightly muddy, with a fresh pebble in their pocket.",
  ],
  Pip: [
    "Pip sprinted off humming something off-key.",
    "Pip came back out of breath, grinning. Everything accounted for.",
    "Pip left at a run, the satchel already bouncing on their back.",
  ],
  "Old Moss": [
    "Old Moss shouldered the satchel without a word and walked.",
    "Old Moss returned at the same unhurried pace. Not a single item missing.",
    "Old Moss set off. You had time to take three deep breaths before they disappeared from view.",
  ],
};

function courierLine(name: string, isDispatch: boolean): string {
  const lines = COURIER_LINES[name] ?? [
    isDispatch ? `${name} left with the satchel.` : `${name} returned.`,
  ];
  return isDispatch ? (lines[0] ?? "") : (lines[2] ?? "");
}

// Group events into meaningful narrative beats.
export function buildReturnReport(
  events: readonly GameEvent[],
  absenceSeconds: number
): ReturnReportData {
  const lines: ReportLine[] = [];
  const xpBySkill: Partial<Record<SkillId, number>> = {};
  const itemsGained: Map<string, number> = new Map();
  let deaths = 0;
  let levelUps = 0;
  let glimmersTotal = 0;

  // Track what we've narrated to avoid repetition.
  let lastNarratedHour = -1;
  let lastSkill: SkillId | null = null;
  let consecutiveXp = 0;

  for (const event of events) {
    // The `death` event carries its timestamp on the nested record.
    const at = event.kind === "death" ? event.record.atSeconds : event.atSeconds;

    switch (event.kind) {
      case "xp_gain":
        if (lastSkill === event.skill) {
          consecutiveXp += event.amount;
        } else {
          lastSkill = event.skill;
          consecutiveXp = event.amount;
        }
        xpBySkill[event.skill] = (xpBySkill[event.skill] ?? 0) + event.amount;
        break;

      case "level_up":
        levelUps++;
        lines.push({
          timeLabel: fmtTime(at),
          text: `Your ${SKILL_NAMES[event.skill]} reached level ${event.newLevel}. Something shifted.`,
          kind: "levelup",
        });
        break;

      case "mastery_level_up":
        if (event.newLevel === 50 || event.newLevel === 99) {
          lines.push({
            timeLabel: fmtTime(at),
            text: `Mastery ${event.newLevel} at ${nodeNames[event.nodeId] ?? event.nodeId}. The motion has become part of you.`,
            kind: "levelup",
          });
        }
        break;

      case "item_gained":
        itemsGained.set(event.itemId, (itemsGained.get(event.itemId) ?? 0) + event.qty);
        break;

      case "satchel_full": {
        const hr = Math.floor(at / 3600);
        if (hr !== lastNarratedHour) {
          lastNarratedHour = hr;
          lines.push({
            timeLabel: fmtTime(at),
            text: "The satchel could hold no more.",
            kind: "normal",
          });
        }
        break;
      }

      case "courier_dispatched":
        lines.push({
          timeLabel: fmtTime(at),
          text: courierLine(event.couriername, true),
          kind: "normal",
        });
        break;

      case "courier_returned":
        lines.push({
          timeLabel: fmtTime(at),
          text: courierLine(event.couriername, false),
          kind: "normal",
        });
        break;

      case "enemy_attacked": {
        const hr = Math.floor(at / 3600);
        if (hr !== lastNarratedHour) {
          lastNarratedHour = hr;
          const eName = enemyNames[event.enemyId] ?? event.enemyId;
          lines.push({
            timeLabel: fmtTime(at),
            text: `A ${eName} found you. ${event.damage} damage. You kept working.`,
            kind: "normal",
          });
        }
        break;
      }

      case "food_consumed": {
        const hr = Math.floor(at / 3600);
        if (hr !== lastNarratedHour) {
          lastNarratedHour = hr;
          const fName = itemNames[event.itemId] ?? event.itemId;
          lines.push({
            timeLabel: fmtTime(at),
            text: `You ate ${fName} from the Larder. Kept going.`,
            kind: "normal",
          });
        }
        break;
      }

      case "death":
        deaths++;
        lines.push({
          timeLabel: fmtTime(event.record.atSeconds),
          text: event.record.lostItems.length > 0
            ? `You fell. Lost: ${event.record.lostItems.map((i) => itemNames[i.itemId] ?? i.itemId).join(", ")}.`
            : "You fell. Nothing lost. You got back up.",
          kind: "death",
        });
        break;

      case "zone_unlocked":
        lines.push({
          timeLabel: fmtTime(at),
          text: `A new region stitched itself into the tapestry: ${event.zoneId.replace(/_/g, " ")}.`,
          kind: "discovery",
        });
        break;

      case "pet_found":
        lines.push({
          timeLabel: fmtTime(at),
          text: `Something small and curious settled on your shoulder. A companion.`,
          kind: "discovery",
        });
        break;

      case "blueprint_found":
        lines.push({
          timeLabel: fmtTime(at),
          text: `A blueprint fell loose from a crack in the stone. ${itemNames[event.itemId] ?? event.itemId}.`,
          kind: "discovery",
        });
        break;

      case "glimmer":
        glimmersTotal++;
        break;

      case "tool_degraded":
        lines.push({
          timeLabel: fmtTime(at),
          text: `Your ${event.toolSlot} binding frayed. You kept working, slower.`,
          kind: "normal",
        });
        break;

      default:
        break;
    }
  }

  // Sort by time.
  lines.sort((a, b) => {
    const aS = a.timeLabel.startsWith("Hour")
      ? parseInt(a.timeLabel.replace("Hour ", "")) * 3600
      : parseInt(a.timeLabel.replace("Min ", "")) * 60;
    const bS = b.timeLabel.startsWith("Hour")
      ? parseInt(b.timeLabel.replace("Hour ", "")) * 3600
      : parseInt(b.timeLabel.replace("Min ", "")) * 60;
    return aS - bS;
  });

  // If nothing interesting happened, add a flavour line.
  if (lines.length === 0 && absenceSeconds > 60) {
    lines.push({
      timeLabel: fmtTime(absenceSeconds / 2),
      text: "The work was quiet. Nothing interrupted you.",
      kind: "normal",
    });
  }

  const absenceLabel = absenceSeconds < 3600
    ? `${Math.floor(absenceSeconds / 60)} minutes`
    : `${Math.floor(absenceSeconds / 3600)} hour${Math.floor(absenceSeconds / 3600) === 1 ? "" : "s"}`;

  return {
    absenceSeconds,
    absenceLabel,
    lines,
    summary: {
      xpBySkill,
      itemsGained: [...itemsGained.entries()].map(([itemId, qty]) => ({ itemId, qty })),
      deaths,
      levelUps,
      glimmersTotal,
    },
  };
}
