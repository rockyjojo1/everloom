import { expect, test, type Page } from "@playwright/test";

type TestApi = {
  activateTarget: (id: string) => boolean;
  targetPosition: (id: string) => { x: number; y: number } | null;
  equip: (id: string) => boolean;
  simulate: (ms: number) => void;
  stop: () => void;
  dismissReport: () => void;
  snapshot: () => { quests: { first_thread: { status: string; stepIndex: number } }; inventory: { itemId: string; quantity: number }[]; collections: string[] };
};

async function activate(page: Page, target: string, objective: RegExp) {
  const ok = await page.evaluate((id) => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.activateTarget(id), target);
  expect(ok).toBe(true);
  await expect(page.locator(".objective")).toContainText(objective, { timeout: 35_000 });
}

async function equip(page: Page, item: string, objective: RegExp) {
  expect(await page.evaluate((id) => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.equip(id), item)).toBe(true);
  await expect(page.locator(".objective")).toContainText(objective);
}

async function resolve(page: Page, elapsedMs: number, objective: RegExp) {
  await page.evaluate((ms) => {
    const value = (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__;
    value.simulate(ms);
    value.stop();
    value.dismissReport();
  }, elapsedMs);
  await expect(page.locator(".objective")).toContainText(objective);
}

async function startAndResolve(page: Page, target: string, elapsedMs: number, objective: RegExp, capturePath?: string) {
  expect(await page.evaluate((id) => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.activateTarget(id), target)).toBe(true);
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible({ timeout: 35_000 });
  if (capturePath) await page.screenshot({ path: capturePath, fullPage: true });
  await resolve(page, elapsedMs, objective);
}

async function startAndResolveByPointer(page: Page, target: string, elapsedMs: number, objective: RegExp, capturePath?: string) {
  const position = await page.evaluate((id) => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.targetPosition(id), target);
  expect(position).not.toBeNull();
  await page.mouse.click(position!.x, position!.y);
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible({ timeout: 35_000 });
  if (capturePath) await page.screenshot({ path: capturePath, fullPage: true });
  await resolve(page, elapsedMs, objective);
}

test("all Phase One skills and The First Thread work through the browser", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The mobile suite exercises the touch-sized first-tree gate.");
  // This is a deliberately complete, real-navigation chapter run. Cold model
  // decoding on software or contended WebGL can take a little over 2.5 minutes.
  test.setTimeout(240_000);
  await page.goto("/?e2e=1");
  await page.getByRole("button", { name: "Enter Meadowrest" }).click();
  await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true");

  await activate(page, "npc_mara", /Pick up the worn hatchet/i);
  await activate(page, "ground_worn_hatchet", /equip the worn hatchet/i);
  await equip(page, "worn_hatchet", /Chop three Meadow Logs/i);
  await page.getByRole("button", { name: "Pack", exact: true }).click();
  await page.screenshot({ path: testInfo.outputPath("everloom-inventory.png"), fullPage: true });
  await page.getByRole("button", { name: "Close panel" }).click();
  await startAndResolve(page, "oak_west_1", 21_000, /Collect the worn pickaxe/i, testInfo.outputPath("everloom-woodcutting.png"));

  await activate(page, "ground_worn_pickaxe", /Equip the worn pickaxe/i);
  await equip(page, "worn_pickaxe", /Mine three Copper Ore/i);
  await startAndResolve(page, "copper_north_1", 23_000, /Find the worn fishing rod/i, testInfo.outputPath("everloom-mining.png"));

  await activate(page, "ground_worn_rod", /Equip the worn fishing rod/i);
  await equip(page, "worn_fishing_rod", /Catch two Riverlings/i);
  // Use the same real pointer path as a player here. The old test called the
  // activity hook directly and could not catch a hollow/unclickable shoal.
  await startAndResolveByPointer(page, "riverling_south", 10_000, /Cook a Riverling/i, testInfo.outputPath("everloom-fishing.png"));

  await startAndResolve(page, "village_cooking_fire", 5_000, /Take the militia sword/i);
  await activate(page, "ground_militia_sword", /Equip the militia sword/i);
  await equip(page, "meadowrest_sword", /Defeat the restless skeleton/i);

  // Accuracy/evasion combat is intentionally variable; this budget is long
  // enough for a properly equipped fresh player without assuming every swing hits.
  await startAndResolve(page, "skeleton_east", 30_000, /Return to Mara/i, testInfo.outputPath("everloom-combat.png"));
  await activate(page, "npc_mara", /First Loomstone/i);
  // Completing First Thread now chains into The Forge's Trade (the Smithing
  // tutorial), not directly into the Verdant attunement gate — that chain is
  // exercised end-to-end by forge-trade.spec.ts and verdant-loomstone.spec.ts.
  await activate(page, "first_loomstone", /Mine four Copper Ore from the northern quarry/i);

  const snapshot = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot());
  expect(snapshot.quests.first_thread.status).toBe("completed");
  expect(snapshot.collections).toContain("bone_fragment");
  expect(snapshot.inventory.some((item) => item.itemId === "cooked_riverling")).toBe(true);
});
