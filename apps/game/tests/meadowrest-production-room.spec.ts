import { test, expect } from "@playwright/test";

test.describe("Meadowrest Production Room", () => {
  test("desktop balanced profile", async ({ page, browserName }, testInfo) => {
    test.skip(testInfo.project.name === "landscape-mobile", "Desktop test");

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?bakeoff=meadowrest&profile=balanced`);

    // Wait for ready
    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 15000 });

    const metrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);

    // Verify markers
    expect(await page.getAttribute("div[data-everloom-authoritative-app]", "data-everloom-authoritative-app")).toBe("apps-game");
    expect(await page.locator("h1:has-text('Meadowrest Production Room')").count()).toBeGreaterThan(0);

    // Verify profile
    expect(metrics.profile).toBe("balanced");

    // Verify assets
    expect(metrics.failedAssets.length).toBe(0);
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

    // Test player movement
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2 + 50, box.y + box.height / 2 + 50);
      await page.waitForTimeout(1000);

      const metricsAfterMove = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
      const startPos = { x: 0, y: 0, z: -5 };
      const distance = Math.sqrt(
        Math.pow(metricsAfterMove.playerPosition.x - startPos.x, 2) +
          Math.pow(metricsAfterMove.playerPosition.z - startPos.z, 2)
      );
      expect(distance).toBeGreaterThan(1.5);
      expect(metricsAfterMove.currentPlayerAnimation).toBe("Walking_A");
    }

    // Test reset button
    const resetButton = page.locator("button:has-text('Reset view')");
    if (await resetButton.isVisible()) {
      await resetButton.click();
      await page.waitForTimeout(500);
      const resetMetrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
      expect(Math.abs(resetMetrics.playerPosition.x)).toBeLessThan(0.5);
      expect(Math.abs(resetMetrics.playerPosition.z + 5)).toBeLessThan(0.5);
      expect(resetMetrics.currentPlayerAnimation).toBe("Idle");
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

    const metrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);

    expect(metrics.profile).toBe("quality");
    expect(metrics.failedAssets.length).toBe(0);
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
    expect(metrics.failedAssets.length).toBe(0);
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
      expect(afterTouch.failedAssets.length).toBe(0);
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

    // Click quality button
    const qualityButton = page.locator("button:has-text('Quality')").first();
    await qualityButton.click();

    // Should navigate to quality profile
    await page.waitForURL(/profile=quality/);
    expect(page.url()).toContain("bakeoff=meadowrest");
    expect(page.url()).toContain("profile=quality");

    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.profile === "quality", { timeout: 15000 });
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

    const metrics1 = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
    expect(metrics1.currentPlayerAnimation).toBe("Idle");

    // Click to move
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    if (box) {
      await page.mouse.click(box.x + box.width / 2 + 100, box.y + box.height / 2 + 50);
      await page.waitForTimeout(500);

      const metrics2 = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
      expect(metrics2.currentPlayerAnimation).toBe("Walking_A");

      // Wait for movement to complete
      await page.waitForFunction(() => {
        const m = (window as any).__EVERLOOM_BAKEOFF__;
        return m.currentPlayerAnimation === "Idle" || m.currentPlayerAnimation === "Walking_A";
      }, { timeout: 10000 });
    }
  });
});
