#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";
import PNG from "pngjs";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");

function decodePNG(buffer) {
  return new Promise((resolve, reject) => {
    new PNG.PNG().parse(buffer, (err, png) => {
      if (err) reject(err);
      else resolve(png);
    });
  });
}

async function comparePNGs(baselineBuffer, currentBuffer) {
  const baseline = await decodePNG(baselineBuffer);
  const current = await decodePNG(currentBuffer);

  if (baseline.width !== current.width || baseline.height !== current.height) {
    throw new Error(
      `Dimension mismatch: baseline ${baseline.width}×${baseline.height} vs current ${current.width}×${current.height}`
    );
  }

  let changedPixels = 0;
  let totalPixels = baseline.width * baseline.height;
  let sumDeltaR = 0;
  let sumDeltaG = 0;
  let sumDeltaB = 0;
  let sumDeltaA = 0;
  let maxDelta = 0;

  for (let i = 0; i < baseline.data.length; i += 4) {
    const br = baseline.data[i];
    const bg = baseline.data[i + 1];
    const bb = baseline.data[i + 2];
    const ba = baseline.data[i + 3];

    const cr = current.data[i];
    const cg = current.data[i + 1];
    const cb = current.data[i + 2];
    const ca = current.data[i + 3];

    const dr = Math.abs(br - cr);
    const dg = Math.abs(bg - cg);
    const db = Math.abs(bb - cb);
    const da = Math.abs(ba - ca);

    const pixelMaxDelta = Math.max(dr, dg, db, da);

    if (pixelMaxDelta > 0) changedPixels++;
    sumDeltaR += dr;
    sumDeltaG += dg;
    sumDeltaB += db;
    sumDeltaA += da;
    maxDelta = Math.max(maxDelta, pixelMaxDelta);
  }

  return {
    changedPixelPercentage: (changedPixels / totalPixels) * 100,
    meanPixelDifference: (sumDeltaR + sumDeltaG + sumDeltaB + sumDeltaA) / (totalPixels * 4),
    maxPixelDifference: maxDelta,
    pixelsChanged: changedPixels,
    totalPixels,
    width: baseline.width,
    height: baseline.height,
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const baselineIndex = args.indexOf("--baseline");
  const currentIndex = args.indexOf("--current");
  const thresholdIndex = args.indexOf("--threshold");
  const updateIndex = args.indexOf("--update");

  return {
    baseline: baselineIndex >= 0 ? args[baselineIndex + 1] : null,
    current: currentIndex >= 0 ? args[currentIndex + 1] : null,
    threshold: thresholdIndex >= 0 ? parseFloat(args[thresholdIndex + 1]) : 5.0,
    update: updateIndex >= 0 || process.env.EVERLOOM_UPDATE_VISUAL_BASELINE === "1",
  };
}

const { baseline, current, threshold, update } = parseArgs();

if (!baseline || !current) {
  console.error("Usage: node visual-comparison.mjs --baseline baseline.png --current current.png [--threshold 5.0]");
  process.exit(1);
}

if (!existsSync(baseline) || !existsSync(current)) {
  console.error("Error: File not found");
  process.exit(1);
}

const baselineBytes = readFileSync(baseline);
const currentBytes = readFileSync(current);

try {
  const result = await comparePNGs(baselineBytes, currentBytes);

  console.log("\n=== Visual Comparison Result ===\n");
  console.log(`Baseline: ${baseline} (${result.width}×${result.height})`);
  console.log(`Current:  ${current} (${result.width}×${result.height})`);
  console.log(`\nComparison Results:`);
  console.log(`  Changed pixels:      ${result.changedPixelPercentage.toFixed(2)}%`);
  console.log(`  Mean channel delta:  ${result.meanPixelDifference.toFixed(3)}`);
  console.log(`  Max channel delta:   ${result.maxPixelDifference}`);
  console.log(`  Threshold:           ${threshold}%\n`);

  if (result.changedPixelPercentage > threshold) {
    console.log(`❌ FAILED: Changed pixels (${result.changedPixelPercentage.toFixed(2)}%) exceed threshold (${threshold}%)`);
    process.exit(1);
  }

  console.log(`✅ PASSED: Visual changes within threshold`);

  if (update && result.changedPixelPercentage === 0) {
    console.log(`\n🔄 Updating baseline (0% difference detected, update allowed)...`);
    writeFileSync(baseline, currentBytes);
    const newChecksum = createHash("sha256").update(currentBytes).digest("hex").toUpperCase();
    console.log(`   New checksum: ${newChecksum}`);
  } else if (update && result.changedPixelPercentage > 0) {
    console.log(`\n⚠️  Update flag set but ${result.changedPixelPercentage.toFixed(2)}% difference detected.`);
    console.log(`   Only zero-diff updates allowed to prevent silent regressions.`);
  }

  process.exit(0);
} catch (err) {
  console.error(`Error: ${err.message}`);
  process.exit(1);
}
