#!/usr/bin/env node

import { readFileSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const contractsPath = resolve(__dirname, "..", "production-contracts.json");

let contracts;
try {
  contracts = JSON.parse(readFileSync(contractsPath, "utf8"));
} catch (e) {
  console.error(`Error loading contracts: ${e.message}`);
  process.exit(1);
}

const errors = [];

if (contracts.contracts.length !== 10) {
  errors.push(`Expected 10 contracts, found ${contracts.contracts.length}`);
}

for (const contract of contracts.contracts) {
  if (!contract.id || !contract.manifestId || !contract.displayName) {
    errors.push(`Contract ${contract.id}: missing required fields`);
  }
  if (!Array.isArray(contract.acceptanceCriteria) || contract.acceptanceCriteria.length === 0) {
    errors.push(`Contract ${contract.id}: missing acceptance criteria`);
  }
  if (contract.contractStatus !== "active") {
    errors.push(`Contract ${contract.id}: not active (status: ${contract.contractStatus})`);
  }
}

console.log("\n=== Production Contract Validation ===\n");

if (errors.length > 0) {
  console.log(`❌ ERRORS (${errors.length}):`);
  errors.forEach(e => console.log(`  - ${e}`));
  process.exit(1);
}

console.log(`✅ All ${contracts.contracts.length} production contracts valid`);
process.exit(0);
