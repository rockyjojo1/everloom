// Asserts that dev-only Gate 0 code never reaches the production bundle:
// the VisualQAGallery component/CSS, and the read-only Playwright test
// bridge. Run against a fresh `dist/` (see verify-gate0.mjs).
import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const distDir = resolve(appRoot, "dist");

async function readAllText(extensions) {
  const files = await readdir(resolve(distDir, "assets"));
  const matches = files.filter((file) => extensions.some((ext) => file.endsWith(ext)));
  const contents = await Promise.all(matches.map((file) => readFile(resolve(distDir, "assets", file), "utf8")));
  return contents.join("\n");
}

const jsContent = await readAllText([".js"]);
const cssContent = await readAllText([".css"]);

const forbidden = [
  { label: "VisualQAGallery implementation", haystack: jsContent, needle: "VisualQAGallery" },
  { label: "QA gallery CSS selectors", haystack: cssContent, needle: "qa-gallery" },
  { label: "read-only test bridge", haystack: jsContent, needle: "__EVERLOOM_READONLY_TEST__" },
];

const failures = forbidden.filter(({ haystack, needle }) => haystack.includes(needle));

if (failures.length > 0) {
  for (const { label, needle } of failures) {
    console.error(`FAIL: ${label} ("${needle}") found in production dist/assets output.`);
  }
  throw new Error(`${failures.length} production-exclusion check(s) failed.`);
}

console.log("Production exclusions verified: no VisualQAGallery, no qa-gallery CSS, no read-only test bridge.");
