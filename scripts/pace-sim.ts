#!/usr/bin/env tsx
/**
 * Pace simulation script — verify that skill progression meets targets.
 *
 * Targets (active play):
 * - Woodcutting 10: ~50-70 min
 * - Any skill 30: 2-3 days of casual idle
 * - Any skill 50: ~2-3 weeks
 * - Any skill 70: ~2 months
 * - 99: a year of devotion
 */

import fs from "fs";
import path from "path";

// Load gamedata
const nodesFile = path.resolve(__dirname, "../packages/gamedata/src/data/nodes.json");
const nodes = JSON.parse(fs.readFileSync(nodesFile, "utf-8"));

// XP table (from engine)
const XP_TABLE = [
  0, 84, 174, 276, 388, 512, 650, 801, 969, 1154, 1358, 1584, 1833, 2107, 2411,
  2749, 3121, 3530, 3978, 4470, 5018, 5624, 6291, 7028, 7842, 8740, 9730, 10824, 12031,
  13358, 14833, 16456, 18247, 20224, 22406, 24815, 27568, 30408, 33648, 37247, 41171,
  45529, 50339, 55649, 61512, 67983, 75127, 83014, 91721, 101333, 111945, 123660, 136594,
  150872, 166636, 184040, 203254, 224466, 247886, 273742, 302288, 333804, 368599, 407015,
  449428, 496254, 548886, 607852, 673087, 745314, 825305, 913171, 1009905, 1115722, 1231894,
  1359752, 1499573, 1652872, 1820746, 2002431, 2199227, 2412392, 2642671, 2890314, 3157887,
  3456571, 3791109, 4171735, 4605591, 5099864, 5660739, 6298316, 7028315, 7862958, 8821612,
  9921857, 11183212, 12632391, 14200533, 15889109, 17821839, 19820455, 22084604, 24571872,
  27305729, 30325124, 33644985, 37199282, 40997622, 45045593, 49368369, 54989691, 60969066,
  67398909, 74359425, 81887546, 90224199, 99505761, 109960855, 121879050, 135589395, 150872696,
];

function levelFromXp(xp: number): number {
  for (let i = XP_TABLE.length - 1; i >= 0; i--) {
    if (xp >= XP_TABLE[i]) return i;
  }
  return 1;
}

function xpAtLevel(level: number): number {
  return level < XP_TABLE.length ? XP_TABLE[level] : XP_TABLE[XP_TABLE.length - 1];
}

interface Node {
  id: string;
  skill: string;
  xpPerAction: number;
  baseActionTimeSec: number;
  hardness: number;
}

interface SimResult {
  skill: string;
  level: number;
  xpRequired: number;
  timeSeconds: number;
  timeFormatted: string;
  successRate: number;
  actionTime: number;
}

function formatTime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours === 0) {
    return `${minutes}m ${secs}s`;
  }
  return `${hours}h ${minutes}m`;
}

function simulatePace(node: Node, targetLevel: number): SimResult {
  const currentLevel = 1;
  const currentXp = 0;
  const targetXp = xpAtLevel(targetLevel);
  const xpNeeded = targetXp - currentXp;

  // Calculate success rate at level 1 with tier-1 tool
  const skillLevel = 1;
  const headTier = 1;
  const masteryLevel = 0;
  const successFP = Math.min(
    Math.max(180 + skillLevel * 11 + headTier * 70 + masteryLevel * 3, 180),
    850
  );
  const successRate = successFP / 1000;

  // Calculate action time (simplified, no haft tier bonus at Lv1)
  const speedBonus = Math.floor(skillLevel * 3); // fixed-point ×1000
  const actionTimeFP = Math.max(
    4000,
    node.baseActionTimeSec * 1000 - speedBonus
  );
  const actionTimeSec = Math.floor(actionTimeFP / 1000);

  // Average XP per action (success chance × xp)
  const xpPerActionAvg = node.xpPerAction * successRate;

  // Actions needed
  const actionsNeeded = Math.ceil(xpNeeded / xpPerActionAvg);

  // Total time
  const totalSeconds = actionsNeeded * actionTimeSec;

  return {
    skill: node.skill,
    level: targetLevel,
    xpRequired: xpNeeded,
    timeSeconds: totalSeconds,
    timeFormatted: formatTime(totalSeconds),
    successRate: parseFloat((successRate * 100).toFixed(1)),
    actionTime: actionTimeSec,
  };
}

// Simulate key milestones
console.log("\n========================================");
console.log("EVERLOOM PACING SIMULATION (Phase P)");
console.log("========================================\n");

// Find nodes to test
const pineNode = nodes.find((n: Node) => n.id === "meadowrest_pine") as Node;
const minnowNode = nodes.find((n: Node) => n.id === "meadowrest_minnow_pool") as Node;
const copperNode = nodes.find((n: Node) => n.id === "meadowrest_copper_vein") as Node;

if (!pineNode || !minnowNode || !copperNode) {
  console.error("Error: could not find test nodes");
  process.exit(1);
}

const milestones = [
  { skill: "woodcutting", level: 10, node: pineNode },
  { skill: "woodcutting", level: 15, node: pineNode },
  { skill: "woodcutting", level: 30, node: pineNode },
  { skill: "mining", level: 30, node: copperNode },
  { skill: "fishing", level: 30, node: minnowNode },
];

console.log("TARGETS (from §6b.3):");
console.log("- Woodcutting 10: ~50-70 min (active play)");
console.log("- Any skill 30: 2-3 days of casual idle");
console.log("- Any skill 50: ~2-3 weeks");
console.log("- Any skill 70: ~2 months");
console.log("- 99: a year of devotion");
console.log("\n");

console.log("SIMULATION RESULTS:");
console.log("─".repeat(90));
console.log(
  "Skill        Level   XP Req    Action Time   Success   Total Time   Status"
);
console.log("─".repeat(90));

for (const m of milestones) {
  const result = simulatePace(m.node, m.level);
  const status =
    m.level === 10 && result.timeSeconds < 70 * 60
      ? "✓ PASS"
      : m.level === 30 && result.timeSeconds < 3 * 24 * 3600
      ? "✓ PASS"
      : m.level === 10
      ? `✗ ${formatTime(result.timeSeconds)} (target 50-70m)`
      : "";

  console.log(
    `${result.skill.padEnd(12)} ${result.level
      .toString()
      .padEnd(5)} ${result.xpRequired
      .toString()
      .padEnd(8)} ${result.actionTime}s            ${result.successRate
      .toString()
      .padEnd(5)}%   ${result.timeFormatted.padEnd(11)} ${status}`
  );
}

console.log("─".repeat(90));

// Detailed calculation for WC 10
console.log("\n");
console.log("WOODCUTTING 10 DETAILED BREAKDOWN:");
console.log("─".repeat(50));
const wc10 = simulatePace(pineNode, 10);
console.log(`Target XP: ${wc10.xpRequired}`);
console.log(`XP per action: ${pineNode.xpPerAction}`);
console.log(`Success rate: ${wc10.successRate}%`);
console.log(`Average XP per action: ${(pineNode.xpPerAction * wc10.successRate / 100).toFixed(2)}`);
console.log(`Action time: ${wc10.actionTime}s`);
console.log(`Actions needed: ${Math.ceil(wc10.xpRequired / (pineNode.xpPerAction * wc10.successRate / 100))}`);
console.log(`Total time: ${wc10.timeFormatted}`);
console.log("─".repeat(50));

// Summary
console.log("\n");
console.log("SUMMARY:");
if (wc10.timeSeconds < 70 * 60) {
  console.log(`✓ Woodcutting 10 PASS: ${wc10.timeFormatted} (target 50-70m)`);
} else {
  console.log(`✗ Woodcutting 10 FAIL: ${wc10.timeFormatted} (target 50-70m)`);
}

console.log("\nNote: This simulation assumes:");
console.log("  - Tier-1 worn hatchet / pickaxe / rod");
console.log("  - No mastery level bonuses (early game)");
console.log("  - No zone richness bonus");
console.log("  - Active play (per-action simulation, not offline optimized)");
console.log("");
