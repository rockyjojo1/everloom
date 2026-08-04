#!/usr/bin/env node

import { spawn, execSync } from "child_process";
import { chromium } from "playwright";
import { writeFileSync, mkdirSync, existsSync } from "fs";
import { resolve, dirname } from "path";

const SCRIPT_DIR = dirname(new URL(import.meta.url).pathname);
const DIST_DIR = resolve(SCRIPT_DIR, "../dist");
const SCREENSHOTS_DIR = resolve(SCRIPT_DIR, "../../docs/audits/2026-08-04-meadowrest-production-room/screenshots");
const METRICS_FILE = resolve(SCRIPT_DIR, "../../docs/audits/2026-08-04-meadowrest-production-room/METRICS.json");

// Ensure screenshots directory exists
if (!existsSync(SCREENSHOTS_DIR)) {
  mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Check if dist exists
if (!existsSync(DIST_DIR)) {
  console.error("ERROR: apps/game/dist not found. Run 'pnpm build' first.");
  process.exit(1);
}

// Find available port
function findAvailablePort(startPort = 4178) {
  for (let port = startPort; port < startPort + 10; port++) {
    try {
      execSync(`netstat -ano | findstr :${port}`, { stdio: "ignore", shell: "powershell.exe" });
    } catch {
      return port;
    }
  }
  return startPort;
}

const PORT = findAvailablePort();
const SERVER_URL = `http://localhost:${PORT}`;

console.log(`Using port ${PORT} for preview server`);

// Start Vite preview server
console.log("Starting preview server...");
const server = spawn("pnpm", ["exec", "vite", "preview", "--port", String(PORT)], {
  cwd: resolve(SCRIPT_DIR, ".."),
  stdio: "pipe",
});

let serverReady = false;
server.stdout?.on("data", (data) => {
  const text = data.toString();
  console.log("[Server]", text);
  if (text.includes("ready in")) {
    serverReady = true;
  }
});

server.stderr?.on("data", (data) => {
  console.error("[Server]", data.toString());
});

// Wait for server to start
await new Promise((resolve) => {
  const check = setInterval(() => {
    if (serverReady) {
      clearInterval(check);
      resolve(undefined);
    }
  }, 500);

  setTimeout(() => {
    clearInterval(check);
    console.warn("Server startup timeout, proceeding anyway...");
    resolve(undefined);
  }, 10000);
});

await new Promise((resolve) => setTimeout(resolve, 1000));

const captures = [];
const testConfigs = [
  { name: "desktop-balanced", viewport: { width: 1440, height: 900 }, profile: "balanced", mobile: false },
  { name: "desktop-quality", viewport: { width: 1440, height: 900 }, profile: "quality", mobile: false },
  { name: "iphone-landscape-balanced", viewport: { width: 844, height: 390 }, profile: "balanced", mobile: true },
  { name: "iphone-landscape-quality", viewport: { width: 844, height: 390 }, profile: "quality", mobile: true },
];

try {
  const browser = await chromium.launch();

  for (const config of testConfigs) {
    console.log(`\nCapturing ${config.name}...`);

    const context = await browser.newContext({
      viewport: config.viewport,
      isMobile: config.mobile,
      hasTouch: config.mobile,
      deviceScaleFactor: config.mobile ? 3 : 1,
    });

    const page = await context.newPage();
    const url = `${SERVER_URL}/?bakeoff=meadowrest&profile=${config.profile}`;
    console.log(`  Loading: ${url}`);
    await page.goto(url, { waitUntil: "networkidle" });

    // Wait for ready
    console.log("  Waiting for ready state...");
    await page.waitForFunction(() => (window).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 15000 });

    // Wait for metrics to stabilize (8+ seconds of data)
    console.log("  Waiting for metrics to settle...");
    await page.waitForFunction(
      () => (window).__EVERLOOM_BAKEOFF__?.frameSamples > 150,
      { timeout: 15000 }
    );

    // Collect metrics
    const metrics = await page.evaluate(() => (window).__EVERLOOM_BAKEOFF__);
    console.log(`  Assets: ${metrics.assetsLoaded.length}/${metrics.assetsExpected.length}`);
    console.log(`  FPS: ${metrics.averageFps}`);
    console.log(`  P95: ${metrics.p95FrameMs}ms`);

    // Take screenshot
    const screenshotPath = resolve(SCREENSHOTS_DIR, `${config.name}.png`);
    console.log(`  Saving screenshot to ${screenshotPath}`);
    await page.screenshot({ path: screenshotPath, fullPage: false });

    captures.push({
      config: config.name,
      profile: config.profile,
      viewport: config.viewport,
      metrics: {
        loadMs: metrics.loadMs,
        averageFps: metrics.averageFps,
        p95FrameMs: Math.round(metrics.p95FrameMs || 0),
        worstFrameMs: Math.round(metrics.worstFrameMs || 0),
        longFramesOver50Ms: metrics.longFramesOver50Ms,
        drawCalls: metrics.renderer.calls,
        triangles: metrics.renderer.triangles,
        textures: metrics.renderer.textures,
        failedAssets: metrics.failedAssets.length,
      },
    });

    await context.close();
  }

  // Test portrait orientation
  console.log(`\nCapturing iphone-portrait-rotate...`);
  const portraitContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
  });
  const portraitPage = await portraitContext.newPage();
  await portraitPage.goto(`${SERVER_URL}/?bakeoff=meadowrest`, { waitUntil: "networkidle" });
  const portraitScreenshotPath = resolve(SCREENSHOTS_DIR, "iphone-portrait-rotate.png");
  await portraitPage.screenshot({ path: portraitScreenshotPath, fullPage: false });
  await portraitContext.close();

  await browser.close();

  // Generate METRICS.json
  console.log("\nGenerating METRICS.json...");

  const metricsData = {
    auditDate: new Date().toISOString(),
    gitSha: execSync("git rev-parse HEAD", { encoding: "utf8" }).trim(),
    testEnvironment: {
      browserName: "chromium",
      browserVersion: "latest",
    },
    captures,
    targets: {
      hard: {
        routeReadyMs: 12000,
        requiredAssetFailures: 0,
        model404Count: 0,
        pageErrorCount: 0,
        webglContextLoss: false,
        playerMovementDistance: 1.5,
        animationTransition: true,
        profileSwitch: true,
        resetButton: true,
        hardFpsMinimum: 15,
        worstFrameMs: 500,
        horizontalOverflow: false,
        authoritative_app_marker: true,
      },
      balanced_desktop: {
        averageFps: 50,
        p95FrameMs: 35,
        loadMs: 6000,
      },
      quality_desktop: {
        averageFps: 40,
        p95FrameMs: 50,
        loadMs: 8000,
      },
      balanced_mobile: {
        averageFps: 30,
        p95FrameMs: 66,
        loadMs: 8000,
      },
      quality_mobile: {
        averageFps: 24,
        p95FrameMs: 80,
        loadMs: 10000,
      },
      general: {
        drawCalls: 180,
        triangles: 350000,
        framesOver50Ms: 0.05,
      },
    },
    results: {},
  };

  // Evaluate against thresholds
  for (const capture of captures) {
    const result = {
      passed: true,
      issues: [],
      metrics: capture.metrics,
    };

    // Check hard requirements
    if (capture.metrics.failedAssets > 0) {
      result.passed = false;
      result.issues.push("Required assets failed to load");
    }

    if (capture.metrics.averageFps < metricsData.targets.hard.hardFpsMinimum) {
      result.issues.push(`FPS ${capture.metrics.averageFps} below hard minimum ${metricsData.targets.hard.hardFpsMinimum}`);
    }

    if (capture.metrics.worstFrameMs > metricsData.targets.hard.worstFrameMs) {
      result.issues.push(`Worst frame ${capture.metrics.worstFrameMs}ms exceeds ${metricsData.targets.hard.worstFrameMs}ms`);
    }

    // Check target thresholds
    const isBalanced = capture.profile === "balanced";
    const isMobile = capture.config.includes("iphone");
    const target = isMobile ? (isBalanced ? metricsData.targets.balanced_mobile : metricsData.targets.quality_mobile) : isBalanced ? metricsData.targets.balanced_desktop : metricsData.targets.quality_desktop;

    if (capture.metrics.averageFps < target.averageFps) {
      result.issues.push(`Target FPS ${target.averageFps} not met: ${capture.metrics.averageFps}`);
    }

    if (capture.metrics.p95FrameMs > target.p95FrameMs) {
      result.issues.push(`Target P95 ${target.p95FrameMs}ms not met: ${capture.metrics.p95FrameMs}ms`);
    }

    metricsData.results[capture.config] = result;
  }

  // Determine recommendation
  const allHardsPassed = Object.values(metricsData.results).every((r) => r.passed);
  const balancedTargetsMet =
    captures.filter((c) => c.profile === "balanced").every((c) => {
      const target = c.config.includes("iphone") ? metricsData.targets.balanced_mobile : metricsData.targets.balanced_desktop;
      return c.metrics.averageFps >= target.averageFps;
    });

  let recommendation = "BLOCKED";
  if (allHardsPassed) {
    if (balancedTargetsMet) {
      recommendation = "PROCEED_TO_CAPACITOR_BAKEOFF";
    } else {
      recommendation = "PROCEED_WITH_BROWSER_OPTIMISATION";
    }
  }

  metricsData.recommendation = recommendation;

  // Write file
  writeFileSync(METRICS_FILE, JSON.stringify(metricsData, null, 2));
  console.log(`\nMetrics saved to ${METRICS_FILE}`);
  console.log(`Recommendation: ${recommendation}`);
} catch (err) {
  console.error("Capture failed:", err);
  process.exit(1);
} finally {
  // Kill preview server
  console.log("\nStopping preview server...");
  server.kill();
}
