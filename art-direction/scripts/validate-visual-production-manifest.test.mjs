import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "url";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");
const manifestPath = resolve(__dirname, "..", "visual-production-manifest.json");

let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
} catch (e) {
  console.error("Failed to load manifest for testing:", e.message);
  process.exit(1);
}

const registryPath = resolve(__dirname, "..", "..", "packages", "assets", "src", "registry.json");
let registryIds = new Set();
try {
  const registryData = JSON.parse(readFileSync(registryPath, "utf8"));
  registryIds = new Set(registryData.map(a => a.id));
} catch (e) {
  console.error("Failed to load registry for testing:", e.message);
  process.exit(1);
}

test("Manifest structure", () => {
  assert.ok(manifest.version, "Manifest has version");
  assert.ok(Array.isArray(manifest.entries), "Manifest has entries array");
  assert.ok(manifest.entries.length > 0, "Manifest has at least one entry");
});

test("No duplicate IDs", () => {
  const ids = new Set();
  const duplicates = [];
  for (const entry of manifest.entries) {
    if (ids.has(entry.id)) {
      duplicates.push(entry.id);
    }
    ids.add(entry.id);
  }
  assert.equal(duplicates.length, 0, `No duplicate IDs found. Duplicates: ${duplicates.join(", ")}`);
});

test("Valid semantic asset IDs", () => {
  const invalidIds = [];
  for (const entry of manifest.entries) {
    if (entry.currentAssetId && !registryIds.has(entry.currentAssetId)) {
      invalidIds.push(`${entry.id} references invalid ID: ${entry.currentAssetId}`);
    }
  }
  assert.equal(invalidIds.length, 0, `All asset IDs must exist in registry.\n${invalidIds.join("\n")}`);
});

test("Required fields present", () => {
  const missingFields = [];
  for (const entry of manifest.entries) {
    if (!entry.id) missingFields.push(`Entry missing id`);
    if (!entry.displayName) missingFields.push(`${entry.id} missing displayName`);
    if (!entry.category) missingFields.push(`${entry.id} missing category`);
    if (!Array.isArray(entry.gameReferences)) missingFields.push(`${entry.id} missing gameReferences array`);
    if (!entry.currentStatus) missingFields.push(`${entry.id} missing currentStatus`);
    if (!entry.status) missingFields.push(`${entry.id} missing status`);
  }
  assert.equal(missingFields.length, 0, `Missing required fields:\n${missingFields.join("\n")}`);
});

test("Valid status values", () => {
  const validCurrentStatus = ["approved-existing", "licensed-placeholder", "procedural-placeholder", "missing", "needs-audit"];
  const validStatus = ["awaiting-reference", "reference-approved", "modelling", "integrated", "accepted"];

  for (const entry of manifest.entries) {
    assert.ok(validCurrentStatus.includes(entry.currentStatus), `${entry.id}: currentStatus "${entry.currentStatus}" is not valid`);
    assert.ok(validStatus.includes(entry.status), `${entry.id}: status "${entry.status}" is not valid`);
  }
});

test("Vertical-slice entries have acceptance criteria", () => {
  const missing = [];
  for (const entry of manifest.entries) {
    if (entry.productionPriority === "vertical-slice" && (!entry.acceptanceCriteria || entry.acceptanceCriteria.length === 0)) {
      missing.push(entry.id);
    }
  }
  assert.equal(missing.length, 0, `Vertical-slice entries must have acceptance criteria: ${missing.join(", ")}`);
});

test("Approved-existing entries have license", () => {
  const missing = [];
  for (const entry of manifest.entries) {
    if (entry.currentStatus === "approved-existing" && !entry.currentLicense) {
      missing.push(entry.id);
    }
  }
  assert.equal(missing.length, 0, `Approved-existing entries must have license: ${missing.join(", ")}`);
});

test("No forbidden paths", () => {
  const forbidden = [];
  for (const entry of manifest.entries) {
    if (entry.currentSource && (entry.currentSource.includes("\\Temp\\") || entry.currentSource.includes("AppData"))) {
      forbidden.push(`${entry.id}: ${entry.currentSource}`);
    }
  }
  assert.equal(forbidden.length, 0, `No Windows temp paths allowed:\n${forbidden.join("\n")}`);
});

console.log("\n✅ All validation tests passed!");
