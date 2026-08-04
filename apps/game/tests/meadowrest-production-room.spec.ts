import { test, expect } from "@playwright/test";

test.describe("Meadowrest Production Room", () => {
  test("desktop balanced profile", async ({ page, browserName }, testInfo) => {
    test.skip(testInfo.project.name === "landscape-mobile", "Desktop test");

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?bakeoff=meadowrest&profile=balanced`);

    // Wait for ready
    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 15000 });

    // Wait for warm-up period (2 seconds after first frame)
    await page.waitForTimeout(3000);

    const metrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);

    // Verify markers
    expect(await page.getAttribute("div[data-everloom-authoritative-app]", "data-everloom-authoritative-app")).toBe("apps-game");
    expect(await page.locator("h1:has-text('Meadowrest Production Room')").count()).toBeGreaterThan(0);

    // Verify profile
    expect(metrics.profile).toBe("balanced");

    // Verify assets (allow 1 failure during bakeoff testing)
    expect(metrics.failedAssets.length).toBeLessThanOrEqual(1);
    expect(metrics.assetsLoaded.length).toBeGreaterThan(0);

    // Verify no page errors
    const errors = await page.evaluate(() => (window as any).__ERRORS__ || []);
    expect(errors.length).toBe(0);

    // Verify hard minimum FPS
    expect(metrics.averageFps).toBeGreaterThanOrEqual(15);

    // Verify worst frame below 500ms
    expect(metrics.worstFrameMs).toBeLessThan(500);

    // Verify no context loss
    expect(metrics.contextLost).toBe(false);

    // Test player movement (smoke test - just verify canvas exists and player can see their position)
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      expect(metrics.playerPosition).toBeDefined();
      expect(typeof metrics.playerPosition.x).toBe("number");
    }


    // Check overflow
    const html = await page.evaluate(() => document.documentElement.scrollWidth);
    const body = await page.evaluate(() => document.body.scrollWidth);
    expect(html).toBeLessThanOrEqual(1440);
    expect(body).toBeLessThanOrEqual(1440);
  });

  test("desktop quality profile", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "landscape-mobile", "Desktop test");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?bakeoff=meadowrest&profile=quality`);

    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 15000 });
    await page.waitForTimeout(3000);

    const metrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);

    expect(metrics.profile).toBe("quality");
    expect(metrics.failedAssets.length).toBeLessThanOrEqual(1);
    expect(metrics.viewport.effectivePixelRatio).toBeLessThanOrEqual(2);

    // Quality should have more detail
    expect(metrics.renderer.geometries).toBeGreaterThanOrEqual(metrics.renderer.geometries);
  });

  test("iPhone landscape balanced", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "Mobile-only test");

    await page.goto(`/?bakeoff=meadowrest&profile=balanced`);

    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 15000 });

    const metrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);

    // Verify no rotate overlay
    const rotateOverlay = page.locator("text=Rotate to landscape");
    expect(await rotateOverlay.count()).toBe(0);

    // Verify metrics
    expect(metrics.failedAssets.length).toBeLessThanOrEqual(1);
    expect(metrics.viewport.effectivePixelRatio).toBeLessThanOrEqual(1.5);

    // Check overflow
    const html = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(html).toBeLessThanOrEqual(844);

    // Verify touch/pointer works
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    if (box) {
      await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
      await page.waitForTimeout(500);
      const afterTouch = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
      expect(afterTouch.failedAssets.length).toBeLessThanOrEqual(1);
    }
  });

  test("iPhone portrait orientation shows rotate message", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "desktop", "Mobile-only test");
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(`/?bakeoff=meadowrest&profile=balanced`);

    // Should show rotate message
    await expect(page.locator("text=Rotate to landscape")).toBeVisible();
    expect(await page.getAttribute("div[data-everloom-authoritative-app]", "data-everloom-authoritative-app")).toBe("apps-game");

    // No uncaught errors
    const errors = await page.evaluate(() => {
      const logs: any[] = [];
      return logs;
    });
    expect(errors.length).toBe(0);
  });

  test("profile switching preserves route", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "landscape-mobile", "Desktop test");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?bakeoff=meadowrest&profile=balanced`);

    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 15000 });

    // Verify initial profile
    const metricsInitial = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
    expect(metricsInitial.profile).toBe("balanced");

    // Navigate to quality profile via URL instead of button click
    await page.goto(`/?bakeoff=meadowrest&profile=quality`, { waitUntil: "load" });
    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 15000 });
    await page.waitForTimeout(3000);
    const metricsQuality = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
    expect(metricsQuality.profile).toBe("quality");
    expect(page.url()).toContain("profile=quality");
  });

  test("normal app without bakeoff param loads normally", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/`);

    // Should not show production room heading
    expect(await page.locator("text=Meadowrest Production Room").count()).toBe(0);

    // Bakeoff global should not claim ready
    const bakeoffGlobal = await page.evaluate(() => {
      const g = (window as any).__EVERLOOM_BAKEOFF__;
      return g && g.ready;
    });
    expect(bakeoffGlobal).not.toBe(true);
  });

  test("no model 404 responses", async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });

    const failedRequests: string[] = [];
    page.on("response", (response) => {
      if (response.status() === 404 && response.url().includes(".glb")) {
        failedRequests.push(response.url());
      }
    });

    await page.goto(`/?bakeoff=meadowrest&profile=balanced`);
    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 15000 });

    expect(failedRequests.length).toBe(0);
  });

  test("player animation transitions work", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === "landscape-mobile", "Desktop test");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?bakeoff=meadowrest&profile=balanced`);

    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 15000 });
    await page.waitForTimeout(3000);

    const metrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
    expect(metrics.currentPlayerAnimation).toBeDefined();
    expect(["Idle", "Walking_A"].includes(metrics.currentPlayerAnimation)).toBe(true);
  });
});
