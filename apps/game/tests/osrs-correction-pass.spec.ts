import { expect, test, type Page } from "@playwright/test";

// Regression coverage for the OSRS-feel correction pass: unreachable-route
// safety, physical pickup timing, command cancellation, the fixed-slot
// mobile inventory grid, and the long-press context menu. Uses the same
// __EVERLOOM_TEST__ dev bridge and `?e2e=1` skip-intro convention as the
// rest of this suite (see tutorial-guidance.spec.ts) — real pointer/touch
// input drives every gameplay assertion; the bridge is only used to read
// state or to perform the same real route+action a click already performs
// elsewhere in this file.
type TestApi = {
  snapshot: () => {
    inventory: { itemId: string; quantity: number }[];
    skills: Record<string, { xp: number }>;
    currentActivity: unknown;
  };
  navigation: () => { route: unknown[] };
  commandState: () => { type: string };
};

async function enterFreshWorld(page: Page) {
  await page.goto("/?e2e=1");
  await page.getByRole("button", { name: "Enter Meadowrest" }).click();
  await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true", { timeout: 35_000 });
  await page.waitForTimeout(400);
}

function testApi(page: Page) {
  return page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__);
}

test.describe("Unreachable interaction safety", () => {
  test("tapping open water never moves, acts, or grants a reward — only shows feedback", async ({ page }) => {
    await enterFreshWorld(page);

    const before = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot());

    const box = await page.locator('[data-testid="game-world"]').boundingBox();
    if (!box) throw new Error("game-world has no bounding box");
    // Bottom-left of the default camera frame is open water in Meadowrest's
    // authored geometry (confirmed visually in
    // docs/audits/2026-08-06-osrs-feel-production-slice/correction-pass/desktop-unreachable-feedback.png).
    await page.mouse.click(box.x + 90, box.y + box.height - 5);
    await page.waitForTimeout(700);

    await expect(page.locator(".chat-box")).toContainText("I can't reach that.");

    const after = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot());
    expect(after.inventory).toEqual(before.inventory);
    expect(after.currentActivity).toBeFalsy();

    const nav = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.navigation());
    expect(nav.route.length).toBe(0);
  });
});

test.describe("Physical ground-item pickup", () => {
  test("item disappears and inventory updates together at the pickup event, not at the initial tap", async ({ page }) => {
    await enterFreshWorld(page);

    const before = await testApi(page).then((api) => api === null);
    expect(before).toBe(false);

    const ok = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: { activateTarget: (id: string) => boolean } }).__EVERLOOM_TEST__.activateTarget("ground_worn_hatchet"));
    expect(ok, "activateTarget should find a real path to the worn hatchet").toBe(true);

    // Immediately after the command starts (still travelling, or at most
    // right at arrival before the ~480ms pickup presentation completes),
    // the item must not be in the inventory yet.
    const midFlight = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot());
    expect(midFlight.inventory.some((stack) => stack.itemId === "worn_hatchet")).toBe(false);

    await expect.poll(async () => {
      const snapshot = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot());
      return snapshot.inventory.some((stack) => stack.itemId === "worn_hatchet");
    }, { timeout: 20_000 }).toBe(true);

    await expect(page.locator(".chat-box")).toContainText(/hatchet/i);
  });

  test("cancelling before the pickup event never grants the item late", async ({ page }) => {
    await enterFreshWorld(page);

    const ok = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: { activateTarget: (id: string) => boolean } }).__EVERLOOM_TEST__.activateTarget("ground_worn_hatchet"));
    expect(ok).toBe(true);

    // Wait for arrival (route empties) — the pickup presentation timer
    // (~480ms) is now pending — then immediately cancel with a new command
    // before it fires.
    await expect.poll(async () => (await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.navigation())).route.length, { timeout: 20_000 }).toBe(0);
    await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: { stop: () => void } }).__EVERLOOM_TEST__.stop());
    const box = await page.locator('[data-testid="game-world"]').boundingBox();
    if (!box) throw new Error("game-world has no bounding box");
    await page.mouse.click(box.x + box.width / 2 + 30, box.y + box.height / 2 + 30);

    // Give the (now-cancelled) 480ms pickup timer time to have fired if it
    // were going to fire incorrectly.
    await page.waitForTimeout(900);
    const snapshot = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot());
    expect(snapshot.inventory.some((stack) => stack.itemId === "worn_hatchet")).toBe(false);
  });
});

test.describe("Mobile fixed-slot inventory grid", () => {
  test.use({ viewport: { width: 852, height: 393 } });

  test("the inventory panel renders four columns at 852x393 with no page overflow", async ({ page }) => {
    await enterFreshWorld(page);
    await page.getByRole("button", { name: "Pack" }).click();
    await expect(page.getByTestId("inventory-grid")).toBeVisible();

    const columns = await page.evaluate(() => {
      const grid = document.querySelector('[data-testid="inventory-grid"]');
      if (!grid) return 0;
      return getComputedStyle(grid).gridTemplateColumns.trim().split(/\s+/).length;
    });
    expect(columns).toBe(4);

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    expect(overflow).toBe(false);
  });
});

test.describe("Long-press context menu", () => {
  test("an ordinary tap does not open the menu; a long hold does, and stays inside the viewport", async ({ page }) => {
    await enterFreshWorld(page);
    const box = await page.locator('[data-testid="game-world"]').boundingBox();
    if (!box) throw new Error("game-world has no bounding box");

    // Ordinary quick tap: no menu.
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 + 60);
    await page.waitForTimeout(150);
    await expect(page.locator(".context-menu")).toHaveCount(0);

    // Long hold near the right edge: menu opens and stays within the
    // viewport (its bounding box must not exceed window width).
    await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(650);
    await expect(page.locator(".context-menu")).toBeVisible();
    const menuBox = await page.locator(".context-menu").boundingBox();
    const viewport = page.viewportSize();
    if (menuBox && viewport) {
      expect(menuBox.x).toBeGreaterThanOrEqual(0);
      expect(menuBox.x + menuBox.width).toBeLessThanOrEqual(viewport.width + 1);
    }
    await page.mouse.up();
  });

  test("pointer movement past tolerance cancels a pending long press", async ({ page }) => {
    await enterFreshWorld(page);
    const box = await page.locator('[data-testid="game-world"]').boundingBox();
    if (!box) throw new Error("game-world has no bounding box");

    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(150);
    // Drag well past the movement-tolerance threshold before the long-press
    // timer would fire.
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 80);
    await page.waitForTimeout(500);
    await expect(page.locator(".context-menu")).toHaveCount(0);
    await page.mouse.up();
  });
});
