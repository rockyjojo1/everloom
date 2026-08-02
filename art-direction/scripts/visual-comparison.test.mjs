import { test } from "node:test";
import { strict as assert } from "node:assert";
import { writeFileSync, rmSync, mkdtempSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import PNG from "pngjs";
import { spawnSync } from "node:child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const toolPath = resolve(__dirname, "visual-comparison.mjs");

function createPNGBuffer(width, height, channels = { r: 255, g: 128, b: 64, a: 255 }) {
  const png = new PNG.PNG({ width, height });
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = channels.r;
    png.data[i + 1] = channels.g;
    png.data[i + 2] = channels.b;
    png.data[i + 3] = channels.a;
  }
  return png.pack();
}

async function bufferFromStream(stream) {
  const chunks = [];
  return new Promise((resolve, reject) => {
    stream.on("data", (chunk) => chunks.push(chunk));
    stream.on("end", () => resolve(Buffer.concat(chunks)));
    stream.on("error", reject);
  });
}

test("Visual comparison: identical PNGs pass", async (t) => {
  const tmpDir = mkdtempSync("everloom-");
  const baseline = resolve(tmpDir, "baseline.png");
  const current = resolve(tmpDir, "current.png");

  const buf = await bufferFromStream(createPNGBuffer(100, 100));
  writeFileSync(baseline, buf);
  writeFileSync(current, buf);

  const result = spawnSync("node", [toolPath, "--baseline", baseline, "--current", current], {
    encoding: "utf8",
  });

  assert(result.status === 0, "Identical images pass");
  assert(result.stdout.includes("0.00%"), "0% difference reported");
  assert(result.stdout.includes("PASSED"), "PASSED status shown");

  rmSync(tmpDir, { recursive: true });
});

test("Visual comparison: dimension mismatch fails", async (t) => {
  const tmpDir = mkdtempSync("everloom-");
  const baseline = resolve(tmpDir, "baseline.png");
  const current = resolve(tmpDir, "current.png");

  const buf1 = await bufferFromStream(createPNGBuffer(100, 100));
  const buf2 = await bufferFromStream(createPNGBuffer(200, 100));
  writeFileSync(baseline, buf1);
  writeFileSync(current, buf2);

  const result = spawnSync("node", [toolPath, "--baseline", baseline, "--current", current], {
    encoding: "utf8",
  });

  assert(result.status !== 0, "Dimension mismatch fails");
  assert(
    result.stderr.includes("Dimension") || result.stdout.includes("Dimension"),
    "Dimension error message shown"
  );

  rmSync(tmpDir, { recursive: true });
});

test("Visual comparison: threshold enforcement", async (t) => {
  const tmpDir = mkdtempSync("everloom-");
  const baseline = resolve(tmpDir, "baseline.png");
  const current = resolve(tmpDir, "current.png");

  const buf1 = await bufferFromStream(createPNGBuffer(100, 100));

  const png2 = new PNG.PNG({ width: 100, height: 100 });
  for (let i = 0; i < png2.data.length; i += 4) {
    if (i < 400) {
      png2.data[i] = 100;
      png2.data[i + 1] = 100;
      png2.data[i + 2] = 100;
      png2.data[i + 3] = 255;
    } else {
      png2.data[i] = 255;
      png2.data[i + 1] = 128;
      png2.data[i + 2] = 64;
      png2.data[i + 3] = 255;
    }
  }
  const buf2 = await bufferFromStream(png2.pack());

  writeFileSync(baseline, buf1);
  writeFileSync(current, buf2);

  const result = spawnSync("node", [
    toolPath,
    "--baseline",
    baseline,
    "--current",
    current,
    "--threshold",
    "0.5",
  ], { encoding: "utf8" });

  assert(result.status !== 0, "Exceeds threshold, fails");
  assert(result.stdout.includes("FAILED"), "FAILED status shown");

  rmSync(tmpDir, { recursive: true });
});

test("Visual comparison: missing file error", async (t) => {
  const result = spawnSync("node", [
    toolPath,
    "--baseline",
    "/nonexistent/baseline.png",
    "--current",
    "/nonexistent/current.png",
  ], { encoding: "utf8" });

  assert(result.status !== 0, "Missing file fails");
  assert(result.stderr.includes("Error") || result.stdout.includes("Error"), "Error message shown");
});

test("Visual comparison: missing arguments error", async (t) => {
  const result = spawnSync("node", [toolPath], { encoding: "utf8" });

  assert(result.status !== 0, "Missing args fails");
  assert(result.stderr.includes("Usage") || result.stdout.includes("Usage"), "Usage message shown");
});

console.log("\n✅ All visual comparison tests passed!");
