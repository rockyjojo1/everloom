import { test } from "node:test";
import { strict as assert } from "node:assert";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { REPOSITORY_ROOT } from "../paths.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const buildCatalogScript = resolve(scriptDirectory, "build-catalog.mjs");
const catalogPath = resolve(scriptDirectory, "../src/catalog.generated.json");

test("running the catalogue generator twice produces byte-identical output", async () => {
  execFileSync(process.execPath, [buildCatalogScript], { cwd: REPOSITORY_ROOT });
  const first = await readFile(catalogPath);
  execFileSync(process.execPath, [buildCatalogScript], { cwd: REPOSITORY_ROOT });
  const second = await readFile(catalogPath);
  assert.ok(first.equals(second), "catalog.generated.json differed between two consecutive runs with no repository changes");
});

test("catalogue contains no machine-specific absolute paths or timestamps", async () => {
  const text = await readFile(catalogPath, "utf8");
  assert.doesNotMatch(text, /[A-Za-z]:\\/, "catalogue must not contain a Windows absolute path");
  assert.doesNotMatch(text, /\/home\/|\/Users\/|\/mnt\//, "catalogue must not contain a Unix absolute path");
  assert.doesNotMatch(text, /"generatedAt"|"timestamp"/i, "catalogue must not embed a generation timestamp");
});

test("catalogue is sorted deterministically by sourceFile", async () => {
  const records = JSON.parse(await readFile(catalogPath, "utf8"));
  const sourceFiles = records.map((r) => r.sourceFile);
  const sorted = [...sourceFiles].sort((a, b) => a.localeCompare(b));
  assert.deepEqual(sourceFiles, sorted);
});

test("catalogue contains the expected 554 GLB/glTF records", async () => {
  const records = JSON.parse(await readFile(catalogPath, "utf8"));
  assert.equal(records.length, 554);
});
