import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  calculateAverageFps,
  calculateP95FrameMs,
  calculateWorstFrameMs,
  ProductionRoomMetricsCollector,
} from "./productionRoomMetrics";

describe("calculateAverageFps", () => {
  it("returns null for empty array", () => {
    expect(calculateAverageFps([])).toBe(null);
  });

  it("calculates correct FPS from frame durations", () => {
    const fps = calculateAverageFps([16.67, 16.67, 16.67]);
    expect(fps).not.toBe(null);
    expect(fps!).toBeGreaterThanOrEqual(59);
    expect(fps!).toBeLessThanOrEqual(61);
  });

  it("handles a single sample", () => {
    const fps = calculateAverageFps([16.67]);
    expect(fps).not.toBe(null);
    expect(fps!).toBeGreaterThanOrEqual(59);
    expect(fps!).toBeLessThanOrEqual(61);
  });

  it("returns null for zero average duration", () => {
    expect(calculateAverageFps([0])).toBe(null);
  });

  it("is round-trip accurate", () => {
    const expectedFps = 60;
    const avgDuration = 1000 / expectedFps;
    expect(calculateAverageFps(Array(10).fill(avgDuration))).toBe(expectedFps);
  });
});

describe("calculateP95FrameMs", () => {
  it("returns null for empty array", () => {
    expect(calculateP95FrameMs([])).toBe(null);
  });

  it("calculates the 95th percentile, not the 96th", () => {
    const durations = Array(95).fill(16).concat(Array(5).fill(100));
    const p95 = calculateP95FrameMs(durations);
    expect(p95).not.toBe(null);
    // 100 samples, 95th percentile index = ceil(100*0.95)-1 = 94 (0-indexed),
    // the last of the 16ms values, not yet into the 100ms tail.
    expect(p95).toBe(16);
  });

  it("handles a small sample", () => {
    const p95 = calculateP95FrameMs([10, 20, 30]);
    expect(p95).not.toBe(null);
  });
});

describe("calculateWorstFrameMs", () => {
  it("returns null for empty array", () => {
    expect(calculateWorstFrameMs([])).toBe(null);
  });

  it("finds the maximum frame duration", () => {
    expect(calculateWorstFrameMs([16, 16, 16, 32, 16])).toBe(32);
  });

  it("handles a single sample", () => {
    expect(calculateWorstFrameMs([25])).toBe(25);
  });

  it("identifies all-same durations", () => {
    expect(calculateWorstFrameMs([20, 20, 20, 20])).toBe(20);
  });
});

describe("mixed frame durations", () => {
  it("computes fps/p95/worst consistently together", () => {
    const durations = [16, 16, 16, 20, 20, 50, 16, 16, 16, 16];
    const avgFps = calculateAverageFps(durations);
    const p95 = calculateP95FrameMs(durations);
    const worst = calculateWorstFrameMs(durations);

    expect(avgFps).not.toBe(null);
    expect(avgFps!).toBeGreaterThan(0);
    expect(p95).not.toBe(null);
    expect(worst).toBe(50);
    expect(p95!).toBeLessThanOrEqual(worst!);
  });
});

describe("ProductionRoomMetricsCollector", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(0);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("caps stored frame samples at 600", () => {
    const collector = new ProductionRoomMetricsCollector("balanced", ["a.b"]);
    // Push well past the 2s warm-up window first so samples accumulate
    // post-reset, then push far more than 600 to exercise the cap.
    for (let i = 0; i < 130; i++) {
      vi.setSystemTime(i * 16);
      collector.recordFrame(16);
    }
    for (let i = 0; i < 700; i++) {
      collector.recordFrame(16);
    }
    const metrics = collector.updateMetrics(
      { calls: 0, triangles: 0, points: 0, lines: 0, geometries: 0, textures: 0 },
      1440,
      900,
      1,
      1
    );
    expect(metrics.frameSamples).toBeLessThanOrEqual(600);
  });

  it("excludes the 2s warm-up window from FPS samples", () => {
    // Base time must be non-zero: recordFrame uses `firstFrameTime === 0` as
    // its "not yet set" sentinel, so a fake-clock start of literal 0 would
    // collide with that sentinel and corrupt the warm-up origin on every
    // subsequent call. Real Date.now() timestamps never hit exactly 0.
    const base = 1_700_000_000_000;
    vi.setSystemTime(base);
    const collector = new ProductionRoomMetricsCollector("balanced", ["a.b"]);

    // Feed frames up to just under 2000ms with an artificially bad duration
    // (as if the very first frames are slow due to shader compilation) --
    // these must not survive into the post-warm-up sample set.
    collector.recordFrame(500); // first frame, deliberately slow
    vi.setSystemTime(base + 1999);
    collector.recordFrame(500);

    // Cross the 2000ms warm-up boundary: this should trigger the one-time
    // reset of frameDurations to [].
    vi.setSystemTime(base + 2001);
    collector.recordFrame(16);

    // A handful of genuine post-warm-up frames.
    for (let i = 0; i < 10; i++) {
      vi.setSystemTime(base + 2001 + i * 16);
      collector.recordFrame(16);
    }

    const metrics = collector.updateMetrics(
      { calls: 0, triangles: 0, points: 0, lines: 0, geometries: 0, textures: 0 },
      1440,
      900,
      1,
      1
    );

    // None of the pre-warm-up 500ms samples should be present: worst frame
    // must reflect only the fast post-reset frames.
    expect(metrics.worstFrameMs).toBeLessThan(100);
  });

  it("deduplicates repeated assetLoaded calls for the same ID", () => {
    const collector = new ProductionRoomMetricsCollector("balanced", ["a.b"]);
    collector.assetLoaded("a.b");
    collector.assetLoaded("a.b");
    collector.assetLoaded("a.b");
    expect(collector.assetsLoaded).toEqual(["a.b"]);
  });

  it("deduplicates repeated assetFailed calls for the same ID", () => {
    const collector = new ProductionRoomMetricsCollector("balanced", ["a.b"]);
    collector.assetFailed("a.b");
    collector.assetFailed("a.b");
    expect(collector.failedAssets).toEqual(["a.b"]);
  });

  it("markReady sets loadMs from the elapsed time since construction", () => {
    vi.setSystemTime(0);
    const collector = new ProductionRoomMetricsCollector("balanced", []);
    vi.setSystemTime(1234);
    collector.markReady();
    expect(collector.loadMs).toBe(1234);
    expect(collector.readyAtMs).not.toBe(null);
  });

  it("updateMetrics returns the full BakeoffMetrics shape the app/tests rely on", () => {
    const collector = new ProductionRoomMetricsCollector("quality", ["a.b"]);
    const metrics = collector.updateMetrics(
      { calls: 1, triangles: 2, points: 0, lines: 0, geometries: 3, textures: 4 },
      844,
      390,
      3,
      1.5
    );
    expect(metrics.profile).toBe("quality");
    expect(metrics.viewport.effectivePixelRatio).toBe(1.5);
    expect(metrics.viewport.width).toBe(844);
    expect(metrics.viewport.height).toBe(390);
    expect(metrics.renderer.calls).toBe(1);
    expect(metrics.currentPlayerAnimation).toBe("Idle");
    expect(metrics.movementTarget).toBe(null);
    expect(metrics.contextLost).toBe(false);
  });
});
