import { expect, test } from "@playwright/test";

// Runs against the production preview build (see playwright.pwa.config.ts /
// package.json `test:pwa`), same as pwa-offline.spec.ts, because the
// service-worker registration script only exists in a real production
// build -- Vite's dev server never injects it.
//
// There is no real Capacitor native bridge in a Playwright browser context.
// @capacitor/core's isNativePlatform() detects native execution by probing
// for `window.webkit.messageHandlers.bridge` (iOS) or `window.androidBridge`
// (Android), with `window.CapacitorCustomPlatform` as an explicit override
// hook. Setting that override before any page script runs is the
// documented way to make the exact same @capacitor/core build behave as if
// it were running inside the native iOS wrapper, which is what these tests
// use to prove the platform-conditional code path without needing a real
// device.

test.describe("Capacitor native-vs-web platform policy", () => {
  test("simulated native platform: service worker registration is disabled", async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-expect-error -- test-only global override, see file header
      window.CapacitorCustomPlatform = { name: "ios" };
    });

    await page.goto("/?e2e=1");
    await page.getByRole("button", { name: "Enter Meadowrest" }).click();
    await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true", { timeout: 35_000 });

    // Give the window `load` event (and any registration attempt it would
    // trigger) time to fire, then assert nothing got registered.
    await page.waitForLoadState("load");
    await page.waitForTimeout(500);

    const registrationCount = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return 0;
      const registrations = await navigator.serviceWorker.getRegistrations();
      return registrations.length;
    });
    expect(registrationCount).toBe(0);
  });

  test("simulated native platform: normal app behaviour is unaffected", async ({ page }) => {
    await page.addInitScript(() => {
      // @ts-expect-error -- test-only global override, see file header
      window.CapacitorCustomPlatform = { name: "ios" };
    });

    await page.goto("/?e2e=1");
    await expect(page.getByRole("button", { name: "Enter Meadowrest" })).toBeVisible();
    await page.getByRole("button", { name: "Enter Meadowrest" }).click();
    await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true", { timeout: 35_000 });
  });

  test("normal web platform: service worker registration still proceeds (regression guard)", async ({ page }) => {
    await page.goto("/?e2e=1");
    await page.getByRole("button", { name: "Enter Meadowrest" }).click();
    await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true", { timeout: 35_000 });

    await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) throw new Error("Service workers are unavailable.");
      await navigator.serviceWorker.ready;
    });

    const registrationCount = await page.evaluate(async () => (await navigator.serviceWorker.getRegistrations()).length);
    expect(registrationCount).toBeGreaterThan(0);
  });
});
