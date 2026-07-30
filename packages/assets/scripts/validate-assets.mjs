import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(scriptDirectory, "../../..");
const modelRoot = resolve(repositoryRoot, "apps/client3d/public/models");
const registry = JSON.parse(await readFile(resolve(scriptDirectory, "../src/registry.json"), "utf8"));
const catalog = JSON.parse(await readFile(resolve(scriptDirectory, "../src/catalog.generated.json"), "utf8"));
const errors = [];
const ids = new Set();

for (const asset of registry) {
  if (ids.has(asset.id)) errors.push(`Duplicate asset ID: ${asset.id}`);
  ids.add(asset.id);
  if (asset.sourceFile.includes("://")) continue;
  try {
    await access(resolve(modelRoot, asset.sourceFile));
  } catch {
    errors.push(`Missing source file for ${asset.id}: ${asset.sourceFile}`);
  }
}

if (catalog.length < 500) errors.push(`Expected at least 500 catalogued models; found ${catalog.length}`);

if (errors.length > 0) {
  process.stderr.write(`${errors.join("\n")}\n`);
  process.exit(1);
}
process.stdout.write(`Validated ${registry.length} semantic assets and ${catalog.length} catalog models.\n`);
