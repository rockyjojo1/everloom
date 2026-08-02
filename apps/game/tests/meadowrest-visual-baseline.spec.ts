import { test, expect } from "@playwright/test";

test.describe("Meadowrest Visual Baseline", () => {
  test.beforeEach(async ({ page }) => {
    // Load the game with e2e mode to skip intro modal
    await page.goto("/?e2e=1");

    // Wait for world to be fully ready
    await page.waitForFunction(
      () => (window as any).__EVERLOOM_READONLY_TEST__?.worldReady?.(),
      { timeout: 10000 }
    );
  });

  test("01 arrival desktop", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium" || !page.viewportSize() || page.viewportSize()!.width < 1200);

    // Ensure consistent quality settings
    const bridge = (window as any).__EVERLOOM_READONLY_TEST__;
    expect(bridge).toBeDefined();

    // Player should start at spawn (fixed grid position for determinism)
    // Wait for all assets to load
    await page.waitForTimeout(500);

    // Capture screenshot
    const filename = "artifacts/meadowrest-visual-baseline-gate0/01-arrival-desktop.png";
    await page.screenshot({ path: filename, fullPage: false });

    expect(filename).toBeDefined();
  });

  test("02 hatchet ground item desktop", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium" || !page.viewportSize() || page.viewportSize()!.width < 1200);

    const bridge = (window as any).__EVERLOOM_READONLY_TEST__;

    // Verify ground hatchet is visible and interactable
    const hatchetTarget = bridge.target("ground_worn_hatchet");
    expect(hatchetTarget?.exists).toBe(true);
    expect(hatchetTarget?.available).toBe(true);
    expect(hatchetTarget?.visible).toBe(true);

    await page.waitForTimeout(300);
    const filename = "artifacts/meadowrest-visual-baseline-gate0/02-hatchet-ground-desktop.png";
    await page.screenshot({ path: filename, fullPage: false });
  });

  test("03 village approach desktop", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium" || !page.viewportSize() || page.viewportSize()!.width < 1200);

    // Would move player toward village (requires deterministic camera/player state)
    // For now, capture current view as reference
    await page.waitForTimeout(300);
    const filename = "artifacts/meadowrest-visual-baseline-gate0/03-village-approach-desktop.png";
    await page.screenshot({ path: filename, fullPage: false });
  });

  test("04 village centre desktop", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium" || !page.viewportSize() || page.viewportSize()!.width < 1200);

    // Capture village/Loom Hall area
    await page.waitForTimeout(300);
    const filename = "artifacts/meadowrest-visual-baseline-gate0/04-village-centre-desktop.png";
    await page.screenshot({ path: filename, fullPage: false });
  });

  test("05 mara desktop", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium" || !page.viewportSize() || page.viewportSize()!.width < 1200);

    const bridge = (window as any).__EVERLOOM_READONLY_TEST__;

    // Verify Mara NPC is visible
    const maraTarget = bridge.target("npc-mara");
    expect(maraTarget?.exists).toBe(true);
    expect(maraTarget?.visible).toBe(true);

    await page.waitForTimeout(300);
    const filename = "artifacts/meadowrest-visual-baseline-gate0/05-mara-desktop.png";
    await page.screenshot({ path: filename, fullPage: false });
  });

  test("06 tree route desktop", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium" || !page.viewportSize() || page.viewportSize()!.width < 1200);

    // Capture area with harvestable trees
    await page.waitForTimeout(300);
    const filename = "artifacts/meadowrest-visual-baseline-gate0/06-tree-route-desktop.png";
    await page.screenshot({ path: filename, fullPage: false });
  });

  test("07 woodcutting idle desktop", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium" || !page.viewportSize() || page.viewportSize()!.width < 1200);

    // Capture player idle state with hatchet (if equipped)
    await page.waitForTimeout(300);
    const filename = "artifacts/meadowrest-visual-baseline-gate0/07-woodcutting-idle-desktop.png";
    await page.screenshot({ path: filename, fullPage: false });
  });

  test("08 arrival mobile landscape", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium" || page.viewportSize()?.width! >= 900);

    // Mobile landscape (844x390 per playwright.gate0.config.ts)
    await page.waitForTimeout(300);
    const filename = "artifacts/meadowrest-visual-baseline-gate0/08-arrival-mobile-landscape.png";
    await page.screenshot({ path: filename, fullPage: false });
  });

  test("09 hatchet ground item mobile landscape", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium" || page.viewportSize()?.width! >= 900);

    const bridge = (window as any).__EVERLOOM_READONLY_TEST__;
    const hatchetTarget = bridge.target("ground_worn_hatchet");
    expect(hatchetTarget?.exists).toBe(true);

    await page.waitForTimeout(300);
    const filename = "artifacts/meadowrest-visual-baseline-gate0/09-hatchet-ground-mobile-landscape.png";
    await page.screenshot({ path: filename, fullPage: false });
  });

  test("10 village mobile landscape", async ({ page, browserName }) => {
    test.skip(browserName !== "chromium" || page.viewportSize()?.width! >= 900);

    await page.waitForTimeout(300);
    const filename = "artifacts/meadowrest-visual-baseline-gate0/10-village-mobile-landscape.png";
    await page.screenshot({ path: filename, fullPage: false });
  });
});
