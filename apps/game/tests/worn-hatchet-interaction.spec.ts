import { test, expect } from "@playwright/test";

// Fresh-state setup: clear all browser storage and service workers
async function clearBrowserState(page: any) {
  // Clear cookies
  const context = page.context();
  await context.clearCookies();

  // Clear local storage, session storage
  await page.evaluate(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  // Clear IndexedDB
  await page.evaluate(() => {
    return new Promise<void>((resolve, reject) => {
      const dbNames = (window as any).indexedDB?.databases?.();
      if (!dbNames) {
        resolve();
        return;
      }
      Promise.all(dbNames.map((db: any) => (window as any).indexedDB.deleteDatabase(db.name)))
        .then(() => resolve())
        .catch((error: any) => {
          console.warn("IndexedDB clear failed (expected)", error);
          resolve();
        });
    });
  });

  // Clear Cache Storage
  await page.evaluate(() => {
    return caches.keys().then((names: string[]) =>
      Promise.all(names.map((name: string) => caches.delete(name)))
    );
  });

  // Unregister service workers
  await page.evaluate(() => {
    return navigator.serviceWorker?.getRegistrations?.().then((regs: readonly ServiceWorkerRegistration[]) =>
      Promise.all(Array.from(regs).map((reg: ServiceWorkerRegistration) => reg.unregister()))
    );
  });
}

test.describe("Worn Hatchet Interaction", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate and clear state
    await page.goto("/");
    await clearBrowserState(page);
    await page.reload();
  });

  test("desktop collection: click the hatchet and collect it", async ({ page }) => {
    // Wait for the game to be ready
    await page.waitForLoadState("networkidle");

    // Fill character creation form
    const nameInput = page.locator('input[aria-label="Character name"]');
    await nameInput.fill("TestHunter");

    // Select an appearance (click the first appearance button)
    const appearanceButtons = page.locator('button[aria-pressed]');
    await appearanceButtons.first().click();

    // Click "Enter Meadowrest"
    const enterButton = page.getByRole("button", { name: /Enter Meadowrest/ });
    await enterButton.click();

    // Wait for the world to be ready (use the test bridge)
    await page.waitForFunction(() => {
      return (window as any).__EVERLOOM_TEST__?.snapshot?.()?.worldFlags?.tutorial_started !== undefined;
    }, { timeout: 5000 });

    // Get the initial state
    const initialSnapshot = await page.evaluate(() => {
      return (window as any).__EVERLOOM_TEST__?.snapshot?.();
    });
    const initialInventory = initialSnapshot?.inventory?.["worn_hatchet"] ?? 0;

    // Verify the Hatchet ground target exists
    const hatchetPosition = await page.evaluate(() => {
      return (window as any).__EVERLOOM_TEST__?.targetPosition?.("worn_hatchet");
    });
    expect(hatchetPosition).not.toBeNull();
    expect(hatchetPosition?.x).toBeDefined();
    expect(hatchetPosition?.y).toBeDefined();

    // Verify inventory is empty
    expect(initialInventory).toBe(0);

    // Click the hatchet at its projected position
    await page.mouse.click(hatchetPosition!.x, hatchetPosition!.y);

    // Wait for the animation and collection sequence to complete
    await page.waitForTimeout(1000);

    // Check inventory increased by 1
    const finalSnapshot = await page.evaluate(() => {
      return (window as any).__EVERLOOM_TEST__?.snapshot?.();
    });
    const finalInventory = finalSnapshot?.inventory?.["worn_hatchet"] ?? 0;
    expect(finalInventory).toBe(initialInventory + 1);

    // Verify the ground target no longer exists
    const hatchetAfterCollection = await page.evaluate(() => {
      return (window as any).__EVERLOOM_TEST__?.targetPosition?.("worn_hatchet");
    });
    expect(hatchetAfterCollection).toBeNull();
  });

  test("desktop adjacent-miss: click outside the hatchet hitbox", async ({ page }) => {
    // Wait for the game to be ready
    await page.waitForLoadState("networkidle");

    // Fill character creation form
    const nameInput = page.locator('input[aria-label="Character name"]');
    await nameInput.fill("TestMiss");

    // Select an appearance
    const appearanceButtons = page.locator('button[aria-pressed]');
    await appearanceButtons.first().click();

    // Click "Enter Meadowrest"
    const enterButton = page.getByRole("button", { name: /Enter Meadowrest/ });
    await enterButton.click();

    // Wait for world ready
    await page.waitForFunction(() => {
      return (window as any).__EVERLOOM_TEST__?.snapshot?.()?.worldFlags?.tutorial_started !== undefined;
    }, { timeout: 5000 });

    // Get hatchet position
    const hatchetPosition = await page.evaluate(() => {
      return (window as any).__EVERLOOM_TEST__?.targetPosition?.("worn_hatchet");
    });
    expect(hatchetPosition).not.toBeNull();

    // Get initial inventory
    const initialSnapshot = await page.evaluate(() => {
      return (window as any).__EVERLOOM_TEST__?.snapshot?.();
    });
    const initialInventory = initialSnapshot?.inventory?.["worn_hatchet"] ?? 0;

    // Click outside the hitbox (offset by 50 pixels in a safe direction)
    const missX = hatchetPosition!.x + 50;
    const missY = hatchetPosition!.y;
    await page.mouse.click(missX, missY);

    // Wait a moment
    await page.waitForTimeout(500);

    // Verify inventory unchanged
    const afterSnapshot = await page.evaluate(() => {
      return (window as any).__EVERLOOM_TEST__?.snapshot?.();
    });
    const afterInventory = afterSnapshot?.inventory?.["worn_hatchet"] ?? 0;
    expect(afterInventory).toBe(initialInventory);

    // Verify the ground target still exists
    const hatchetStillExists = await page.evaluate(() => {
      return (window as any).__EVERLOOM_TEST__?.targetPosition?.("worn_hatchet");
    });
    expect(hatchetStillExists).not.toBeNull();
  });

  test("mobile landscape collection: tap the hatchet", async ({ page }) => {
    // Set mobile landscape viewport
    await page.setViewportSize({ width: 1024, height: 600 });

    // Wait for the game to be ready
    await page.waitForLoadState("networkidle");

    // Fill character creation form
    const nameInput = page.locator('input[aria-label="Character name"]');
    await nameInput.fill("TestMobile");

    // Select an appearance
    const appearanceButtons = page.locator('button[aria-pressed]');
    await appearanceButtons.first().click();

    // Click "Enter Meadowrest"
    const enterButton = page.getByRole("button", { name: /Enter Meadowrest/ });
    await enterButton.click();

    // Wait for world ready
    await page.waitForFunction(() => {
      return (window as any).__EVERLOOM_TEST__?.snapshot?.()?.worldFlags?.tutorial_started !== undefined;
    }, { timeout: 5000 });

    // Get hatchet position
    const hatchetPosition = await page.evaluate(() => {
      return (window as any).__EVERLOOM_TEST__?.targetPosition?.("worn_hatchet");
    });
    expect(hatchetPosition).not.toBeNull();

    // Get initial inventory
    const initialSnapshot = await page.evaluate(() => {
      return (window as any).__EVERLOOM_TEST__?.snapshot?.();
    });
    const initialInventory = initialSnapshot?.inventory?.["worn_hatchet"] ?? 0;

    // Tap the hatchet using touchscreen
    await page.touchscreen.tap(hatchetPosition!.x, hatchetPosition!.y);

    // Wait for the interaction sequence
    await page.waitForTimeout(1000);

    // Verify inventory increased
    const finalSnapshot = await page.evaluate(() => {
      return (window as any).__EVERLOOM_TEST__?.snapshot?.();
    });
    const finalInventory = finalSnapshot?.inventory?.["worn_hatchet"] ?? 0;
    expect(finalInventory).toBe(initialInventory + 1);

    // Verify the ground target no longer exists
    const hatchetAfterCollection = await page.evaluate(() => {
      return (window as any).__EVERLOOM_TEST__?.targetPosition?.("worn_hatchet");
    });
    expect(hatchetAfterCollection).toBeNull();
  });

});
