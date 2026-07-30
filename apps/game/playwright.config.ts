import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  timeout: 75_000,
  workers: 1,
  expect: { timeout: 12_000 },
  use: {
    baseURL: "http://127.0.0.1:4310",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "landscape-mobile", use: { ...devices["iPhone 13"], browserName: "chromium", viewport: { width: 844, height: 390 }, isMobile: true } },
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } },
  ],
  webServer: {
    command: "pnpm run dev --host 127.0.0.1",
    url: "http://127.0.0.1:4310",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
