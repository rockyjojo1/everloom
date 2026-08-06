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
  const enterButton = page.getByRole("button", { name: "Enter Meadowrest" });
  await enterButton.waitFor({ state: "visible", timeout: 20_000 });
  await enterButton.click();
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
    // Open water sits along the bottom-left of the default camera frame in
    // Meadowrest's authored geometry (see
    // docs/audits/.../correction-pass/desktop-unreachable-feedback.png), but
    // its exact on-screen pixel shifts slightly with viewport/device
    // presets. Try a small cluster of candidate points near there and
    // require at least one to trigger the unreachable message, rather than
    // depending on one brittle pixel offset.
    const candidates: [number, number][] = [
      [box.x + 90, box.y + box.height - 5],
      [box.x + 40, box.y + box.height - 5],
      [box.x + 10, box.y + box.height - 5],
      [box.x + 60, box.y + box.height - 30],
      [box.x + 120, box.y + box.height - 5],
    ];
    let reached = false;
    for (const [x, y] of candidates) {
      await page.mouse.click(x, y);
      await page.waitForTimeout(500);
      const lastLine = await page.evaluate(() => {
        const spans = document.querySelectorAll(".chat-box span");
        return spans.length ? spans[spans.length - 1]!.textContent : null;
      });
      if (lastLine === "I can't reach that.") {
        reached = true;
        break;
      }
    }
    expect(reached, "expected at least one candidate water point to be unreachable").toBe(true);
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
    }, { timeout: 40_000 }).toBe(true);

    await expect(page.locator(".chat-box")).toContainText(/hatchet/i);
  });

  test("cancelling before the pickup event never grants the item late", async ({ page }) => {
    await enterFreshWorld(page);

    const ok = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: { activateTarget: (id: string) => boolean } }).__EVERLOOM_TEST__.activateTarget("ground_worn_hatchet"));
    expect(ok).toBe(true);

    // Wait for arrival (route empties) — the pickup presentation timer
    // (~480ms, PICKUP_PRESENTATION_MS in GameWorld.tsx) is now pending —
    // then immediately race a real cancelling click against it.
    //
    // __EVERLOOM_TEST__.stop() only cancels the STORE's currentActivity; it
    // does not touch GameWorld's own PlayerCommandController, so a real new
    // command (a real click, exactly like a player tapping elsewhere) is
    // what actually calls commands.cancel() and invalidates the pending
    // pickup's id — see game/playerCommand.ts and the isActive(id) check
    // inside actOn()'s pickup setTimeout.
    //
    // Environment note: like the long-press movement-tolerance test above,
    // this assertion depends on a real synthetic click reaching the page
    // faster than a ~480ms in-page timer. On a sandbox where a single
    // Playwright input round-trip has been observed to take 1.5-2s, this
    // can lose the race even though the underlying cancellation guarantee
    // (verified by the playerCommand unit tests and by code review) is
    // correct — see the long-press test's comment for the same finding.
    await expect.poll(async () => (await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.navigation())).route.length, { timeout: 40_000 }).toBe(0);
    const box = await page.locator('[data-testid="game-world"]').boundingBox();
    if (!box) throw new Error("game-world has no bounding box");
    await page.mouse.click(box.x + box.width / 2 + 260, box.y + box.height / 2 + 220);

    // Give the (hopefully cancelled) 480ms pickup timer time to have fired
    // if it were going to fire incorrectly.
    await page.waitForTimeout(900);
    const snapshot = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot());
    const state = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.commandState());
    expect(state.type, "the cancelling click should have replaced the pickup command").not.toBe("picking_up");
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
    // Move past the movement-tolerance threshold immediately after
    // pointerdown, to race the long-press timer (LONG_PRESS_MS, ~460ms in
    // GameWorld.tsx) as tightly as possible.
    //
    // Known environment limitation: in this specific sandbox, a single
    // page.mouse.move() round-trip has been observed to take 1.5-2s end to
    // end (confirmed by instrumenting real pointerdown/pointermove/pointerup
    // DOM events — the long-press menu had already opened, and later
    // synthetic pointermove events were landing on the menu's own DOM nodes
    // instead of the canvas, well before this test's cancelling move ever
    // reached the page). That is slower than the 460ms window this feature
    // is built around, so this assertion can fail here even though the
    // underlying cancellation logic (onPointerMove clearing longPressTimer
    // once movement exceeds LONG_PRESS_TOLERANCE_PX — see GameWorld.tsx) is
    // straightforward and was verified by direct instrumentation to be
    // correct: it simply never receives the event in time on this runner.
    // This is a synthetic-input-latency artifact of this sandbox, not a
    // product defect — kept as a real regression test for environments with
    // normal input latency.
    await page.mouse.move(box.x + box.width / 2 + 80, box.y + box.height / 2 + 80);
    await page.waitForTimeout(700);
    await expect(page.locator(".context-menu")).toHaveCount(0);
    await page.mouse.up();
  });
});
