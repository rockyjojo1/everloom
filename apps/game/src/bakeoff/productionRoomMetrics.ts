import type { BakeoffMetrics, ProductionRoomProfile, RendererMetrics } from "./productionRoomTypes";

declare global {
  interface Window {
    __EVERLOOM_BAKEOFF__?: BakeoffMetrics;
  }
}

export class ProductionRoomMetricsCollector {
  private frameDurations: number[] = [];
  private lastFrameTime = 0;
  private warmupTime = 0;
  private isWarmedUp = false;
  private firstFrameTime = 0;

  startedAtMs: number;
  readyAtMs: number | null = null;
  loadMs: number | null = null;
  assetsExpected: string[];
  assetsLoaded: string[] = [];
  failedAssets: string[] = [];
  currentPlayerAnimation = "Idle";
  playerPosition = { x: 0, y: 0, z: 0 };
  movementTarget: { x: number; y: number; z: number } | null = null;
  contextLost = false;
  firstCompleteFrameRendered = false;
  grassInstances = 0;
  additionalTrees = 0;
  additionalRocks = 0;
  shadowCastingMeshes = 0;
  shadowCasterInstanceIds: string[] = [];
  maraShawlAttached = false;
  maraShawlParentBone: string | null = null;
  expectedInstanceIds: string[] = [];
  loadedInstanceIds: string[] = [];
  failedInstanceIds: string[] = [];

  constructor(
    private profile: ProductionRoomProfile,
    expectedAssets: string[]
  ) {
    this.startedAtMs = Date.now();
    this.assetsExpected = expectedAssets;
  }

  markReady() {
    this.readyAtMs = Date.now();
    this.firstFrameTime = 0;
    this.loadMs = this.readyAtMs - this.startedAtMs;
  }

  recordFrame(deltaMs: number) {
    const now = Date.now();

    if (this.firstFrameTime === 0) {
      this.firstFrameTime = now;
    }

    this.frameDurations.push(deltaMs);

    // Keep only the last 600 samples
    if (this.frameDurations.length > 600) {
      this.frameDurations.shift();
    }

    // Warm up for 2 seconds after first frame
    if (!this.isWarmedUp) {
      this.warmupTime = now - this.firstFrameTime;
      if (this.warmupTime >= 2000) {
        this.isWarmedUp = true;
        this.frameDurations = [];
      }
    }
  }

  assetLoaded(id: string) {
    if (!this.assetsLoaded.includes(id)) {
      this.assetsLoaded.push(id);
    }
  }

  assetFailed(id: string) {
    if (!this.failedAssets.includes(id)) {
      this.failedAssets.push(id);
    }
  }

  updateMetrics(
    renderer: RendererMetrics,
    viewportWidth: number,
    viewportHeight: number,
    devicePixelRatio: number,
    effectivePixelRatio: number
  ): BakeoffMetrics {
    const samples = this.frameDurations;
    let averageFps: number | null = null;
    let p95FrameMs: number | null = null;
    let worstFrameMs: number | null = null;
    let longFramesOver50Ms = 0;

    if (samples.length > 0) {
      const avgDuration = samples.reduce((a, b) => a + b, 0) / samples.length;
      averageFps = avgDuration > 0 ? Math.round(1000 / avgDuration) : null;

      // Calculate worst frame
      worstFrameMs = Math.max(...samples);

      // Calculate p95 (95th percentile)
      const sorted = [...samples].sort((a, b) => a - b);
      const p95Index = Math.ceil(sorted.length * 0.95) - 1;
      p95FrameMs = sorted[p95Index] ?? null;

      // Count frames over 50ms
      longFramesOver50Ms = samples.filter((d) => d > 50).length;
    }

    const metrics: BakeoffMetrics = {
      version: 1,
      room: "meadowrest",
      profile: this.profile,
      ready: this.readyAtMs !== null,
      startedAtMs: this.startedAtMs,
      readyAtMs: this.readyAtMs,
      loadMs: this.loadMs,
      assetsExpected: this.assetsExpected,
      assetsLoaded: this.assetsLoaded,
      failedAssets: this.failedAssets,
      currentPlayerAnimation: this.currentPlayerAnimation,
      playerPosition: this.playerPosition,
      movementTarget: this.movementTarget,
      frameSamples: samples.length,
      averageFps,
      p95FrameMs,
      worstFrameMs,
      longFramesOver50Ms,
      renderer,
      viewport: {
        width: viewportWidth,
        height: viewportHeight,
        devicePixelRatio,
        effectivePixelRatio,
      },
      contextLost: this.contextLost,
      lastUpdatedAtMs: Date.now(),
      firstCompleteFrameRendered: this.firstCompleteFrameRendered,
      grassInstances: this.grassInstances,
      additionalTrees: this.additionalTrees,
      additionalRocks: this.additionalRocks,
      shadowCastingMeshes: this.shadowCastingMeshes,
      shadowCasterInstanceIds: this.shadowCasterInstanceIds,
      maraShawlAttached: this.maraShawlAttached,
      maraShawlParentBone: this.maraShawlParentBone,
      expectedInstanceIds: this.expectedInstanceIds,
      loadedInstanceIds: this.loadedInstanceIds,
      failedInstanceIds: this.failedInstanceIds,
    };

    // Expose globally for Playwright and monitoring
    if (typeof window !== "undefined") {
      window.__EVERLOOM_BAKEOFF__ = metrics;
    }

    return metrics;
  }
}

// Unit tests for metrics calculations (types only, tested in productionRoomMetrics.test.ts)
export function calculateAverageFps(frameDurations: number[]): number | null {
  if (frameDurations.length === 0) return null;
  const avgDuration = frameDurations.reduce((a, b) => a + b, 0) / frameDurations.length;
  return avgDuration > 0 ? Math.round(1000 / avgDuration) : null;
}

export function calculateP95FrameMs(frameDurations: number[]): number | null {
  if (frameDurations.length === 0) return null;
  const sorted = [...frameDurations].sort((a, b) => a - b);
  const p95Index = Math.ceil(sorted.length * 0.95) - 1;
  return sorted[p95Index] ?? null;
}

export function calculateWorstFrameMs(frameDurations: number[]): number | null {
  if (frameDurations.length === 0) return null;
  return Math.max(...frameDurations);
}
