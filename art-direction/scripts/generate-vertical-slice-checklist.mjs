#!/usr/bin/env node

import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const manifestPath = resolve(__dirname, "..", "visual-production-manifest.json");
const outputPath = resolve(__dirname, "..", "meadowrest-vertical-slice-assets.md");

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (e) {
  console.error(`Failed to read manifest: ${e.message}`);
  process.exit(1);
}

// Filter vertical-slice entries and sort by category
const verticalSliceEntries = manifest.entries.filter((e) => e.productionPriority === "vertical-slice");

const categories = [
  "character",
  "equipment",
  "architecture",
  "prop",
  "terrain",
  "material",
  "vegetation",
  "resource",
  "animation",
  "vfx",
  "interface",
  "landmark"
];

const grouped = {};
categories.forEach((cat) => {
  grouped[cat] = verticalSliceEntries.filter((e) => e.category === cat);
});

// Generate markdown
let md = `# Meadowrest Vertical-Slice Assets

**Generated:** ${new Date().toISOString()}

## Overview

This checklist tracks the production status of all vertical-slice assets. Each asset must be implemented and integrated before the slice is considered feature-complete.

⚠️ **Placeholder, procedural or merely licensed assets do not become approved because they are present in the game.** Each asset must receive:

1. A dedicated reference sheet (pending review)
2. Visual approval from design review
3. Production implementation
4. Integration testing
5. Acceptance criteria verification

---

`;

// Generate sections for each category
Object.entries(grouped).forEach(([category, entries]) => {
  if (entries.length === 0) return;

  const categoryName = category.charAt(0).toUpperCase() + category.slice(1).replace("-", " ");
  md += `## ${categoryName}\n\n`;
  md += `| Manifest ID | Current Asset | Status | Reference | States | Rig | Criteria | Implementation |\n`;
  md += `|---|---|---|---|---|---|---|---|\n`;

  entries.forEach((entry) => {
    const refStatus = entry.status === "reference-approved" ? "✅ Approved" : "⏳ Pending";
    const implStatus = entry.status === "integrated" ? "✅ Integrated" : "⏳ In Progress";
    const criteria = entry.acceptanceCriteria ? entry.acceptanceCriteria.length : 0;
    const statesStr = entry.requiredStates.join(", ") || "—";
    const rigStr = entry.rigRequirement || "none";

    md += `| \`${entry.id}\` | ${entry.currentAssetId || "—"} | ${entry.currentStatus} | ${refStatus} | ${statesStr} | ${rigStr} | ${criteria} | ${implStatus} |\n`;
  });

  md += "\n";
});

// Add acceptance criteria details
md += `## Acceptance Criteria\n\n`;
md += `Each asset must satisfy its documented acceptance criteria before integration:\n\n`;

Object.entries(grouped).forEach(([category, entries]) => {
  if (entries.length === 0) return;

  entries.forEach((entry) => {
    if (entry.acceptanceCriteria && entry.acceptanceCriteria.length > 0) {
      md += `### ${entry.displayName} (\`${entry.id}\`)\n\n`;
      entry.acceptanceCriteria.forEach((criterion) => {
        md += `- [ ] ${criterion}\n`;
      });
      md += "\n";
    }
  });
});

md += `## Summary\n\n`;
md += `- **Total vertical-slice entries:** ${verticalSliceEntries.length}\n`;

const byCat = {};
verticalSliceEntries.forEach((e) => {
  byCat[e.category] = (byCat[e.category] || 0) + 1;
});
md += `- **By category:** ${Object.entries(byCat)
  .map(([c, n]) => `${c} (${n})`)
  .join(", ")}\n`;

const byStatus = {};
verticalSliceEntries.forEach((e) => {
  byStatus[e.currentStatus] = (byStatus[e.currentStatus] || 0) + 1;
});
md += `- **By current status:** ${Object.entries(byStatus)
  .map(([s, n]) => `${s} (${n})`)
  .join(", ")}\n`;

md += "\n";
md += `This checklist was generated from \`visual-production-manifest.json\`.\n`;
md += `If the manifest changes, regenerate this file with:\n`;
md += `\`\`\`bash\nnode art-direction/scripts/generate-vertical-slice-checklist.mjs\n\`\`\`\n`;

// Write file
try {
  writeFileSync(outputPath, md);
  console.log(`✅ Generated: ${outputPath}`);
  console.log(`   ${verticalSliceEntries.length} vertical-slice assets documented.`);
} catch (e) {
  console.error(`Failed to write checklist: ${e.message}`);
  process.exit(1);
}
