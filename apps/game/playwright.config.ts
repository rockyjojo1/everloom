import { defineConfig, devices } from "@playwright/test";

const port = Number(process.env.EVERLOOM_E2E_PORT ?? 4310);

export default defineConfig({
  testDir: "./tests",
  // Service-worker behaviour is validated against the production preview by
  // playwright.pwa.config.ts, never against Vite's development server.
  testIgnore: ["pwa-offline.spec.ts", "capacitor-native-policy.spec.ts"],
  timeout: 75_000,
  workers: 1,
  expect: { timeout: 12_000 },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    // Headless Chromium defaults to SwiftShader (software WebGL), which
    // measured ~12 FPS for this scene versus ~60 FPS with real GPU access
    // via ANGLE/D3D11 below — a measurement-environment artifact, not a
    // scene-cost regression. These flags are required for the FPS/frame-time
    // assertions in meadowrest-production-room.spec.ts to reflect real
    // rendering cost rather than the software-rasterizer floor.
    //
    // --use-angle=d3d11 is a Windows-only ANGLE backend. It must NOT be
    // forced onto every project/spec unconditionally: on a GPU-less Linux
    // CI runner (e.g. GitHub Actions ubuntu-latest, which has no GPU device
    // at all) requesting an unsupported D3D11 backend degrades Chromium's
    // GPU-process startup/fallback path, adding real rendering/input
    // latency to every test in the suite -- including the OSRS-feel
    // correction-pass tests, which have no FPS assertions and never needed
    // real GPU access in the first place. Opt in explicitly (EVERLOOM_FORCE_GPU=1,
    // set by the "test:bakeoff" script) only for the perf-measuring bakeoff
    // spec that actually depends on it; every other invocation gets
    // Chromium's normal, platform-appropriate rendering path.
    launchOptions:
      process.env.EVERLOOM_FORCE_GPU === "1"
        ? { args: ["--use-gl=angle", "--use-angle=d3d11", "--ignore-gpu-blocklist", "--enable-gpu-rasterization"] }
        : {},
  },
  projects: [
    { name: "landscape-mobile", use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 844, height: 390 }, isMobile: true } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `pnpm run dev --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
