import { test, expect } from "@playwright/test";
import { getProductionRoomLayout } from "../src/bakeoff/productionRoomLayout";

const BALANCED_EXPECTED_CASTERS = [
  "player",
  "mara",
  "skeleton",
  "cottage-main",
  "bridge-main",
  "campfire-main",
  "oak-a",
  "oak-b",
  "oak-c",
  "canopy-northwest",
].sort();

function getQualityExpectedCasters(): string[] {
  const layout = getProductionRoomLayout("quality");
  const nonAdditionalPlacementIds = layout.placements
    .filter((p) => !p.instance.startsWith("additional-") && !p.instance.startsWith("water-"))
    .map((p) => p.instance);
  return [...nonAdditionalPlacementIds, "player", "mara", "skeleton"].sort();
}

function getExpectedInstanceIds(profile: "balanced" | "quality"): string[] {
  const layout = getProductionRoomLayout(profile);
  const placementIds = layout.placements.map((p) => p.instance);
  return [
    ...placementIds,
    "player",
    "mara",
    "skeleton",
    "mara-shawl",
    "player-idle-action",
    "player-walking-a-action",
    "mara-idle-action",
    "skeleton-idle-action",
    "grass",
    "ground",
    "water",
  ].sort();
}

/**
 * Gate 4 Audit Test Suite
 *
 * These tests expose and validate fixes for the 8 remaining blockers:
 * 1. Real page/console error collection
 * 2. Profile button clicks (not page.goto)
 * 3. Portrait rotation lifecycle
 * 4. Keyboard movement
 * 5. Shawl bone attachment
 * 6. Grass and shadow counts
 * 7. Readiness after first frame
 * 8. Asset set equality and single canvas
 */

test.describe("Gate 4 Audit — Remaining Blockers", () => {
  // BLOCKER 1: Real page and console error collection
  test("collects actual page and console errors", async ({ page }) => {
    test.skip(page.context().browser()?.browserType().name() !== "chromium", "Desktop only");
    await page.setViewportSize({ width: 1440, height: 900 });

    const pageErrors: string[] = [];
    const consoleErrors: string[] = [];

    page.on("pageerror", (err) => pageErrors.push(err.toString()));
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });

    await page.goto(`/?bakeoff=meadowrest&profile=balanced`);
    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 12000 });

    // Hard requirement: no page or console errors
    expect(pageErrors, `Page errors collected: ${pageErrors.join(", ")}`).toHaveLength(0);
    expect(consoleErrors, `Console errors collected: ${consoleErrors.join(", ")}`).toHaveLength(0);
  });

  // BLOCKER 2: Profile button clicks (not page.goto)
  test("profile buttons trigger page reload with new profile", async ({ page }) => {
    test.skip(page.context().browser()?.browserType().name() !== "chromium", "Desktop only");
    await page.setViewportSize({ width: 1440, height: 900 });

    // Load balanced
    await page.goto(`/?bakeoff=meadowrest&profile=balanced`);
    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 12000 });
    let metrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
    expect(metrics.profile).toBe("balanced");

    // Click Quality button (visible button, not page.goto)
    const qualityButton = page.locator("button:has-text('Quality')");
    await expect(qualityButton).toBeVisible();
    await qualityButton.click();

    // Wait for reload and new ready state with quality profile
    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 12000 });
    await page.waitForTimeout(2500);
    await page.waitForFunction(() => ((window as any).__EVERLOOM_BAKEOFF__?.frameSamples ?? 0) >= 30, { timeout: 8000 });

    metrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
    expect(metrics.profile).toBe("quality");

    // Verify URL contains profile=quality
    expect(page.url()).toContain("profile=quality");
    expect(page.url()).toContain("bakeoff=meadowrest");

    // Click back to Balanced
    const balancedButton = page.locator("button:has-text('Balanced')");
    await expect(balancedButton).toBeVisible();
    await balancedButton.click();

    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 12000 });
    metrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
    expect(metrics.profile).toBe("balanced");
    expect(page.url()).toContain("profile=balanced");
  });

  // BLOCKER 3: Portrait rotation lifecycle
  test("portrait to landscape to portrait remounting", async ({ page }) => {
    test.skip(page.context().browser()?.browserType().name() !== "chromium", "Desktop only");

    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.toString()));

    // Start in portrait
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`/?bakeoff=meadowrest&profile=balanced`);

    // Confirm portrait overlay, no canvas
    const portraitOverlay = page.locator("text=Rotate to landscape");
    await expect(portraitOverlay).toBeVisible();
    const canvas = page.locator("canvas").first();
    await expect(canvas).not.toBeVisible();

    // Rotate to landscape
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 12000 });

    // Confirm canvas visible
    await expect(canvas).toBeVisible();

    // Verify no React errors on rotation
    expect(pageErrors).toHaveLength(0);

    // Rotate back to portrait
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);

    // Confirm portrait overlay returns
    await expect(portraitOverlay).toBeVisible();

    // Rotate to landscape again
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 12000 });

    // Confirm exactly one canvas
    const canvasCount = await page.locator("canvas").count();
    expect(canvasCount).toBe(1);

    // Verify no page errors through full rotation
    expect(pageErrors).toHaveLength(0);
  });

  // BLOCKER 4: Keyboard movement
  test("keyboard movement triggers walking animation", async ({ page }) => {
    test.skip(page.context().browser()?.browserType().name() !== "chromium", "Desktop only");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?bakeoff=meadowrest&profile=balanced`);

    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 12000 });
    let metrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
    const startPos = { x: metrics.playerPosition.x, z: metrics.playerPosition.z };

    // Press W (ArrowUp)
    await page.keyboard.press("KeyW");
    await page.waitForTimeout(100);

    // Verify movement target changed
    metrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
    expect(metrics.movementTarget).not.toBeNull();
    expect(metrics.currentPlayerAnimation).toBe("Walking_A");

    // Wait for movement
    await page.waitForTimeout(500);

    metrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
    const distanceMoved = Math.sqrt(
      Math.pow(metrics.playerPosition.x - startPos.x, 2) +
        Math.pow(metrics.playerPosition.z - startPos.z, 2)
    );
    expect(distanceMoved).toBeGreaterThan(0.5);

    // Wait for arrival
    await page.waitForTimeout(2000);
    metrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
    expect(metrics.currentPlayerAnimation).toBe("Idle");
    expect(metrics.movementTarget).toBeNull();
  });

  // BLOCKER 5: Shawl bone attachment
  test("Mara shawl attached to chest bone, not root", async ({ page }) => {
    test.skip(page.context().browser()?.browserType().name() !== "chromium", "Desktop only");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?bakeoff=meadowrest&profile=balanced`);

    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 12000 });

    const metrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);

    // Shawl must be loaded
    expect(metrics.assetsLoaded).toContain("custom.npc-mara-shawl");

    // Exposure: maraShawlAttached boolean
    expect(metrics.maraShawlAttached, "Shawl must be attached to a bone").toBe(true);

    // Exposure: maraShawlParentBone string
    const approvedBones = ["chest", "spine"];
    expect(
      approvedBones,
      `Shawl parent bone must be one of: ${approvedBones.join(", ")}, got: ${metrics.maraShawlParentBone}`
    ).toContain(metrics.maraShawlParentBone);
  });

  // BLOCKER 6: Grass and shadow counts
  test("balanced profile creates 100 grass instances", async ({ page }) => {
    test.skip(page.context().browser()?.browserType().name() !== "chromium", "Desktop only");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?bakeoff=meadowrest&profile=balanced`);

    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 12000 });

    const metrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);

    // Exposure: grassInstances count
    expect(metrics.grassInstances, "Balanced must have exactly 100 grass instances").toBe(100);

    // Additional counts
    expect(metrics.additionalTrees).toBe(6);
    expect(metrics.additionalRocks).toBe(10);
  });

  test("quality profile creates 220 grass instances", async ({ page }) => {
    test.skip(page.context().browser()?.browserType().name() !== "chromium", "Desktop only");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?bakeoff=meadowrest&profile=quality`);

    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 12000 });

    const metrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);

    // Exposure: grassInstances count
    expect(metrics.grassInstances, "Quality must have exactly 220 grass instances").toBe(220);

    // Additional counts
    expect(metrics.additionalTrees).toBe(12);
    expect(metrics.additionalRocks).toBe(20);
  });

  test("balanced shadowCasterInstanceIds exactly equals the contractual 10-ID set", async ({ page }) => {
    test.skip(page.context().browser()?.browserType().name() !== "chromium", "Desktop only");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?bakeoff=meadowrest&profile=balanced`);

    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 12000 });

    const metrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
    const actual = [...metrics.shadowCasterInstanceIds].sort();

    expect(
      actual,
      `Balanced shadowCasterInstanceIds must exactly equal ${JSON.stringify(BALANCED_EXPECTED_CASTERS)}, got ${JSON.stringify(actual)}`
    ).toEqual(BALANCED_EXPECTED_CASTERS);
  });

  test("quality shadowCasterInstanceIds exactly equals every non-additional layout placement plus characters", async ({ page }) => {
    test.skip(page.context().browser()?.browserType().name() !== "chromium", "Desktop only");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?bakeoff=meadowrest&profile=quality`);

    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 12000 });

    const metrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
    const actual = [...metrics.shadowCasterInstanceIds].sort();
    const expected = getQualityExpectedCasters();

    expect(
      actual,
      `Quality shadowCasterInstanceIds must exactly equal the derived set. Missing: ${expected.filter((id) => !actual.includes(id)).join(", ") || "none"}. Extra: ${actual.filter((id: string) => !expected.includes(id)).join(", ") || "none"}`
    ).toEqual(expected);
  });

  test("balanced placement-level readiness is exactly 70/70/0", async ({ page }) => {
    test.skip(page.context().browser()?.browserType().name() !== "chromium", "Desktop only");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?bakeoff=meadowrest&profile=balanced`);

    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 12000 });

    const metrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
    const expected = getExpectedInstanceIds("balanced");
    const loaded = [...metrics.loadedInstanceIds].sort();

    expect(expected.length, "Balanced expectedInstanceIds contract must be 70").toBe(70);
    expect(metrics.expectedInstanceIds.length, "Balanced expectedInstanceIds length").toBe(70);
    expect(metrics.loadedInstanceIds.length, "Balanced loadedInstanceIds length").toBe(70);
    expect(metrics.failedInstanceIds, "Balanced failedInstanceIds must be empty").toEqual([]);
    expect(loaded, "Balanced loadedInstanceIds must exactly equal expected set").toEqual(expected);
  });

  test("quality placement-level readiness is exactly 86/86/0", async ({ page }) => {
    test.skip(page.context().browser()?.browserType().name() !== "chromium", "Desktop only");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?bakeoff=meadowrest&profile=quality`);

    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 12000 });

    const metrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
    const expected = getExpectedInstanceIds("quality");
    const loaded = [...metrics.loadedInstanceIds].sort();

    expect(expected.length, "Quality expectedInstanceIds contract must be 86").toBe(86);
    expect(metrics.expectedInstanceIds.length, "Quality expectedInstanceIds length").toBe(86);
    expect(metrics.loadedInstanceIds.length, "Quality loadedInstanceIds length").toBe(86);
    expect(metrics.failedInstanceIds, "Quality failedInstanceIds must be empty").toEqual([]);
    expect(loaded, "Quality loadedInstanceIds must exactly equal expected set").toEqual(expected);
  });

  // BLOCKER 7: Ready after first frame render
  test("ready state set only after first complete frame", async ({ page }) => {
    test.skip(page.context().browser()?.browserType().name() !== "chromium", "Desktop only");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?bakeoff=meadowrest&profile=balanced`);

    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 12000 });

    const metrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);

    // Exposure: firstCompleteFrameRendered boolean
    expect(metrics.firstCompleteFrameRendered, "Ready must only be set after first frame renders").toBe(true);
  });

  // BLOCKER 8: Asset set equality
  test("assets loaded equals assets expected (set equality, not just length)", async ({ page }) => {
    test.skip(page.context().browser()?.browserType().name() !== "chromium", "Desktop only");
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/?bakeoff=meadowrest&profile=balanced`);

    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 12000 });

    const metrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);

    // Exact set equality: same IDs, nothing extra, nothing missing
    const loaded = new Set(metrics.assetsLoaded);
    const expected = new Set(metrics.assetsExpected);

    expect(loaded.size).toBe(expected.size);
    for (const id of expected) {
      expect(loaded, `Asset expected but not loaded: ${id}`).toContain(id);
    }
    for (const id of loaded) {
      expect(expected, `Asset loaded but not expected: ${id}`).toContain(id);
    }

    // No failures
    expect(metrics.failedAssets).toHaveLength(0);
  });

  // BLOCKER 9: Single canvas and clean remount
  test("single canvas after landscape → portrait → landscape remount", async ({ page }) => {
    test.skip(page.context().browser()?.browserType().name() !== "chromium", "Desktop only");

    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto(`/?bakeoff=meadowrest&profile=balanced`);
    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 12000 });

    let canvasCount = await page.locator("canvas").count();
    expect(canvasCount).toBe(1);

    // Portrait
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    canvasCount = await page.locator("canvas").count();
    expect(canvasCount).toBe(0);

    // Back to landscape
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 12000 });
    canvasCount = await page.locator("canvas").count();
    expect(canvasCount, "Exactly one canvas after remount").toBe(1);

    // No WebGL context loss
    const metrics = await page.evaluate(() => (window as any).__EVERLOOM_BAKEOFF__);
    expect(metrics.contextLost).toBe(false);
  });

  // BLOCKER 10: Complete 404 tracking
  test("tracks all /models/ 404s not just .glb", async ({ page }) => {
    test.skip(page.context().browser()?.browserType().name() !== "chromium", "Desktop only");
    await page.setViewportSize({ width: 1440, height: 900 });

    const model404s: string[] = [];
    page.on("response", (res) => {
      if (res.status() === 404 && res.url().includes("/models/")) {
        model404s.push(res.url());
      }
    });

    await page.goto(`/?bakeoff=meadowrest&profile=balanced`);
    await page.waitForFunction(() => (window as any).__EVERLOOM_BAKEOFF__?.ready === true, { timeout: 12000 });

    // Hard requirement: zero 404s on any model path
    expect(model404s, `Model 404s detected: ${model404s.join(", ")}`).toHaveLength(0);
  });
});
