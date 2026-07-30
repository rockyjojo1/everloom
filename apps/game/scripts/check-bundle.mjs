import { readFile, stat } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const indexPath = resolve(appRoot, "dist/index.html");
const indexHtml = await readFile(indexPath, "utf8");
const entryMatch = indexHtml.match(/<script[^>]+type="module"[^>]+src="([^"]+)"/);

if (!entryMatch) {
  throw new Error(`Could not identify the production entry script in ${indexPath}`);
}

const entryPath = resolve(appRoot, "dist", entryMatch[1].replace(/^\/+/, ""));
const { size } = await stat(entryPath);
const maximumEntryBytes = 400 * 1024;

if (size > maximumEntryBytes) {
  throw new Error(
    `Player entry bundle is ${(size / 1024).toFixed(1)} KiB; budget is ${maximumEntryBytes / 1024} KiB. ` +
    "Keep the 3D runtime and development-only catalogue behind dynamic imports.",
  );
}

console.log(`Player entry bundle: ${(size / 1024).toFixed(1)} KiB / ${maximumEntryBytes / 1024} KiB budget.`);
