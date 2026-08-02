#!/usr/bin/env node

import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");

console.log("\n=== Visual Production Workbench Validation ===\n");

const checks = [];

// Check 1: Component file exists
try {
  readFileSync(resolve(__dirname, "../src/components/VisualProductionWorkbench.tsx"), "utf8");
  checks.push("✅ Component file exists");
} catch (e) {
  checks.push(`❌ Component file not found: ${e.message}`);
  process.exit(1);
}

// Check 2: Test file exists
try {
  readFileSync(resolve(__dirname, "../src/components/VisualProductionWorkbench.test.tsx"), "utf8");
  checks.push("✅ Test file exists");
} catch (e) {
  checks.push(`❌ Test file not found: ${e.message}`);
  process.exit(1);
}

// Check 3: Verify component uses lazy loading pattern
try {
  const componentContent = readFileSync(resolve(__dirname, "../src/components/VisualProductionWorkbench.tsx"), "utf8");
  if (componentContent.includes("lazy") || componentContent.includes("development")) {
    checks.push("✅ Component uses lazy loading or dev detection");
  } else {
    checks.push("⚠️  Component may not use lazy loading (verify manually)");
  }
} catch (e) {
  checks.push(`⚠️  Could not verify component pattern: ${e.message}`);
}

// Check 4: Verify test coverage
try {
  const testContent = readFileSync(resolve(__dirname, "../src/components/VisualProductionWorkbench.test.tsx"), "utf8");
  const testCount = (testContent.match(/it\(/g) || []).length;
  if (testCount > 0) {
    checks.push(`✅ Test file has ${testCount} tests`);
  } else {
    checks.push("⚠️  No tests found in test file");
  }
} catch (e) {
  checks.push(`⚠️  Could not verify test coverage: ${e.message}`);
}

// Print results
checks.forEach(check => console.log(check));

console.log("\n✅ Visual workbench validation complete");
process.exit(0);
