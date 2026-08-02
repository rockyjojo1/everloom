#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { createHash } from "crypto";

const __dirname = resolve(fileURLToPath(import.meta.url), "..");

/**
 * Visual comparison tool - compares baseline PNGs against current captures.
 * Measures: pixel difference percentage, mean pixel delta, max pixel delta.
 */

function comparePNGs(baselineBuffer, currentBuffer) {
  const minLen = Math.min(baselineBuffer.length, currentBuffer.length);

  let changedPixels = 0;
  let totalPixels = (minLen - 8) / 4; // PNG header + pixel data
  let sumDelta = 0;
  let maxDelta = 0;

  // Skip PNG header (first 8 bytes)
  for (let i = 8; i < minLen; i += 4) {
    const b1 = baselineBuffer[i] || 0;
    const c1 = currentBuffer[i] || 0;
    const delta = Math.abs(b1 - c1);

    if (delta > 0) changedPixels++;
    sumDelta += delta;
    maxDelta = Math.max(maxDelta, delta);
  }

  return {
    changedPixelPercentage: (changedPixels / totalPixels) * 100,
    meanPixelDifference: sumDelta / (totalPixels * 4),
    maxPixelDifference: maxDelta,
    pixelsChanged: changedPixels,
    totalPixels: Math.floor(totalPixels)
  };
}

function parseArgs() {
  const args = process.argv.slice(2);
  const baselineIndex = args.indexOf("--baseline");
  const currentIndex = args.indexOf("--current");
  const thresholdIndex = args.indexOf("--threshold");
  const updateFlag = process.env.EVERLOOM_UPDATE_VISUAL_BASELINE === "1";

  return {
    baseline: baselineIndex >= 0 ? args[baselineIndex + 1] : null,
    current: currentIndex >= 0 ? args[currentIndex + 1] : null,
    threshold: thresholdIndex >= 0 ? parseFloat(args[thresholdIndex + 1]) : 5.0,
    updateBaseline: updateFlag
  };
}

const { baseline, current, threshold, updateBaseline } = parseArgs();

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

const result = comparePNGs(baselineBytes, currentBytes);

console.log("\n=== Visual Comparison Result ===\n");
console.log(`Baseline: ${baseline}`);
console.log(`Current:  ${current}`);
console.log(`\nComparison Results:`);
console.log(`  Changed pixels:    ${result.changedPixelPercentage.toFixed(2)}%`);
console.log(`  Mean pixel delta:  ${result.meanPixelDifference.toFixed(3)}`);
console.log(`  Max pixel delta:   ${result.maxPixelDifference}`);
console.log(`  Threshold:         ${threshold}%\n`);

if (result.changedPixelPercentage > threshold) {
  console.log(`❌ FAILED: Changed pixels (${result.changedPixelPercentage.toFixed(2)}%) exceed threshold (${threshold}%)`);

  if (updateBaseline) {
    console.log(`\n⚠️  EVERLOOM_UPDATE_VISUAL_BASELINE is set but comparison failed.`);
    console.log(`   Review the diff before updating baseline.`);
    process.exit(1);
  }

  process.exit(1);
} else {
  console.log(`✅ PASSED: Visual changes within threshold`);

  if (updateBaseline) {
    console.log(`\n🔄 Updating baseline...`);
    writeFileSync(baseline, currentBytes);
    const newChecksum = createHash("sha256").update(currentBytes).digest("hex").toUpperCase();
    console.log(`   New checksum: ${newChecksum}`);
    console.log(`   Update complete.`);
  }

  process.exit(0);
}
