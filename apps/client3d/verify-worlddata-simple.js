/**
 * Simple verification script - parses worlddata.ts directly
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('=== WORLDDATA VERIFICATION ===\n');

// Read the source file
const worlddataPath = path.join(__dirname, 'src', 'world', 'worlddata.ts');
const content = fs.readFileSync(worlddataPath, 'utf-8');

// Count PAINT entries - look for patterns in the PAINT array
const paintMatches = content.match(/PAINT\.push\(\{/g) || [];
const paintInitMatch = content.match(/const PAINT: Paint\[\] = \[\]/);
const paintEntries = paintInitMatch ? content.match(/{\s*shape:\s*['"](?:rect|circle|path)['"]/g)?.length || 0 : 0;

// More accurate: count lines in PAINT array definition
const paintSection = content.match(/export const PAINT: Paint\[\] = \[([\s\S]*?)\];/);
const paintCount = paintSection ? (paintSection[1].match(/shape:/g) || []).length : 0;

// Count PROPS entries
const propsSection = content.match(/export const PROPS: PropPlacement\[\] = \[\];([\s\S]*?)(?=export const INTERACTABLES|export type InteractKind)/);
let propsCount = 0;
if (propsSection) {
  // Count model: assignments
  propsCount = (propsSection[1].match(/model:\s*['"]/g) || []).length;
}

// Count INTERACTABLES entries
const interactablesSection = content.match(/export const INTERACTABLES: Interactable\[\] = \[\];([\s\S]*?)(?=export const SPAWN)/);
let interactablesCount = 0;
if (interactablesSection) {
  // Count id: assignments in INTERACTABLES.push
  interactablesCount = (interactablesSection[1].match(/id:\s*['"`]/g) || []).length;
}

console.log(`PAINT count: ${paintCount} (required: ≥10)`);
console.log(`PROPS count: ${propsCount} (required: ≥90)`);
console.log(`INTERACTABLES count: ${interactablesCount} (required: ≥25)`);

const paintOk = paintCount >= 10;
const propsOk = propsCount >= 90;
const interactablesOk = interactablesCount >= 25;

console.log(`\nCounts: ${paintOk && propsOk && interactablesOk ? '✓ OK' : '✗ FAILED'}`);

// Model validation - extract all model strings
const modelsDir = path.join(__dirname, 'public', 'models');
const missingModels = new Set();

// Find all model paths in PROPS and INTERACTABLES
const modelPattern = /model:\s*['"`]([^'"`]+)['"`]/g;
let match;
while ((match = modelPattern.exec(content)) !== null) {
  const modelPath = path.join(modelsDir, match[1]);
  if (!fs.existsSync(modelPath)) {
    missingModels.add(match[1]);
  }
}

// Report
if (missingModels.size === 0) {
  console.log(`Models: ✓ 0 missing models`);
} else {
  console.log(`Models: ✗ ${missingModels.size} missing:`);
  missingModels.forEach(m => console.log(`  - ${m}`));
}

console.log('\n=== VERIFICATION SUMMARY ===');
console.log(`PAINT count: ${paintCount}`);
console.log(`PROPS count: ${propsCount}`);
console.log(`INTERACTABLES count: ${interactablesCount}`);
console.log(`Missing models: ${missingModels.size}`);

if (paintOk && propsOk && interactablesOk && missingModels.size === 0) {
  console.log('\n✓ ALL CHECKS PASSED');
  process.exit(0);
} else {
  console.log('\n✗ SOME CHECKS FAILED');
  process.exit(1);
}
