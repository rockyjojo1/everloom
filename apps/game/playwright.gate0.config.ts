import { defineConfig, devices } from "@playwright/test";

// Dedicated config for the Worn Hatchet interaction spec. Runs Vite in its
// own "test" mode (see vite.config.ts / import.meta.env.MODE) so the
// read-only __EVERLOOM_READONLY_TEST__ bridge in GameWorld.tsx compiles in,
// on a separate port so it never collides with the main dev server used by
// playwright.config.ts.
const port = Number(process.env.EVERLOOM_GATE0_PORT ?? 4312);

export default defineConfig({
  testDir: "./tests",
  testMatch: /worn-hatchet-interaction\.spec\.ts/,
  timeout: 75_000,
  workers: 1,
  expect: { timeout: 12_000 },
  use: {
    baseURL: `http://127.0.0.1:${port}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "landscape-mobile", use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 844, height: 390 }, isMobile: true } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: `vite --mode test --host 127.0.0.1 --port ${port}`,
    url: `http://127.0.0.1:${port}`,
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
