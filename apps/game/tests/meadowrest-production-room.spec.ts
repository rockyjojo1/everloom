import { test, expect } from "@playwright/test";

// Seven required logical cases, each executed exactly once via project-aware
// skips: desktop balanced, desktop quality, iPhone landscape balanced,
// iPhone landscape quality, portrait orientation, profile switching, and
// normal-app isolation run on "desktop"; the two iPhone-landscape cases also
// exist to be run for real on the "landscape-mobile" project, so those two
// specifically execute on landscape-mobile instead of desktop. Two extra
// coverage tests (no model 404s, animation transitions) run on desktop only.
test.describe("Meadowrest Production Room", () => {
  test("desktop balanced profile", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Required logical case runs once, on desktop");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?bakeoff=meadowrest&profile=balanced`);

    // Wait for ready
    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 12000 });

    // The metrics collector excludes a 2s warm-up window (first-frame shader
    // compilation, texture/geometry GPU upload) from its FPS samples by
    // design. Reading averageFps immediately at "ready" catches that warm-up
    // transient, not steady-state cost, and fails spuriously. Wait past it.
    // Waiting only for frameSamples to reach some count is not sufficient:
    // that count can be satisfied *during* the collector's internal 2s
    // warm-up window, before its one-time sample-array reset -- still
    // capturing first-frame shader-compilation cost as a "worst frame".
    // Wait past the fixed 2s warm-up first, then require a fresh batch of
    // real post-reset samples.
    await page.waitForTimeout(2500);
    await page.waitForFunction(() => ((window as any).__EVERLOOM_BAKEOFF__?.frameSamples ?? 0) >= 30, { timeout: 8000 });

    const metrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);

    // Verify markers
    expect(await page.getAttribute("div[data-everloom-authoritative-app]", "data-everloom-authoritative-app")).toBe("apps-game");
    expect(await page.locator("h1:has-text('Meadowrest Production Room')").count()).toBeGreaterThan(0);

    // Verify profile
    expect(metrics.profile).toBe("balanced");

    // Verify assets - ZERO failures required
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

    // Test player movement. A larger screen-space offset guarantees the
    // ground raycast lands comfortably past the 1.5-unit threshold this
    // asserts on -- a 50px offset previously produced only ~1.42 world
    // units at this isometric camera angle, an intermittent near-miss.
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.mouse.click(box.x + box.width / 2 + 180, box.y + box.height / 2 + 110);
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
    await expect(resetButton).toBeVisible();
    const resetBox = await resetButton.boundingBox();
    expect(resetBox?.height).toBeGreaterThanOrEqual(40);
    await resetButton.click();
    await page.waitForTimeout(500);
    const resetMetrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
    expect(Math.abs(resetMetrics.playerPosition.x)).toBeLessThan(0.5);
    expect(Math.abs(resetMetrics.playerPosition.z + 5)).toBeLessThan(0.5);
    expect(resetMetrics.currentPlayerAnimation).toBe("Idle");
    expect(resetMetrics.movementTarget).toBeNull();

    // Check overflow
    const html = await page.evaluate(() => document.documentElement.scrollWidth);
    const body = await page.evaluate(() => document.body.scrollWidth);
    expect(html).toBeLessThanOrEqual(1440);
    expect(body).toBeLessThanOrEqual(1440);
  });

  test("desktop quality profile", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Required logical case runs once, on desktop");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?bakeoff=meadowrest&profile=quality`);

    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 12000 });
    // Waiting only for frameSamples to reach some count is not sufficient:
    // that count can be satisfied *during* the collector's internal 2s
    // warm-up window, before its one-time sample-array reset -- still
    // capturing first-frame shader-compilation cost as a "worst frame".
    // Wait past the fixed 2s warm-up first, then require a fresh batch of
    // real post-reset samples.
    await page.waitForTimeout(2500);
    await page.waitForFunction(() => ((window as any).__EVERLOOM_BAKEOFF__?.frameSamples ?? 0) >= 30, { timeout: 8000 });

    const metrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);

    expect(metrics.profile).toBe("quality");
    expect(metrics.failedAssets.length).toBe(0);
    expect(metrics.viewport.effectivePixelRatio).toBeLessThanOrEqual(2);
    expect(metrics.averageFps).toBeGreaterThanOrEqual(15);
    expect(metrics.worstFrameMs).toBeLessThan(500);
    expect(metrics.contextLost).toBe(false);
  });

  test("iPhone landscape balanced", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "landscape-mobile", "Required logical case runs once, on landscape-mobile");
    await page.goto(`/?bakeoff=meadowrest&profile=balanced`);

    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 12000 });
    // Waiting only for frameSamples to reach some count is not sufficient:
    // that count can be satisfied *during* the collector's internal 2s
    // warm-up window, before its one-time sample-array reset -- still
    // capturing first-frame shader-compilation cost as a "worst frame".
    // Wait past the fixed 2s warm-up first, then require a fresh batch of
    // real post-reset samples.
    await page.waitForTimeout(2500);
    await page.waitForFunction(() => ((window as any).__EVERLOOM_BAKEOFF__?.frameSamples ?? 0) >= 30, { timeout: 8000 });

    const metrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);

    // Verify no rotate overlay
    const rotateOverlay = page.locator("text=Rotate to landscape");
    expect(await rotateOverlay.count()).toBe(0);

    // Verify metrics
    expect(metrics.failedAssets.length).toBe(0);
    expect(metrics.viewport.effectivePixelRatio).toBeLessThanOrEqual(1.5);
    expect(metrics.averageFps).toBeGreaterThanOrEqual(15);
    expect(metrics.worstFrameMs).toBeLessThan(500);

    // Check overflow
    const html = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(html).toBeLessThanOrEqual(844);

    // Verify touch movement produces the same real state transitions as
    // desktop pointer movement: distance travelled, Walking_A while moving,
    // Idle on arrival -- not merely "assets still loaded".
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      // The metrics overlay panel is a 340px-wide fixed element over the
      // right side of the canvas at this viewport width (844x390); a tap
      // landing on it never reaches the canvas's pointerdown listener at
      // all. Canvas is 844 wide, overlay starts at x=504, so the offset
      // below (center + 60 = 482) stays clear of it with margin.
      const startPos = { x: metrics.playerPosition.x, z: metrics.playerPosition.z };
      const tapX = box.x + box.width / 2 + 60;
      const tapY = box.y + box.height / 2 + 50;

      // CDP's synthetic input dispatch under mobile-emulated (isMobile:true)
      // contexts intermittently fails to register as a pointerdown on the
      // canvas -- confirmed by running the exact same tap in a loop and
      // observing movementTarget stay null on roughly half of otherwise
      // identical runs, unrelated to coordinates or overlay position. This
      // retries the real dispatch (never fabricates the resulting state)
      // until movementTarget is confirmed non-null, so the assertions below
      // always observe an actual triggered movement.
      let dispatched = false;
      for (let attempt = 0; attempt < 5 && !dispatched; attempt++) {
        await page.touchscreen.tap(tapX, tapY);
        try {
          await page.waitForFunction(
            () => (window as any).__EVERLOOM_BAKEOFF__?.movementTarget !== null,
            { timeout: 500 }
          );
          dispatched = true;
        } catch {
          // Tap didn't register; retry.
        }
      }
      expect(dispatched).toBe(true);

      // currentPlayerAnimation is set to "Walking_A" synchronously inside
      // the pointer-down handler, before any movement/physics tick runs.
      const duringMove = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
      expect(duringMove.failedAssets.length).toBe(0);
      expect(duringMove.currentPlayerAnimation).toBe("Walking_A");

      await page.waitForFunction(() => {
        const m = (window as any).__EVERLOOM_BAKEOFF__;
        return m.currentPlayerAnimation === "Idle";
      }, { timeout: 10000 });

      const afterMove = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
      const distance = Math.sqrt(
        Math.pow(afterMove.playerPosition.x - startPos.x, 2) + Math.pow(afterMove.playerPosition.z - startPos.z, 2)
      );
      expect(distance).toBeGreaterThan(1.5);
      expect(afterMove.currentPlayerAnimation).toBe("Idle");
    }
  });

  test("iPhone landscape quality", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "landscape-mobile", "Required logical case runs once, on landscape-mobile");
    await page.goto(`/?bakeoff=meadowrest&profile=quality`);

    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 12000 });
    // Waiting only for frameSamples to reach some count is not sufficient:
    // that count can be satisfied *during* the collector's internal 2s
    // warm-up window, before its one-time sample-array reset -- still
    // capturing first-frame shader-compilation cost as a "worst frame".
    // Wait past the fixed 2s warm-up first, then require a fresh batch of
    // real post-reset samples.
    await page.waitForTimeout(2500);
    await page.waitForFunction(() => ((window as any).__EVERLOOM_BAKEOFF__?.frameSamples ?? 0) >= 30, { timeout: 8000 });

    const metrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);

    expect(metrics.profile).toBe("quality");
    expect(metrics.failedAssets.length).toBe(0);
    expect(metrics.viewport.effectivePixelRatio).toBeLessThanOrEqual(2);
    expect(metrics.averageFps).toBeGreaterThanOrEqual(15);
    expect(metrics.worstFrameMs).toBeLessThan(500);
  });

  test("iPhone portrait orientation shows rotate message", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Required logical case runs once, on desktop (viewport set explicitly)");
    await page.setViewportSize({ width: 390, height: 844 });

    await page.goto(`/?bakeoff=meadowrest&profile=balanced`);

    // Should show rotate message
    await expect(page.locator("text=Rotate to landscape")).toBeVisible();
    expect(await page.getAttribute("div[data-everloom-authoritative-app]", "data-everloom-authoritative-app")).toBe("apps-game");

    // Controls must be hidden in portrait
    expect(await page.locator("button:has-text('Reset view')").count()).toBe(0);

    // No horizontal overflow
    const html = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(html).toBeLessThanOrEqual(390);
  });

  test("profile switching preserves route", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Required logical case runs once, on desktop");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?bakeoff=meadowrest&profile=balanced`);

    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 12000 });

    // Verify initial profile
    const metricsInitial = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
    expect(metricsInitial.profile).toBe("balanced");

    // Navigate to quality profile via URL
    await page.goto(`/?bakeoff=meadowrest&profile=quality`, { waitUntil: "load" });
    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 12000 });
    const metricsQuality = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
    expect(metricsQuality.profile).toBe("quality");
    expect(page.url()).toContain("profile=quality");
    expect(metricsQuality.failedAssets.length).toBe(0);
  });

  test("normal app without bakeoff param loads normally", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Required logical case runs once, on desktop");
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

  test("no model 404 responses", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Coverage test, desktop only");
    await page.setViewportSize({ width: 1440, height: 900 });

    const failedRequests: string[] = [];
    page.on("response", (response) => {
      if (response.status() === 404 && response.url().includes(".glb")) {
        failedRequests.push(response.url());
      }
    });

    await page.goto(`/?bakeoff=meadowrest&profile=balanced`);
    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 12000 });

    expect(failedRequests.length).toBe(0);
  });

  test("player animation transitions work", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Coverage test, desktop only");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?bakeoff=meadowrest&profile=balanced`);

    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 12000 });

    const metrics1 = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
    expect(metrics1.currentPlayerAnimation).toBe("Idle");

    // Click to move
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    if (box) {
      await page.mouse.click(box.x + box.width / 2 + 100, box.y + box.height / 2 + 50);
      await page.waitForTimeout(500);

      const metrics2 = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
      expect(metrics2.currentPlayerAnimation).toBe("Walking_A");

      // Wait for movement to complete and return to Idle
      await page.waitForFunction(() => {
        const m = (window as any).__EVERLOOM_BAKEOFF__;
        return m.currentPlayerAnimation === "Idle";
      }, { timeout: 10000 });

      const metricsAfter = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
      expect(metricsAfter.currentPlayerAnimation).toBe("Idle");
    }
  });
});
