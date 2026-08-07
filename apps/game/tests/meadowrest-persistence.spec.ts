import { expect, test, type Page } from "@playwright/test";

// The first trustworthy persistent gameplay vertical slice: proves that
// real, pointer-driven progress in Meadowrest (position, the physical Worn
// Hatchet pickup, equipping it, and a real Woodcutting reward) survives a
// full page reload through the existing IndexedDB-backed save architecture
// (apps/game/src/game/saveDb.ts + packages/core's GameSave/migrateSave),
// and that reloading mid-action never manufactures a reward that was never
// legitimately earned. Uses the same __EVERLOOM_TEST__ dev bridge and
// `?e2e=1` convention as osrs-correction-pass.spec.ts — every state change
// is driven by a real page.mouse.click()/page.touchscreen-compatible
// pointer event on a real rendered target; the bridge only reads state or
// widens real production timers (never shortens them, never grants a
// reward directly).
type TestApi = {
  snapshot: () => {
    position: { x: number; z: number; facingX: number; facingZ: number };
    currentZone: string;
    inventory: { itemId: string; quantity: number }[];
    equipment: Record<string, string | null>;
    skills: Record<string, { xp: number }>;
    worldFlags: Record<string, boolean>;
    currentActivity: unknown;
  };
  navigation: () => { route: unknown[] };
  commandState: () => { type: string };
  visibleTarget: (targetId: string) => boolean;
  setPickupPresentationMs: (ms: number) => void;
  targetPosition: (targetId: string) => { x: number; y: number } | null;
  save: () => Promise<void>;
};

const HATCHET_TARGET = "ground_worn_hatchet";
const HATCHET_ITEM = "worn_hatchet";
const OAK_TARGET = "oak_west_1";

async function enterFreshWorld(page: Page) {
  // Each Playwright test already gets a brand-new, empty browser context
  // (cookies/localStorage/sessionStorage/IndexedDB all start empty), so
  // this alone establishes a deterministic fresh account without any
  // manual IndexedDB clearing.
  await page.goto("/?e2e=1");
  const enterButton = page.getByRole("button", { name: "Enter Meadowrest" });
  await enterButton.waitFor({ state: "visible", timeout: 20_000 });
  await enterButton.click();
  await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
  await page.waitForTimeout(400);
}

function snapshot(page: Page) {
  return page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot());
}

function commandType(page: Page): Promise<string> {
  return page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.commandState().type);
}

function targetPosition(page: Page, targetId: string) {
  return page.evaluate((id) => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.targetPosition(id), targetId);
}

function waitForCommandType(page: Page, type: string, timeout: number) {
  return page.waitForFunction(
    (expected) => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.commandState().type === expected,
    type,
    { timeout },
  );
}

// Real pointer click on a live world target's real projected screen
// position, retried a bounded number of times only to absorb genuine
// rendering/camera-settle variance. Never falls back to a synthetic
// activation — see the identical helper and its rationale in
// osrs-correction-pass.spec.ts.
async function clickTargetUntil(
  page: Page,
  targetId: string,
  isSuccess: () => Promise<boolean>,
  attempts = 5,
  waitBetweenMs = 300,
): Promise<boolean> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    const position = await targetPosition(page, targetId);
    if (!position) throw new Error(`${targetId} should have a projected screen position`);
    await page.mouse.click(position.x, position.y);
    if (await isSuccess()) return true;
    await page.waitForTimeout(waitBetweenMs);
  }
  return false;
}

// Real pointer flow: walk to and collect the physical Worn Hatchet, exactly
// like a player tapping it — not a shortcut into inventory state.
async function collectHatchet(page: Page) {
  const presentAtStart = await page.evaluate(
    (id) => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.visibleTarget(id),
    HATCHET_TARGET,
  );
  expect(presentAtStart, "the worn hatchet should be present before collection").toBe(true);

  const beganMoving = await clickTargetUntil(page, HATCHET_TARGET, async () => {
    const [nav, state] = await Promise.all([
      page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.navigation()),
      commandType(page),
    ]);
    return nav.route.length > 0 || state === "moving_to_interact" || state === "picking_up";
  });
  expect(beganMoving, "a real pointer click on the hatchet should begin a real routed command").toBe(true);

  // The real (unwidened) walk from spawn to the hatchet can wind around the
  // village buildings rather than a straight line, so — like the
  // correction-pass suite's own "picking_up" wait — this needs real
  // headroom beyond a couple of seconds, not just the ~480ms presentation
  // delay itself.
  await expect.poll(async () => (await snapshot(page)).inventory.some((stack) => stack.itemId === HATCHET_ITEM), {
    timeout: 40_000,
  }).toBe(true);
}

// Real pointer flow: open the Pack panel and click the hatchet's own
// inventory slot. Hud.tsx's inventory-slot default action equips any item
// with an equipmentSlot directly on click — this is the same production
// click path a player uses, not a bridge shortcut.
async function equipHatchet(page: Page) {
  const packTab = page.getByRole("button", { name: "Pack" });
  await packTab.click();
  await page.getByRole("button", { name: "Worn Hatchet × 1" }).click();
  await expect.poll(async () => (await snapshot(page)).equipment.tool, { timeout: 5_000 }).toBe(HATCHET_ITEM);
  // Close the panel by re-clicking the already-open "Pack" tab (Hud.tsx
  // toggles it shut) rather than the corner "Close panel" icon button,
  // which sits under the HP/minimap corner-cluster overlay at some
  // viewport sizes and can intercept the pointer event.
  await packTab.click();
  await expect(page.getByTestId("inventory-grid")).toHaveCount(0);
}

async function flushSave(page: Page) {
  await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.save());
}

// Hud.tsx's equip action (mirroring core's equipItem) moves an equipped
// item OUT of the inventory array and into save.equipment — that is the
// real, intentional durable representation of "holding a tool", not a
// second copy sitting in a pack slot. A duplication bug could show up as
// either a stray inventory stack alongside the equipped copy, or more than
// one stack in inventory, so this counts every place the hatchet could
// legitimately exist and requires the total to be exactly one.
function totalHatchetCount(save: { inventory: { itemId: string; quantity: number }[]; equipment: Record<string, string | null> }): number {
  const inInventory = save.inventory.filter((stack) => stack.itemId === HATCHET_ITEM).reduce((sum, stack) => sum + stack.quantity, 0);
  const equipped = save.equipment.tool === HATCHET_ITEM ? 1 : 0;
  return inInventory + equipped;
}

test.describe("Meadowrest persistence", () => {
  test("the full journey survives a reload: position, hatchet, and a real Woodcutting reward", async ({ page }) => {
    // The oak grove sits well west of spawn, and the real A* route there
    // winds around a scattering of blocking scenery (trees/rocks) rather
    // than a straight line — real walking time to it, on top of the
    // pickup/equip/gather/reload steps this journey also exercises, does
    // not comfortably fit the shared default test timeout.
    test.setTimeout(150_000);
    await enterFreshWorld(page);

    // Steps 3-8: real pointer pickup of the physical hatchet, then equip it
    // through the real inventory UI.
    await collectHatchet(page);
    const hatchetGone = await page.evaluate(
      (id) => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.visibleTarget(id),
      HATCHET_TARGET,
    );
    expect(hatchetGone, "the ground hatchet must disappear once legitimately collected").toBe(false);
    await equipHatchet(page);

    // Steps 9-11: a real Woodcutting interaction, driven by a real pointer
    // click on a real oak tree, waiting for the authoritative simulation
    // (advanceSimulation in packages/core) to grant real XP at its own
    // reward boundary — never inferred from presentation. The click-retry
    // loop only needs to confirm the click itself registered (movement
    // began); the oak is several cells away from the hatchet, so actually
    // arriving and transitioning to "gathering" is awaited separately,
    // exactly like walkAndActOn's own two-phase route-then-act shape.
    const beganWalkingToOak = await clickTargetUntil(page, OAK_TARGET, async () => {
      const [nav, state] = await Promise.all([
        page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.navigation()),
        commandType(page),
      ]);
      return nav.route.length > 0 || state === "moving_to_interact" || state === "gathering";
    });
    expect(beganWalkingToOak, "a real pointer click on the oak tree should begin a real routed command").toBe(true);
    await waitForCommandType(page, "gathering", 20_000);
    await page.waitForFunction(
      () => ((window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot().skills.woodcutting?.xp ?? 0) > 0,
      { timeout: 15_000 },
    );

    // Freeze progress deterministically with a real click on the HUD's Stop
    // button, so no further gathering cycle can complete between recording
    // xpBeforeReload and reloading.
    await page.getByRole("button", { name: "Stop" }).click();
    await waitForCommandType(page, "idle", 5_000).catch(() => undefined);

    const beforeReload = await snapshot(page);
    const xpBeforeReload = beforeReload.skills.woodcutting!.xp;
    expect(xpBeforeReload).toBeGreaterThan(0);
    expect(totalHatchetCount(beforeReload)).toBe(1);
    expect(beforeReload.equipment.tool).toBe(HATCHET_ITEM);

    // Step 12: the player is already meaningfully away from spawn (19, 16)
    // — the oak grove sits at roughly (8, 14).
    const spawnDistance = Math.hypot(beforeReload.position.x - 19, beforeReload.position.z - 16);
    expect(spawnDistance).toBeGreaterThan(5);

    // Step 13: flush the legitimate persistence boundary — the exact same
    // saveNow() the real pagehide/visibilitychange lifecycle handlers in
    // App.tsx call, invoked directly for a deterministic checkpoint rather
    // than racing a real browser lifecycle event.
    await flushSave(page);

    // Steps 14-15: reload and wait for hydration.
    await page.reload();
    await expect(page.getByRole("button", { name: "Enter Meadowrest" })).toHaveCount(0);
    await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
    await page.waitForTimeout(400);

    // Steps 17-21: durable state restored exactly, nothing manufactured.
    const afterReload = await snapshot(page);
    expect(afterReload.position.x).toBe(beforeReload.position.x);
    expect(afterReload.position.z).toBe(beforeReload.position.z);
    expect(afterReload.currentZone).toBe(beforeReload.currentZone);
    expect(totalHatchetCount(afterReload), "the hatchet must exist exactly once (equipped, not duplicated) after reload").toBe(1);
    expect(afterReload.equipment.tool).toBe(HATCHET_ITEM);
    const hatchetStillGone = await page.evaluate(
      (id) => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.visibleTarget(id),
      HATCHET_TARGET,
    );
    expect(hatchetStillGone, "the collected ground hatchet must not respawn after reload").toBe(false);
    expect(afterReload.worldFlags[`picked:${HATCHET_TARGET}`]).toBe(true);
    expect(afterReload.skills.woodcutting!.xp, "Woodcutting XP must exactly match the pre-reload value").toBe(xpBeforeReload);

    // Step 22: the player can immediately issue another real movement
    // command — a real pointer click on real walkable ground. The camera
    // re-centres on the restored position at scene setup (see GameWorld.tsx
    // using save.position for its initial camera placement), so clicking
    // near the centre of the canvas — not a specific named target that may
    // now be far off in some direction and projected under the fixed nav
    // rail or HUD corners — should land close to the player. A cluster of
    // candidate offsets (mirroring the "Unreachable interaction safety"
    // test above) absorbs two real, non-bug possibilities a single blind
    // click cannot: landing on the player's own current cell (a legal
    // "already_there" no-op with no route to observe) or on a genuinely
    // unwalkable cell (water/blocked scenery) at this particular restored
    // position.
    const box = await page.locator('[data-testid="game-world"]').boundingBox();
    if (!box) throw new Error("game-world has no bounding box");
    const candidates: [number, number][] = [
      [box.x + box.width / 2 + 140, box.y + box.height / 2 + 60],
      [box.x + box.width / 2 - 140, box.y + box.height / 2 + 60],
      [box.x + box.width / 2, box.y + box.height / 2 + 160],
      [box.x + box.width / 2 + 140, box.y + box.height / 2 - 40],
      [box.x + box.width / 2 - 140, box.y + box.height / 2 - 40],
    ];
    let beganNewCommand = false;
    for (const [x, y] of candidates) {
      await page.mouse.click(x, y);
      await page.waitForTimeout(400);
      beganNewCommand = await page.evaluate(() => {
        const api = (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__;
        return api.navigation().route.length > 0 || api.commandState().type !== "idle";
      });
      if (beganNewCommand) break;
    }
    expect(beganNewCommand, "controls must be usable immediately after restore").toBe(true);
  });

  test("cancelling a pickup then reloading never grants the item late", async ({ page }) => {
    await enterFreshWorld(page);
    await page.evaluate((ms) => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.setPickupPresentationMs(ms), 14_000);

    const beganMoving = await clickTargetUntil(page, HATCHET_TARGET, async () => {
      const [nav, state] = await Promise.all([
        page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.navigation()),
        commandType(page),
      ]);
      return nav.route.length > 0 || state === "moving_to_interact" || state === "picking_up";
    });
    expect(beganMoving).toBe(true);
    await waitForCommandType(page, "picking_up", 40_000);

    const rightBeforeCancel = await snapshot(page);
    expect(rightBeforeCancel.inventory.some((stack) => stack.itemId === HATCHET_ITEM), "must not have already completed").toBe(false);

    const cancelled = await clickTargetUntil(page, "npc_mara", async () => (await commandType(page)) !== "picking_up");
    expect(cancelled, "the replacement click should have superseded the pickup command").toBe(true);
    const rightAfterCancel = await snapshot(page);
    expect(rightAfterCancel.inventory.some((stack) => stack.itemId === HATCHET_ITEM), "cancelling must not itself grant the item").toBe(false);

    // Reload well before the widened deadline — no stale in-page timer
    // survives a full page reload, since it lived only in this closure.
    await page.reload();
    await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
    await page.waitForTimeout(400);

    const afterReload = await snapshot(page);
    expect(afterReload.inventory.some((stack) => stack.itemId === HATCHET_ITEM), "the item must not be granted by the cancelled command").toBe(false);
    const stillPresent = await page.evaluate(
      (id) => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.visibleTarget(id),
      HATCHET_TARGET,
    );
    expect(stillPresent, "the ground item should still be physically present after reload").toBe(true);
  });

  test("reloading mid-pickup, before the reward boundary, grants nothing", async ({ page }) => {
    await enterFreshWorld(page);
    await page.evaluate((ms) => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.setPickupPresentationMs(ms), 14_000);

    const beganMoving = await clickTargetUntil(page, HATCHET_TARGET, async () => {
      const [nav, state] = await Promise.all([
        page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.navigation()),
        commandType(page),
      ]);
      return nav.route.length > 0 || state === "moving_to_interact" || state === "picking_up";
    });
    expect(beganMoving).toBe(true);
    await waitForCommandType(page, "picking_up", 40_000);

    const midPickup = await snapshot(page);
    expect(midPickup.inventory.some((stack) => stack.itemId === HATCHET_ITEM)).toBe(false);

    // Reload immediately, deliberately well inside the widened 14s pickup
    // deadline. The pending setTimeout lived only in the now-destroyed
    // page's JS heap; a fresh page has no memory of it.
    await page.reload();
    await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
    await page.waitForTimeout(400);

    const afterReload = await snapshot(page);
    expect(afterReload.inventory.some((stack) => stack.itemId === HATCHET_ITEM), "no stale callback may survive a reload").toBe(false);
    const stillPresent = await page.evaluate(
      (id) => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.visibleTarget(id),
      HATCHET_TARGET,
    );
    expect(stillPresent).toBe(true);
  });

  test("reloading before a gathering action's reward boundary grants no XP", async ({ page }) => {
    // Same real walk to the oak grove as the main journey test above.
    test.setTimeout(150_000);
    await enterFreshWorld(page);
    await collectHatchet(page);
    await equipHatchet(page);

    const baseline = await snapshot(page);
    expect(baseline.skills.woodcutting!.xp).toBe(0);

    const beganWalkingToOak = await clickTargetUntil(page, OAK_TARGET, async () => {
      const [nav, state] = await Promise.all([
        page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.navigation()),
        commandType(page),
      ]);
      return nav.route.length > 0 || state === "moving_to_interact" || state === "gathering";
    });
    expect(beganWalkingToOak, "a real pointer click on the oak tree should begin a real routed command").toBe(true);

    // Detect "gathering" and freeze further progress inside the SAME
    // in-page predicate call — not as two separate Node round trips. On a
    // loaded runner, every one of those round trips (even a single click on
    // a fixed HUD button) has been observed taking long enough, relative to
    // the oak's real 2800ms action duration, for a whole gathering cycle to
    // complete for real in the meantime. GameWorld.tsx's animate loop
    // already skips store.tick() (and thus all simulated progress) whenever
    // `document.hidden` is true, exactly as it does when a real player
    // backgrounds the tab; setting that real, standard DOM state inside the
    // very predicate that first observes "gathering" closes the gap
    // entirely, since nothing running on this page after that point can
    // still see document.hidden as false.
    await page.waitForFunction(() => {
      const api = (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__;
      if (api.commandState().type !== "gathering") return false;
      Object.defineProperty(document, "hidden", { value: true, configurable: true });
      document.dispatchEvent(new Event("visibilitychange"));
      return true;
    }, { timeout: 20_000 });

    // Diagnostic guard, exactly like the pickup-cancellation tests above:
    // confirm no reward has been granted yet at the moment progress was
    // frozen.
    const rightAfterFreeze = await snapshot(page);
    expect(rightAfterFreeze.skills.woodcutting!.xp, "the gathering action must not have already completed").toBe(0);

    // Defense in depth: also cancel through the real "Stop" button, the
    // same real cancellation path already proven deterministic by the main
    // journey test above. Harmless if the freeze above already stopped all
    // further progress; still exercises the ordinary cancellation UI a
    // player would actually use.
    await page.getByRole("button", { name: "Stop" }).click();
    const rightAfterCancel = await snapshot(page);
    expect(rightAfterCancel.currentActivity, "the replacement click should have superseded the gathering command").toBeFalsy();
    expect(rightAfterCancel.skills.woodcutting!.xp, "cancelling must not itself grant XP").toBe(0);

    await page.reload();
    await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true", { timeout: 60_000 });
    await page.waitForTimeout(400);

    const afterReload = await snapshot(page);
    expect(afterReload.skills.woodcutting!.xp, "no XP may be manufactured from an interrupted action").toBe(0);
    expect(totalHatchetCount(afterReload)).toBe(1);
  });
});
