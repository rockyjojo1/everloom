import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 120_000,
  workers: 1,
  expect: { timeout: 20_000 },
  use: {
    baseURL: "http://127.0.0.1:4311",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "pwa-desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1280, height: 720 } } },
  ],
  webServer: {
    command: "pnpm run preview --host 127.0.0.1",
    url: "http://127.0.0.1:4311",
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
