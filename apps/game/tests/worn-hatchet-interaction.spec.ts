import { test, expect, type Page } from "@playwright/test";

// Matches the read-only bridge shape declared in GameWorld.tsx, compiled
// only under Vite's "test" mode (see playwright.gate0.config.ts). None of
// these methods mutate game state; they only report what is already true.
interface TargetDiagnostics {
  exists: boolean;
  available: boolean;
  visible: boolean;
  centre: { x: number; y: number } | null;
  outsidePoint: { x: number; y: number } | null;
}

interface ReadonlyTestBridge {
  worldReady(): boolean;
  selectedTargetId(): string | null;
  inventoryQuantity(itemId: string): number;
  target(targetId: string): TargetDiagnostics;
}

declare global {
  interface Window {
    __EVERLOOM_READONLY_TEST__?: ReadonlyTestBridge;
  }
}

const HATCHET_TARGET_ID = "ground_worn_hatchet";
const HATCHET_ITEM_ID = "worn_hatchet";

async function enterFreshWorld(page: Page) {
  // Each Playwright test already runs in its own brand-new browser context,
  // so cookies, localStorage, sessionStorage and IndexedDB all start empty
  // without any manual clearing here. `?e2e=1` is this repo's existing
  // convention (see EscapeIntro.tsx) for skipping the one-time locked
  // conversation modal that would otherwise intercept pointer input.
  await page.goto("/?e2e=1");
  await page.getByRole("button", { name: "Enter Meadowrest" }).click();
  await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true", { timeout: 35_000 });
  await expect
    .poll(() => page.evaluate(() => window.__EVERLOOM_READONLY_TEST__?.worldReady() ?? false), { timeout: 20_000 })
    .toBe(true);
}

function readTarget(page: Page, targetId: string): Promise<TargetDiagnostics> {
  return page.evaluate((id) => window.__EVERLOOM_READONLY_TEST__!.target(id), targetId);
}

function readInventoryQuantity(page: Page, itemId: string): Promise<number> {
  return page.evaluate((id) => window.__EVERLOOM_READONLY_TEST__!.inventoryQuantity(id), itemId);
}

test.describe("Worn Hatchet Interaction", () => {
  test("desktop collection: clicking the real hatchet coordinate collects it", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop-only pointer scenario.");
    await enterFreshWorld(page);

    const before = await readTarget(page, HATCHET_TARGET_ID);
    expect(before.exists).toBe(true);
    expect(before.available).toBe(true);
    expect(before.centre).not.toBeNull();
    expect(await readInventoryQuantity(page, HATCHET_ITEM_ID)).toBe(0);

    await page.mouse.click(before.centre!.x, before.centre!.y);

    await expect
      .poll(() => readInventoryQuantity(page, HATCHET_ITEM_ID), { timeout: 15_000 })
      .toBe(1);

    const after = await readTarget(page, HATCHET_TARGET_ID);
    expect(after.available).toBe(false);
  });

  test("desktop adjacent-miss: clicking outside the hitbox collects nothing", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop-only pointer scenario.");
    await enterFreshWorld(page);

    const before = await readTarget(page, HATCHET_TARGET_ID);
    expect(before.available).toBe(true);
    expect(before.outsidePoint).not.toBeNull();
    expect(await readInventoryQuantity(page, HATCHET_ITEM_ID)).toBe(0);

    await page.mouse.click(before.outsidePoint!.x, before.outsidePoint!.y);
    // No state-changing event to poll for on a miss; give the pointer
    // handler and any resulting route/activity a moment to settle instead
    // of asserting on frame zero.
    await page.waitForTimeout(500);

    expect(await readInventoryQuantity(page, HATCHET_ITEM_ID)).toBe(0);
    const after = await readTarget(page, HATCHET_TARGET_ID);
    expect(after.available).toBe(true);
    const selected = await page.evaluate(() => window.__EVERLOOM_READONLY_TEST__!.selectedTargetId());
    expect(selected).not.toBe(HATCHET_TARGET_ID);
  });

  test("mobile landscape collection: tapping the real hatchet coordinate collects it", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "landscape-mobile", "Mobile-only touch scenario.");
    await enterFreshWorld(page);

    const before = await readTarget(page, HATCHET_TARGET_ID);
    expect(before.exists).toBe(true);
    expect(before.available).toBe(true);
    expect(before.centre).not.toBeNull();
    expect(await readInventoryQuantity(page, HATCHET_ITEM_ID)).toBe(0);

    await page.touchscreen.tap(before.centre!.x, before.centre!.y);

    await expect
      .poll(() => readInventoryQuantity(page, HATCHET_ITEM_ID), { timeout: 15_000 })
      .toBe(1);

    const after = await readTarget(page, HATCHET_TARGET_ID);
    expect(after.available).toBe(false);
  });
});
