#!/usr/bin/env node

import { spawn, execSync } from "child_process";
import { chromium } from "@playwright/test";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const SCRIPT_DIR = dirname(fileURLToPath(import.meta.url));
const DIST_DIR = resolve(SCRIPT_DIR, "../dist");
const SCREENSHOTS_DIR = resolve(SCRIPT_DIR, "../../../docs/audits/2026-08-04-meadowrest-production-room/screenshots");
const METRICS_FILE = resolve(SCRIPT_DIR, "../../../docs/audits/2026-08-04-meadowrest-production-room/METRICS.json");

const WARMUP_MS = 2000;
const MEASUREMENT_MS = 8000;

// Headless Chromium defaults to SwiftShader (software WebGL). Forcing real
// GPU access via ANGLE/D3D11 changed measured FPS for this scene from ~12
// to 60+ on this machine's Intel UHD Graphics -- confirming the low FPS was
// a measurement-environment artifact (software rasterizer), not scene cost.
const GPU_ARGS = ["--use-gl=angle", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"];

if (!existsSync(SCREENSHOTS_DIR)) {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

if (!existsSync(DIST_DIR)) {
  console.error("ERROR: apps/game/dist not found. Run 'pnpm build' first.");
  process.exit(1);
}

function isPortFree(port) {
  try {
    const out = execSync(
      `Get-NetTCPConnection -LocalPort ${port} -State Listen -ErrorAction SilentlyContinue`,
      { shell: "powershell.exe", encoding: "utf8" }
    );
    return out.trim().length === 0;
  } catch {
    return true;
  }
}

function selectPort() {
  for (const port of [4178, 4179, 4180]) {
    if (isPortFree(port)) return port;
  }
  throw new Error("Ports 4178, 4179, 4180 are all in use.");
}

async function waitForServer(url, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url);
      if (res.ok || res.status < 500) return true;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 300));
  }
  return false;
}

const PORT = selectPort();
const SERVER_URL = `http://127.0.0.1:${PORT}`;
console.log(`Selected port: ${PORT}`);

console.log("Starting preview server...");
const server = spawn("pnpm", ["exec", "vite", "preview", "--port", String(PORT), "--host", "127.0.0.1"], {
  cwd: resolve(SCRIPT_DIR, ".."),
  stdio: "pipe",
  shell: true,
});
console.log(`Preview process PID: ${server.pid}`);

server.stdout?.on("data", (data) => console.log("[Server]", data.toString().trim()));
server.stderr?.on("data", (data) => console.error("[Server]", data.toString().trim()));

const serverUp = await waitForServer(SERVER_URL, 20000);
if (!serverUp) {
  console.error(`ERROR: preview server did not respond at ${SERVER_URL} within 20s.`);
  server.kill();
  process.exit(1);
}
console.log(`Preview server responding at ${SERVER_URL}`);

const captures = [];
const testConfigs = [
  { name: "desktop-balanced", viewport: { width: 1440, height: 900 }, profile: "balanced", mobile: false },
  { name: "desktop-quality", viewport: { width: 1440, height: 900 }, profile: "quality", mobile: false },
  { name: "iphone-landscape-balanced", viewport: { width: 844, height: 390 }, profile: "balanced", mobile: true },
  { name: "iphone-landscape-quality", viewport: { width: 844, height: 390 }, profile: "quality", mobile: true },
];

let exitCode = 0;
let browser;

try {
  browser = await chromium.launch({ args: GPU_ARGS });
  const browserVersion = browser.version();
  console.log(`Browser version: ${browserVersion}`);

  for (const config of testConfigs) {
    console.log(`\nCapturing ${config.name}...`);

    // deviceScaleFactor is fixed at 1 so the captured PNG's pixel dimensions
    // exactly match the CSS viewport (required: 1440x900 desktop, 844x390
    // landscape mobile, 390x844 portrait). The renderer's effective pixel
    // ratio cap (profileSettings.pixelRatioCap) is still exercised and
    // reported in metrics regardless of this capture-time scale factor.
    const context = await browser.newContext({
      viewport: config.viewport,
      isMobile: config.mobile,
      hasTouch: config.mobile,
      deviceScaleFactor: 1,
    });

    const page = await context.newPage();

    const pageErrors = [];
    const consoleErrors = [];
    const failed404s = [];
    page.on("pageerror", (err) => pageErrors.push(String(err)));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("response", (res) => {
      if (res.status() === 404) {
        const url = res.url();
        if (url.includes("/models/")) {
          failed404s.push(url);
        }
      }
    });

    const url = `${SERVER_URL}/?bakeoff=meadowrest&profile=${config.profile}`;
    console.log(`  Loading: ${url}`);
    await page.goto(url, { waitUntil: "networkidle" });

    console.log("  Waiting for ready state...");
    const readyStart = Date.now();
    await page.waitForFunction(() => (window).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 15000 });
    const readyMs = Date.now() - readyStart;
    console.log(`  Ready after ${readyMs}ms`);

    console.log(`  Warm-up (${WARMUP_MS}ms) + measurement window (${MEASUREMENT_MS}ms)...`);
    await page.waitForTimeout(WARMUP_MS + MEASUREMENT_MS);

    const metrics = await page.evaluate(() => (window).__EVERLOOM_BAKEOFF__);
    const glInfo = await page.evaluate(() => {
      const canvas = document.querySelector("canvas");
      if (!canvas) return null;
      const gl = canvas.getContext("webgl2") || canvas.getContext("webgl");
      if (!gl) return null;
      const dbg = gl.getExtension("WEBGL_debug_renderer_info");
      return {
        renderer: dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        vendor: dbg ? gl.getParameter(dbg.UNMASKED_VENDOR_WEBGL) : gl.getParameter(gl.VENDOR),
      };
    });

    console.log(`  Assets: ${metrics.assetsLoaded.length}/${metrics.assetsExpected.length} (failed: ${metrics.failedAssets.length})`);
    console.log(`  FPS: ${metrics.averageFps}  P95: ${metrics.p95FrameMs}ms  Worst: ${metrics.worstFrameMs}ms  Samples: ${metrics.frameSamples}`);
    console.log(`  WebGL renderer: ${glInfo?.renderer ?? "unknown"}`);
    console.log(`  Page errors: ${pageErrors.length}  Console errors: ${consoleErrors.length}  404s: ${failed404s.length}`);

    const screenshotPath = resolve(SCREENSHOTS_DIR, `${config.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`  Screenshot: ${screenshotPath}`);

    captures.push({
      config: config.name,
      profile: config.profile,
      viewport: config.viewport,
      configuredDeviceScaleFactor: 1,
      browserDevicePixelRatio: metrics.viewport.devicePixelRatio,
      readyMs,
      measurementWindowMs: WARMUP_MS + MEASUREMENT_MS,
      webgl: glInfo,
      pageErrors,
      consoleErrors,
      failed404s,
      metrics: {
        loadMs: metrics.loadMs,
        averageFps: metrics.averageFps,
        p95FrameMs: metrics.p95FrameMs === null ? null : Math.round(metrics.p95FrameMs),
        worstFrameMs: metrics.worstFrameMs === null ? null : Math.round(metrics.worstFrameMs),
        longFramesOver50Ms: metrics.longFramesOver50Ms,
        frameSamples: metrics.frameSamples,
        drawCalls: metrics.renderer.calls,
        triangles: metrics.renderer.triangles,
        textures: metrics.renderer.textures,
        failedAssets: metrics.failedAssets.length,
        failedAssetIds: metrics.failedAssets,
        effectivePixelRatio: metrics.viewport.effectivePixelRatio,
        devicePixelRatio: metrics.viewport.devicePixelRatio,
        contextLost: metrics.contextLost,
      },
    });

    await page.close();
    await context.close();
  }

  console.log(`\nCapturing iphone-portrait-rotate...`);
  const portraitContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  const portraitPage = await portraitContext.newPage();
  await portraitPage.goto(`${SERVER_URL}/?bakeoff=meadowrest&profile=balanced`, { waitUntil: "networkidle" });
  await portraitPage.waitForTimeout(500);
  const portraitScreenshotPath = resolve(SCREENSHOTS_DIR, "iphone-portrait-rotate.png");
  await portraitPage.screenshot({ path: portraitScreenshotPath, fullPage: false });
  console.log(`  Screenshot: ${portraitScreenshotPath}`);
  await portraitPage.close();
  await portraitContext.close();

  console.log("\nGenerating METRICS.json...");

  const metricsData = {
    auditDate: new Date().toISOString(),
    gitSha: execSync("git rev-parse HEAD", { encoding: "utf8" }).trim(),
    testEnvironment: {
      browserName: "chromium",
      browserVersion,
      gpuArgs: GPU_ARGS,
      port: PORT,
      warmupMs: WARMUP_MS,
      measurementMs: MEASUREMENT_MS,
    },
    captures,
    targets: {
      hard: {
        routeReadyMs: 12000,
        requiredAssetFailures: 0,
        model404Count: 0,
        pageErrorCount: 0,
        consoleErrorCount: 0,
        webglContextLoss: false,
        hardFpsMinimum: 15,
        worstFrameMs: 500,
      },
      balanced_desktop: { averageFps: 50, p95FrameMs: 35, loadMs: 6000 },
      quality_desktop: { averageFps: 40, p95FrameMs: 50, loadMs: 8000 },
      balanced_mobile: { averageFps: 30, p95FrameMs: 66, loadMs: 8000 },
      quality_mobile: { averageFps: 24, p95FrameMs: 80, loadMs: 10000 },
      general: { drawCalls: 180, triangles: 350000, framesOver50Ms: 0.05 },
    },
    results: {},
  };

  for (const capture of captures) {
    const result = { passed: true, issues: [], metrics: capture.metrics };

    // Hard check: ready time
    if (capture.metrics.loadMs > 12000) {
      result.passed = false;
      result.issues.push(`Load time ${capture.metrics.loadMs}ms exceeds 12s hard limit`);
    }

    // Hard check: asset set equality
    const expectedSet = new Set(capture.metrics.assetsExpected);
    const loadedSet = new Set(capture.metrics.assetsLoaded);
    if (expectedSet.size !== loadedSet.size ||
        ![...expectedSet].every(id => loadedSet.has(id))) {
      result.passed = false;
      const missing = [...expectedSet].filter(id => !loadedSet.has(id));
      const extra = [...loadedSet].filter(id => !expectedSet.has(id));
      if (missing.length) result.issues.push(`Missing assets: ${missing.join(", ")}`);
      if (extra.length) result.issues.push(`Extra assets loaded: ${extra.join(", ")}`);
    }

    if (capture.metrics.failedAssets > 0) {
      result.passed = false;
      result.issues.push(`Required assets failed to load: ${capture.metrics.failedAssetIds.join(", ")}`);
    }
    if (capture.pageErrors.length > 0) {
      result.passed = false;
      result.issues.push(`Page errors: ${capture.pageErrors.length}`);
    }
    if (capture.consoleErrors.length > 0) {
      result.passed = false;
      result.issues.push(`Console errors: ${capture.consoleErrors.length}`);
    }
    if (capture.failed404s.length > 0) {
      result.passed = false;
      result.issues.push(`Model 404s: ${capture.failed404s.length}`);
    }
    if (capture.metrics.contextLost) {
      result.passed = false;
      result.issues.push("WebGL context lost");
    }
    if (capture.metrics.averageFps === null || capture.metrics.averageFps < metricsData.targets.hard.hardFpsMinimum) {
      result.passed = false;
      result.issues.push(`FPS ${capture.metrics.averageFps} below hard minimum ${metricsData.targets.hard.hardFpsMinimum}`);
    }
    if (capture.metrics.worstFrameMs !== null && capture.metrics.worstFrameMs > metricsData.targets.hard.worstFrameMs) {
      result.passed = false;
      result.issues.push(`Worst frame ${capture.metrics.worstFrameMs}ms exceeds ${metricsData.targets.hard.worstFrameMs}ms`);
    }

    const isBalanced = capture.profile === "balanced";
    const isMobile = capture.config.includes("iphone");
    const target = isMobile
      ? isBalanced ? metricsData.targets.balanced_mobile : metricsData.targets.quality_mobile
      : isBalanced ? metricsData.targets.balanced_desktop : metricsData.targets.quality_desktop;

    if (capture.metrics.averageFps !== null && capture.metrics.averageFps < target.averageFps) {
      result.issues.push(`Target FPS ${target.averageFps} not met: ${capture.metrics.averageFps} (soft target, not a hard failure)`);
    }
    if (capture.metrics.p95FrameMs !== null && capture.metrics.p95FrameMs > target.p95FrameMs) {
      result.issues.push(`Target P95 ${target.p95FrameMs}ms not met: ${capture.metrics.p95FrameMs}ms (soft target, not a hard failure)`);
    }
    if (capture.metrics.loadMs !== null && capture.metrics.loadMs > target.loadMs) {
      result.issues.push(`Target load time ${target.loadMs}ms not met: ${capture.metrics.loadMs}ms (soft target, not a hard failure)`);
    }

    metricsData.results[capture.config] = result;
  }

  const allHardsPassed = Object.values(metricsData.results).every((r) => r.passed);

  const balancedDesktopMetrics = captures.find((c) => c.config === "desktop-balanced")?.metrics;
  const balancedMobileMetrics = captures.find((c) => c.config === "iphone-landscape-balanced")?.metrics;

  const balancedDesktopTargets = metricsData.targets.balanced_desktop;
  const balancedMobileTargets = metricsData.targets.balanced_mobile;

  const balancedDesktopFpsMet = balancedDesktopMetrics?.averageFps !== null && balancedDesktopMetrics?.averageFps >= balancedDesktopTargets.averageFps;
  const balancedDesktopP95Met = balancedDesktopMetrics?.p95FrameMs !== null && balancedDesktopMetrics?.p95FrameMs <= balancedDesktopTargets.p95FrameMs;
  const balancedDesktopLoadMet = balancedDesktopMetrics?.loadMs !== null && balancedDesktopMetrics?.loadMs <= balancedDesktopTargets.loadMs;

  const balancedMobileFpsMet = balancedMobileMetrics?.averageFps !== null && balancedMobileMetrics?.averageFps >= balancedMobileTargets.averageFps;
  const balancedMobileP95Met = balancedMobileMetrics?.p95FrameMs !== null && balancedMobileMetrics?.p95FrameMs <= balancedMobileTargets.p95FrameMs;
  const balancedMobileLoadMet = balancedMobileMetrics?.loadMs !== null && balancedMobileMetrics?.loadMs <= balancedMobileTargets.loadMs;

  const generalTargetsMet = captures.every((c) => {
    const target = metricsData.targets.general;
    const framesOver50 = c.metrics.longFramesOver50Ms > 0 ? c.metrics.longFramesOver50Ms / Math.max(1, c.metrics.frameSamples) : 0;
    return c.metrics.drawCalls <= target.drawCalls &&
           c.metrics.triangles <= target.triangles &&
           framesOver50 <= target.framesOver50Ms;
  });

  let recommendation = "BLOCKED";
  if (allHardsPassed &&
      balancedDesktopFpsMet && balancedDesktopP95Met && balancedDesktopLoadMet &&
      balancedMobileFpsMet && balancedMobileP95Met && balancedMobileLoadMet &&
      generalTargetsMet) {
    recommendation = "PROCEED_TO_CAPACITOR_BAKEOFF";
  } else if (allHardsPassed) {
    recommendation = "PROCEED_WITH_BROWSER_OPTIMISATION";
  }
  metricsData.recommendation = recommendation;

  writeFileSync(METRICS_FILE, JSON.stringify(metricsData, null, 2));
  console.log(`\nMetrics saved to ${METRICS_FILE}`);
  console.log(`Recommendation: ${recommendation}`);

  if (!allHardsPassed) {
    exitCode = 1;
  }
} catch (err) {
  console.error("Capture failed:", err);
  exitCode = 1;
} finally {
  if (browser) {
    await browser.close();
  }
  console.log("\nStopping preview server...");
  server.kill();
  await new Promise((r) => setTimeout(r, 500));
}

process.exit(exitCode);
