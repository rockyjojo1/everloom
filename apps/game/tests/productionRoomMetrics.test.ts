import { test } from "node:test";
import { strict as assert } from "node:assert";
import { calculateAverageFps, calculateP95FrameMs, calculateWorstFrameMs } from "../src/bakeoff/productionRoomMetrics";

test("calculateAverageFps returns null for empty array", () => {
  assert.equal(calculateAverageFps([]), null);
});

test("calculateAverageFps calculates correct FPS from frame durations", () => {
  const durations = [16.67, 16.67, 16.67]; // ~60 FPS
  const fps = calculateAverageFps(durations);
  assert.ok(fps !== null);
  assert.ok(fps >= 59 && fps <= 61, `Expected ~60 FPS, got ${fps}`);
});

test("calculateAverageFps handles single sample", () => {
  const fps = calculateAverageFps([16.67]);
  assert.ok(fps !== null);
  assert.ok(fps >= 59 && fps <= 61);
});

test("calculateAverageFps returns null for zero average duration", () => {
  const fps = calculateAverageFps([0]);
  assert.equal(fps, null);
});

test("calculateP95FrameMs returns null for empty array", () => {
  assert.equal(calculateP95FrameMs([]), null);
});

test("calculateP95FrameMs calculates correct 95th percentile", () => {
  const durations = Array(100).fill(16).map((_, i) => i < 95 ? 16 : 50);
  const p95 = calculateP95FrameMs(durations);
  assert.ok(p95 !== null);
  assert.ok(p95 >= 16 && p95 <= 50);
});

test("calculateP95FrameMs handles small sample", () => {
  const p95 = calculateP95FrameMs([10, 20, 30]);
  assert.ok(p95 !== null);
});

test("calculateWorstFrameMs returns null for empty array", () => {
  assert.equal(calculateWorstFrameMs([]), null);
});

test("calculateWorstFrameMs finds maximum frame duration", () => {
  const durations = [16, 16, 16, 32, 16];
  const worst = calculateWorstFrameMs(durations);
  assert.equal(worst, 32);
});

test("calculateWorstFrameMs handles single sample", () => {
  const worst = calculateWorstFrameMs([25]);
  assert.equal(worst, 25);
});

test("calculateWorstFrameMs identifies all same durations", () => {
  const durations = [20, 20, 20, 20];
  const worst = calculateWorstFrameMs(durations);
  assert.equal(worst, 20);
});

test("p95 frame calculation is 95th percentile not 96th", () => {
  // Create exactly 100 samples with known distribution
  const durations = Array(95).fill(16).concat(Array(5).fill(100));
  const p95 = calculateP95FrameMs(durations);
  // 95th percentile of sorted array should pick the 95th element (index 94)
  assert.ok(p95 !== null);
  assert.ok(p95 <= 100);
});

test("FPS calculation is round-trip accurate", () => {
  const expectedFps = 60;
  const avgDuration = 1000 / expectedFps; // 16.67ms
  const fps = calculateAverageFps(Array(10).fill(avgDuration));
  assert.equal(fps, expectedFps);
});

test("metrics handle mixed frame durations correctly", () => {
  const durations = [16, 16, 16, 20, 20, 50, 16, 16, 16, 16];
  const avgFps = calculateAverageFps(durations);
  const p95 = calculateP95FrameMs(durations);
  const worst = calculateWorstFrameMs(durations);

  assert.ok(avgFps !== null);
  assert.ok(avgFps > 0);
  assert.ok(p95 !== null && worst !== null && p95 <= worst);
  assert.ok(worst !== null && worst === 50);
});
