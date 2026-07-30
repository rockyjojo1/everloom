/**
 * Verification script for worlddata.ts
 * Checks PAINT, PROPS, INTERACTABLES counts and validates all model paths.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Import the compiled worlddata module
import { PAINT, PROPS, INTERACTABLES } from './dist/world/worlddata.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

console.log('=== WORLDDATA VERIFICATION ===\n');

// Count checks
const paintCount = PAINT.length;
const propsCount = PROPS.length;
const interactablesCount = INTERACTABLES.length;

console.log(`PAINT count: ${paintCount} (required: ≥10)`);
console.log(`PROPS count: ${propsCount} (required: ≥90)`);
console.log(`INTERACTABLES count: ${interactablesCount} (required: ≥25)`);

const paintOk = paintCount >= 10;
const propsOk = propsCount >= 90;
const interactablesOk = interactablesCount >= 25;

console.log(`\nCounts: ${paintOk && propsOk && interactablesOk ? '✓ OK' : '✗ FAILED'}`);

// Model validation
const modelsDir = path.join(__dirname, 'public', 'models');
const missingModels = [];

// Check all PROPS models
for (const prop of PROPS) {
  const modelPath = path.join(modelsDir, prop.model);
  if (!fs.existsSync(modelPath)) {
    missingModels.push(prop.model);
  }
}

// Check all INTERACTABLES models
for (const interactable of INTERACTABLES) {
  if (interactable.model) {
    const modelPath = path.join(modelsDir, interactable.model);
    if (!fs.existsSync(modelPath)) {
      missingModels.push(interactable.model);
    }
  }
}

// Report
if (missingModels.length === 0) {
  console.log(`Models: ✓ 0 missing models`);
} else {
  console.log(`Models: ✗ ${missingModels.length} missing:`);
  missingModels.forEach(m => console.log(`  - ${m}`));
}

console.log('\n=== VERIFICATION SUMMARY ===');
if (paintOk && propsOk && interactablesOk && missingModels.length === 0) {
  console.log('✓ ALL CHECKS PASSED');
  process.exit(0);
} else {
  console.log('✗ SOME CHECKS FAILED');
  process.exit(1);
}
