import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = resolve(__filename, "..");
const contractsPath = resolve(__dirname, "production-contracts.json");

let contracts;
try {
  contracts = JSON.parse(readFileSync(contractsPath, "utf8"));
} catch (e) {
  console.error("Failed to load contracts:", e.message);
  process.exit(1);
}

// GATE 11 TESTS - Production contracts

test("Production contracts: file loads successfully", () => {
  assert.ok(contracts.version, "Contracts have version");
  assert.ok(contracts.contracts, "Contracts have contracts array");
  assert.ok(Array.isArray(contracts.contracts), "Contracts is an array");
});

test("Production contracts: 10 vertical-slice contracts exist", () => {
  assert.equal(contracts.contracts.length, 10, "Exactly 10 contracts");
  const allVerticalSlice = contracts.contracts.every((c) => c.productionPriority === "vertical-slice");
  assert.equal(allVerticalSlice, true, "All contracts are vertical-slice");
});

test("Production contracts: each contract has required structure", () => {
  const requiredFields = [
    "id",
    "manifestId",
    "displayName",
    "productionPriority",
    "referenceSheets",
    "runtimeAssetId",
    "format",
    "requirements",
    "acceptanceCriteria",
    "boardSection",
    "contractStatus",
  ];

  for (const contract of contracts.contracts) {
    for (const field of requiredFields) {
      assert.ok(contract[field] !== undefined, `Contract ${contract.id} has ${field}`);
    }
  }
});

test("Production contracts: reference sheet links are valid", () => {
  for (const contract of contracts.contracts) {
    assert.ok(Array.isArray(contract.referenceSheets), `Contract ${contract.id} has referenceSheets array`);
    assert.ok(contract.referenceSheets.length > 0, `Contract ${contract.id} has at least one sheet`);
    for (const sheet of contract.referenceSheets) {
      const sheetNum = parseInt(sheet, 10);
      assert.ok(sheetNum >= 1 && sheetNum <= 10, `Contract ${contract.id} sheet ${sheet} is in range 01-10`);
    }
  }
});

test("Production contracts: acceptance criteria are present and clear", () => {
  for (const contract of contracts.contracts) {
    assert.ok(Array.isArray(contract.acceptanceCriteria), `Contract ${contract.id} has criteria array`);
    assert.ok(contract.acceptanceCriteria.length >= 3, `Contract ${contract.id} has at least 3 criteria`);
    for (const criterion of contract.acceptanceCriteria) {
      assert.equal(typeof criterion, "string", `Contract ${contract.id} criterion is string`);
      assert.ok(criterion.length > 10, `Contract ${contract.id} criterion is descriptive`);
    }
  }
});

test("Production contracts: requirements are detailed", () => {
  for (const contract of contracts.contracts) {
    assert.ok(typeof contract.requirements === "object", `Contract ${contract.id} has requirements object`);
    assert.ok(Object.keys(contract.requirements).length > 0, `Contract ${contract.id} has detailed requirements`);
  }
});

test("Production contracts: format is specified", () => {
  for (const contract of contracts.contracts) {
    assert.ok(contract.format, `Contract ${contract.id} has format specified`);
    assert.ok(contract.format.length > 0, `Contract ${contract.id} format is non-empty`);
    const validFormats = [
      "glTF",
      "PNG",
      "Heightmap",
      "Material",
      "JSON",
      "GLB",
    ];
    const hasValidFormat = validFormats.some((fmt) => contract.format.includes(fmt));
    assert.ok(hasValidFormat, `Contract ${contract.id} format is recognized`);
  }
});

test("Production contracts: contract IDs are unique", () => {
  const ids = contracts.contracts.map((c) => c.id);
  const uniqueIds = new Set(ids);
  assert.equal(ids.length, uniqueIds.size, "All contract IDs are unique");
});

test("Production contracts: manifest IDs are unique", () => {
  const manifestIds = contracts.contracts.map((c) => c.manifestId);
  const uniqueManifestIds = new Set(manifestIds);
  assert.equal(manifestIds.length, uniqueManifestIds.size, "All manifest IDs are unique");
});

test("Production contracts: summary statistics are accurate", () => {
  const summary = contracts.summary;
  assert.equal(summary.totalContracts, 10, "Summary reports 10 contracts");
  assert.equal(summary.activeContracts, 10, "Summary reports 10 active contracts");
  assert.equal(summary.completedContracts, 0, "Summary reports 0 completed");
});

test("Production contracts: all contracts are signed", () => {
  for (const contract of contracts.contracts) {
    assert.equal(contract.contractStatus, "active", `Contract ${contract.id} is active`);
    assert.ok(contract.signedBy, `Contract ${contract.id} is signed by someone`);
    assert.ok(contract.signedDate, `Contract ${contract.id} has sign date`);
  }
});

console.log("\n✅ All production contract tests passed!");
