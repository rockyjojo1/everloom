import { expect, test } from "@playwright/test";

test("fresh saves defer the 3D runtime until the player enters Meadowrest", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Loading behavior is viewport-independent.");
  await page.goto("/?e2e=1");
  await expect(page.getByRole("button", { name: "Enter Meadowrest" })).toBeVisible();
  await expect(page.getByTestId("game-world")).toHaveCount(0);

  await page.getByRole("button", { name: "Enter Meadowrest" }).click();
  await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true");
});

test("portrait phones receive the controlled landscape prompt", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The test supplies its own portrait viewport.");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?e2e=1");

  await expect(page.getByRole("heading", { name: "Turn to landscape" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Enter Meadowrest" })).toBeHidden();
});

test("the minimap remains click-through when a game panel is open", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "The overlap regression is covered at the desktop panel position.");
  await page.goto("/?e2e=1");
  await page.getByRole("button", { name: "Enter Meadowrest" }).click();
  await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true");

  await page.getByRole("button", { name: "Pack" }).click();
  await page.getByRole("button", { name: "Close panel" }).click();
  await expect(page.getByRole("button", { name: "Close panel" })).toHaveCount(0);
});

test("critical model failures retain a playable fallback world", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Asset resilience is viewport-independent.");
  let interceptedModels = 0;
  await page.route(/\/models\/.*\.(?:glb|gltf)(?:\?.*)?$/i, (route) => {
    interceptedModels += 1;
    return route.abort("failed");
  });
  await page.goto("/?e2e=1");
  await page.getByRole("button", { name: "Enter Meadowrest" }).click();

  const world = page.getByTestId("game-world");
  await expect(world).toHaveAttribute("data-ready", "true");
  await expect(world).toHaveAttribute("data-asset-warning", /player|targets/);
  expect(interceptedModels).toBeGreaterThan(0);
  expect(await page.evaluate(() =>
    (window as unknown as { __EVERLOOM_TEST__: { activateTarget: (id: string) => boolean } })
      .__EVERLOOM_TEST__.activateTarget("npc_mara"),
  )).toBe(true);
});

test("overlapping checkpoints persist the newest player state", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "IndexedDB write ordering is viewport-independent.");
  await page.goto("/?e2e=1");
  await page.getByRole("button", { name: "Enter Meadowrest" }).click();
  await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true");

  await page.evaluate((targetId) =>
    (window as unknown as { __EVERLOOM_TEST__: { activateTarget: (id: string) => boolean } })
      .__EVERLOOM_TEST__.activateTarget(targetId), "npc_mara");
  await expect(page.getByText(/Pick up the worn hatchet/i)).toBeVisible();
  await page.evaluate((targetId) =>
    (window as unknown as { __EVERLOOM_TEST__: { activateTarget: (id: string) => boolean } })
      .__EVERLOOM_TEST__.activateTarget(targetId), "ground_worn_hatchet");
  await expect(page.getByText(/equip the worn hatchet/i)).toBeVisible();

  await page.evaluate(async () => {
    const api = (window as unknown as { __EVERLOOM_TEST__: {
      equip: (id: string) => boolean;
      save: () => Promise<void>;
    } }).__EVERLOOM_TEST__;
    const earlierCheckpoint = api.save();
    if (!api.equip("worn_hatchet")) throw new Error("Could not equip the test hatchet.");
    const newestCheckpoint = api.save();
    await Promise.all([earlierCheckpoint, newestCheckpoint]);
  });

  await page.reload();
  await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true");
  expect(await page.evaluate(() =>
    (window as unknown as { __EVERLOOM_TEST__: { snapshot: () => { equipment: { tool: string | null } } } })
      .__EVERLOOM_TEST__.snapshot().equipment.tool,
  )).toBe("worn_hatchet");
});

test("a lost WebGL context checkpoints progress and offers recovery", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Context recovery is viewport-independent.");
  await page.goto("/?e2e=1");
  await page.getByRole("button", { name: "Enter Meadowrest" }).click();
  await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true");

  await page.locator("canvas").evaluate((canvas) => {
    canvas.dispatchEvent(new Event("webglcontextlost", { cancelable: true }));
  });

  await expect(page.getByText("The 3D view needs to restart.")).toBeVisible();
  await expect(page.getByText("Your progress has been checkpointed.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Reload world" })).toBeVisible();
});

test("returning to an open backgrounded game applies offline progression", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Lifecycle reconciliation is viewport-independent.");
  test.setTimeout(120_000);
  await page.goto("/?e2e=1");
  await page.getByRole("button", { name: "Enter Meadowrest" }).click();
  await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true");

  const activate = (targetId: string) => page.evaluate((id) =>
    (window as unknown as { __EVERLOOM_TEST__: { activateTarget: (value: string) => boolean } })
      .__EVERLOOM_TEST__.activateTarget(id), targetId);
  await activate("npc_mara");
  await expect(page.getByText(/Pick up the worn hatchet/i)).toBeVisible({ timeout: 35_000 });
  await activate("ground_worn_hatchet");
  await expect(page.getByText(/equip the worn hatchet/i)).toBeVisible({ timeout: 35_000 });
  await page.evaluate(() =>
    (window as unknown as { __EVERLOOM_TEST__: { equip: (id: string) => boolean } })
      .__EVERLOOM_TEST__.equip("worn_hatchet"));
  await activate("oak_west_1");
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible({ timeout: 35_000 });

  await page.evaluate(async () => {
    const resumedAt = Date.now() + 25_000;
    Date.now = () => resumedAt;
    await (window as unknown as { __EVERLOOM_TEST__: { resume: () => Promise<void> } })
      .__EVERLOOM_TEST__.resume();
  });

  await expect(page.getByText("WHILE YOU WERE AWAY")).toBeVisible();
  await expect(page.getByText(/productive minutes/i)).toBeVisible();
  await page.getByRole("button", { name: "Return to Meadowrest" }).click();
  await page.getByRole("button", { name: "Pack" }).click();
  await expect(page.getByText("Meadow Log", { exact: true }).first()).toBeVisible();
});
