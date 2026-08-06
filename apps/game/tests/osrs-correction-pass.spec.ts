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
  visibleTarget: (targetId: string) => boolean;
  activateTarget: (id: string) => boolean;
  longPressPending: () => boolean;
  setPickupPresentationMs: (ms: number) => void;
  setLongPressMs: (ms: number) => void;
  targetPosition: (targetId: string) => { x: number; y: number } | null;
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

    // Widen the real pickup deadline for this run only, through the
    // narrowly-scoped, dev-only setPickupPresentationMs seam (see
    // pickupPresentationMsOverride in GameWorld.tsx). This does NOT change
    // any callback logic — the real setTimeout + isActive(id) cancellation
    // guard in actOn() runs exactly as in normal play, just with a longer
    // delay, so a normal-speed real click can reliably land before the
    // deadline instead of racing this sandbox's synthetic-input latency.
    //
    // Playwright's page.clock API was tried first and rejected: installing
    // it destabilised this page's Three.js render loop (the browser tab
    // was observed to close mid-test — "Target page, context or browser has
    // been closed" — during clock.runFor()), so it is not a safe way to
    // control this specific production timer.
    const testPickupPresentationMs = 6000;
    await page.evaluate((ms) => (window as unknown as { __EVERLOOM_TEST__: { setPickupPresentationMs: (ms: number) => void } }).__EVERLOOM_TEST__.setPickupPresentationMs(ms), testPickupPresentationMs);

    const started = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.activateTarget("ground_worn_hatchet"));
    expect(started, "activateTarget should find a real path to the worn hatchet").toBe(true);

    // Wait for genuine arrival and entry into "picking_up" — real time, not
    // a race, since we are only waiting for it to happen, not trying to
    // beat a deadline.
    await expect.poll(async () => {
      const state = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.commandState());
      return state.type;
    }, { timeout: 40_000 }).toBe("picking_up");

    // Genuine replacement command: a real pointer click elsewhere, exactly
    // what a player tapping away mid-pickup would do.
    // __EVERLOOM_TEST__.stop() is deliberately NOT used here — it only
    // cancels the store's currentActivity and never touches
    // PlayerCommandController, so it cannot exercise the real cancellation
    // path this test is meant to prove.
    //
    // The click target is computed from targetPosition("npc_mara") (the
    // real projected screen position of a known, always-present world
    // object) rather than a fixed pixel offset from the canvas corner: once
    // the player has walked to the hatchet, the camera has followed them,
    // so a screen offset calibrated from spawn framing can miss all
    // raycastable geometry entirely (confirmed by direct instrumentation —
    // such a click produced no hit, so onPointer's `if (!hit) return`
    // silently no-oped, leaving the original pickup command uncancelled).
    // Clicking a real, currently-visible object's real projected position
    // is what makes this deterministic regardless of where the player is
    // standing. This still exercises the exact real command path a ground
    // click would (walkAndActOn begins with the same commands.cancel(),
    // then a real routed command) — it targets an NPC only because that is
    // a reliable, camera-accurate hit, not because the target matters.
    // Re-querying targetPosition() and retrying a few times (well within the
    // widened 6s window) absorbs any single click landing a frame before
    // the camera has fully settled onto its follow position — this sandbox
    // has shown individual synthetic clicks can occasionally miss even a
    // real, currently-rendered object's exact projected point.
    let cancelled = false;
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const maraPosition = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.targetPosition("npc_mara"));
      if (!maraPosition) throw new Error("npc_mara should have a projected screen position");
      await page.mouse.click(maraPosition.x, maraPosition.y);
      const state = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.commandState());
      if (state.type !== "picking_up") {
        cancelled = true;
        break;
      }
      await page.waitForTimeout(300);
    }
    expect(cancelled, "the replacement click should have superseded the pickup command").toBe(true);

    // Wait past the (widened, for this test only) pickup deadline.
    // GameWorld.tsx's actOn() does not clearTimeout() the superseded pickup
    // timer — it is deliberately left to fire and rely on isActive(id) to
    // no-op, so this genuinely exercises that guard rather than
    // sidestepping it.
    await page.waitForTimeout(testPickupPresentationMs + 500);

    const snapshot = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot());
    expect(snapshot.inventory.some((stack) => stack.itemId === "worn_hatchet"), "the item must not be granted by the cancelled command").toBe(false);

    const stillPresent = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.visibleTarget("ground_worn_hatchet"));
    expect(stillPresent, "the ground item should still be physically present in the world").toBe(true);
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

    // Ordinary quick tap: no menu. Not a timing race — a plain click's
    // pointerup fires (and clears the long-press timer) essentially
    // instantly, long before LONG_PRESS_MS could ever elapse.
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2 + 60);
    await page.waitForTimeout(150);
    await expect(page.locator(".context-menu")).toHaveCount(0);

    // Long hold near the right edge: the timer is meant to fire, so this is
    // not a race either — a generous real wait comfortably past
    // LONG_PRESS_MS (460ms) is deterministic here. The menu opens and stays
    // within the viewport (its bounding box must not exceed window width).
    await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(900);
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

    // Widen the real long-press deadline for this run only, through the
    // narrowly-scoped, dev-only setLongPressMs seam (see longPressMsOverride
    // in GameWorld.tsx) — mirroring the pickup-cancellation test's approach
    // and for the same reason: a single page.evaluate()/mouse round-trip in
    // this sandbox has been observed to occasionally exceed the real 460ms
    // deadline even with no artificial delay in the test itself, which
    // previously produced a spurious "pending never became true" failure
    // (the timer had already self-fired and nulled itself before the first
    // poll ever ran). This does not change the real onPointerMove
    // cancellation logic — only how long the window is before this specific
    // test's own click needs to land.
    const testLongPressMs = 6000;
    await page.evaluate((ms) => (window as unknown as { __EVERLOOM_TEST__: { setLongPressMs: (ms: number) => void } }).__EVERLOOM_TEST__.setLongPressMs(ms), testLongPressMs);

    const longPressPending = () => page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.longPressPending());

    // Click on a real, currently-rendered object's real projected position
    // (targetPosition("npc_mara")) rather than a fixed pixel offset from
    // the canvas corner — the same fix applied to the pickup-cancellation
    // test above, for the same reason: a raw guessed offset has been
    // observed to occasionally miss all raycastable geometry in this
    // sandbox even at world spawn, silently leaving onPointerDown's
    // `if (!hit) return` to no-op and the long-press timer never arming.
    let armed = false;
    let downPosition: { x: number; y: number } | null = null;
    for (let attempt = 0; attempt < 5 && !armed; attempt += 1) {
      const maraPosition = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.targetPosition("npc_mara"));
      if (!maraPosition) throw new Error("npc_mara should have a projected screen position");
      downPosition = maraPosition;
      await page.mouse.move(maraPosition.x, maraPosition.y);
      await page.mouse.down();
      armed = await longPressPending();
      if (!armed) {
        await page.mouse.up();
        await page.waitForTimeout(150);
      }
    }
    expect(armed, "pointerdown on a real target should arm the long-press timer").toBe(true);
    if (!downPosition) throw new Error("expected a down position to have been recorded");

    // Real pointermove past LONG_PRESS_TOLERANCE_PX, handled by the real
    // onPointerMove listener — reading the timer's own pending state
    // directly (a narrowly-scoped, read-only seam; see longPressPending in
    // GameWorld.tsx) observes the exact real cancellation the production
    // onPointerMove/clearLongPressTimer logic performs, deterministically,
    // instead of inferring it only from whether the menu DOM node shows up
    // within some window.
    await page.mouse.move(downPosition.x - 80, downPosition.y + 80);
    await expect.poll(longPressPending, { timeout: 5_000 }).toBe(false);

    // With the timer provably cleared, waiting past the (widened, for this
    // test only) deadline and confirming no menu ever appears is no longer
    // a race against anything.
    await page.waitForTimeout(testLongPressMs + 500);
    await expect(page.locator(".context-menu")).toHaveCount(0);
    await page.mouse.up();
  });
});
