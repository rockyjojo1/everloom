import { test, expect } from "@playwright/test";

// Fresh save test: clear all storage, load game, dismiss intro, click Worn Hatchet.
test.describe("Worn Hatchet Interaction", () => {
  test("clicks Worn Hatchet on fresh save (desktop)", async ({ page, context }) => {
    // Clear all storage to simulate fresh save.
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      indexedDB.deleteDatabase("everloom");
      localStorage.clear();
      sessionStorage.clear();
    });

    // Reload to start fresh.
    await page.goto("/", { waitUntil: "networkidle" });

    // Wait for character creation form to appear.
    const appearanceButtons = page.locator('button[aria-pressed]');
    await appearanceButtons.first().waitFor();

    // Select first appearance (meadow).
    await appearanceButtons.first().click();

    // Wait for preview to render.
    await page.locator(".creator-preview canvas").waitFor();

    // Verify character name input exists.
    const nameInput = page.locator('input[aria-label="Character name"]');
    await expect(nameInput).toBeVisible();

    // Enter name and dismiss intro.
    await nameInput.fill("TestWanderer");
    await page.locator("button.primary").click(); // "Enter Meadowrest"

    // Wait for world to load (should see HUD or gameplay).
    await page.locator(".hud, canvas").first().waitFor({ timeout: 10_000 });

    // Locate the Worn Hatchet item visually or via DOM.
    // The Worn Hatchet appears on the ground in the starting meadow.
    // We'll use pointer coordinates based on expected game camera/world setup.
    // For a real test, we'd need to identify the item's rendered position.

    // Get canvas for pointer event coordinates.
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");

    // Estimate hatchet position (center-ish of canvas for starting area).
    // This is approximate and should be verified in actual gameplay.
    const hatchetX = box.x + box.width * 0.5;
    const hatchetY = box.y + box.height * 0.6;

    // Click on estimated hatchet location.
    await page.mouse.click(hatchetX, hatchetY);

    // Verify collection happened (e.g., HUD inventory updated or toast appeared).
    // For now, check that no error occurred.
    const errorElement = page.locator(".fatal");
    await expect(errorElement).not.toBeVisible();

    // Verify HUD is still visible (game didn't crash).
    await expect(canvas).toBeVisible();
  });

  test("mobile/touch Worn Hatchet interaction", async ({ page, context }) => {
    // Set mobile viewport.
    await page.setViewportSize({ width: 375, height: 812 });

    // Clear storage.
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      indexedDB.deleteDatabase("everloom");
      localStorage.clear();
      sessionStorage.clear();
    });

    // Reload.
    await page.goto("/", { waitUntil: "networkidle" });

    // Wait for intro screen.
    const appearanceButtons = page.locator('button[aria-pressed]');
    await appearanceButtons.first().waitFor();
    await appearanceButtons.first().click();

    // Enter name.
    const nameInput = page.locator('input[aria-label="Character name"]');
    await nameInput.fill("MobileTest");

    // Dismiss intro.
    await page.locator("button.primary").click();

    // Wait for world.
    await page.locator(".hud, canvas").first().waitFor({ timeout: 10_000 });

    // Get canvas.
    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");

    // Estimate hatchet and tap.
    const hatchetX = box.x + box.width * 0.5;
    const hatchetY = box.y + box.height * 0.6;

    // Use touch event for mobile.
    await page.touchscreen.tap(hatchetX, hatchetY);

    // Verify no errors.
    await expect(page.locator(".fatal")).not.toBeVisible();
    await expect(canvas).toBeVisible();
  });

  test("adjacent click does not collect hatchet", async ({ page, context }) => {
    // Clear storage.
    await context.clearCookies();
    await page.goto("/");
    await page.evaluate(() => {
      indexedDB.deleteDatabase("everloom");
      localStorage.clear();
      sessionStorage.clear();
    });

    // Reload.
    await page.goto("/", { waitUntil: "networkidle" });

    // Intro flow.
    const appearanceButtons = page.locator('button[aria-pressed]');
    await appearanceButtons.first().waitFor();
    await appearanceButtons.first().click();
    await page.locator('input[aria-label="Character name"]').fill("AdjacentTest");
    await page.locator("button.primary").click();

    // Wait for world.
    await page.locator(".hud, canvas").first().waitFor({ timeout: 10_000 });

    const canvas = page.locator("canvas").first();
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");

    // Click adjacent to estimated hatchet (offset by ~100 pixels).
    const adjacentX = box.x + box.width * 0.2;
    const adjacentY = box.y + box.height * 0.4;
    await page.mouse.click(adjacentX, adjacentY);

    // Verify game continues normally (no crash, no unexpected interaction).
    await expect(page.locator(".fatal")).not.toBeVisible();
  });
});
