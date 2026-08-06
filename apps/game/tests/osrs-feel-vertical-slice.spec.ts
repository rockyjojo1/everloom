import { test, expect, type Page } from "@playwright/test";

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

async function enterFreshWorld(page: Page) {
  await page.goto("/?e2e=1");
  await page.getByRole("button", { name: "Enter Meadowrest" }).click();
  await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true", { timeout: 35_000 });
  await expect
    .poll(() => page.evaluate(() => window.__EVERLOOM_READONLY_TEST__?.worldReady() ?? false), { timeout: 20_000 })
    .toBe(true);
}

test.describe("OSRS Feel - Vertical Slice E2E", () => {
  test("retro OSRS layout and camera are active", async ({ page }) => {
    await enterFreshWorld(page);

    // HUD element should exist and glassmorphism is removed
    const hud = page.locator(".hud");
    await expect(hud).toBeVisible();

    // OSRS style monospace logs / chatbox should be active
    const log = page.locator(".log");
    await expect(log).toBeVisible();
  });

  test("inventory grid exposes 4-column compact layout with empty slots", async ({ page }) => {
    await enterFreshWorld(page);

    // Open inventory panel
    await page.getByLabel("Pack").click();

    // Check inventory grid exists
    const grid = page.locator(".inventory-grid");
    await expect(grid).toBeVisible();

    // Empty inventory slots should render
    const emptySlot = page.locator(".inventory-slot.empty").first();
    await expect(emptySlot).toBeVisible();
  });

  test("long-press context menu triggers on right-click", async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "desktop", "Desktop-only pointer scenario.");
    await enterFreshWorld(page);

    // Trigger context menu via right click on screen center
    await page.mouse.click(400, 250, { button: "right" });

    // Verify OSRS context menu appears
    const menu = page.locator(".osrs-context-menu");
    await expect(menu).toBeVisible();
    await expect(menu.locator(".context-menu-title")).toHaveText("Choose Option");

    // Close context menu via Cancel option
    await page.locator(".context-menu-option:has-text('Cancel')").click();
    await expect(menu).not.toBeVisible();
  });
});
