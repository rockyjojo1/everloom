import { readdir, stat, writeFile } from "node:fs/promises";
import { dirname, extname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { MODEL_ROOT } from "../paths.mjs";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const modelRoot = MODEL_ROOT;
const outputFile = resolve(scriptDirectory, "../src/catalog.generated.json");

function categoryFor(filename) {
  const name = filename.toLowerCase();
  if (/character|skeleton|minion|warrior|rogue|mage/.test(name)) return "character";
  if (/tree|bush|grass|plant|flower|mushroom/.test(name)) return "foliage";
  if (/rock|stone|cliff|ore/.test(name)) return "rock";
  if (/wall|roof|door|window|stairs|bridge|mill|stall/.test(name)) return "structure";
  if (/sword|axe|blade|staff|shield|bow|arrow/.test(name)) return "equipment";
  if (/fire|furnace|anvil/.test(name)) return "facility";
  return "prop";
}

async function walk(directory) {
  const records = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      records.push(...await walk(fullPath));
      continue;
    }
    const extension = extname(entry.name).toLowerCase();
    if (extension !== ".glb" && extension !== ".gltf") continue;
    const sourceFile = relative(modelRoot, fullPath).replaceAll("\\", "/");
    const pack = sourceFile.split("/")[0];
    const identifier = sourceFile
      .replace(/\.(gltf\.)?glb$|\.gltf$/i, "")
      .replace(/[^a-z0-9]+/gi, ".")
      .replace(/^\.+|\.+$/g, "")
      .toLowerCase();
    records.push({
      id: `catalog.${identifier}`,
      sourceFile,
      pack,
      category: categoryFor(sourceFile),
      format: extension.slice(1),
      bytes: (await stat(fullPath)).size,
    });
  }
  return records;
}

const catalog = (await walk(modelRoot)).sort((left, right) => left.sourceFile.localeCompare(right.sourceFile));
await writeFile(outputFile, `${JSON.stringify(catalog, null, 2)}\n`, "utf8");
process.stdout.write(`Wrote ${catalog.length} model records to ${outputFile}\n`);
