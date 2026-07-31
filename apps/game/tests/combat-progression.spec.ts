import { expect, test } from "@playwright/test";

type TestApi = {
  activateTarget: (id: string) => boolean;
  attuneAllSkills: () => void;
  giveItem: (itemId: string, quantity: number) => void;
  equip: (itemId: string) => boolean;
  simulate: (elapsedMs: number) => void;
  dismissReport: () => void;
  save: () => Promise<void>;
  snapshot: () => {
    player: { hp: number; maxHp: number };
    equipment: { weapon: string | null; body: string | null };
    inventory: { itemId: string; quantity: number }[];
    collections: string[];
    currentActivity: { type: string } | null;
  };
};

test("combat equipment changes derived stats and the skeleton awards a persistent upgrade", async ({ page }, testInfo) => {
  test.setTimeout(180_000);
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));

  await page.goto("/?e2e=1");
  await page.getByRole("button", { name: "Enter Meadowrest" }).click();
  await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true", { timeout: 35_000 });

  await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.attuneAllSkills());
  await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.giveItem("meadowrest_sword", 1));
  expect(await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.equip("meadowrest_sword"))).toBe(true);

  await page.getByRole("button", { name: "Skills" }).click();
  const profile = page.locator(".combat-summary");
  await expect(profile).toContainText("Level 5");
  await expect(profile).toContainText("Accuracy35");
  await expect(profile).toContainText("Max hit7");
  await expect(profile).toContainText("Defence20");
  await expect(profile).toContainText("Militia Sword");
  await page.getByRole("button", { name: "Close panel" }).click();

  expect(await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.activateTarget("skeleton_east"))).toBe(true);
  await expect(page.getByRole("button", { name: "Stop" })).toBeVisible({ timeout: 45_000 });
  await expect(page.locator(".activity")).toContainText("Lv 4");
  await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.simulate(60_000));
  await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.dismissReport());

  let snapshot = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot());
  expect(snapshot.currentActivity).toBeNull();
  expect(snapshot.player.hp).toBeGreaterThan(0);
  expect(snapshot.inventory.some((item) => item.itemId === "boneguard_vest")).toBe(true);
  expect(snapshot.collections).toContain("boneguard_vest");

  await page.getByRole("button", { name: "Pack" }).click();
  const vest = page.locator(".inventory article").filter({ hasText: "Boneguard Vest" });
  await expect(vest).toContainText("Defence +10");
  await page.screenshot({ path: testInfo.outputPath("combat-reward.png"), fullPage: true });
  await page.getByRole("button", { name: "Close panel" }).click();

  expect(await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.equip("boneguard_vest"))).toBe(true);
  await page.getByRole("button", { name: "Skills" }).click();
  await expect(page.locator(".combat-summary")).toContainText("Defence30");
  await expect(page.locator(".combat-summary")).toContainText("Body: Boneguard Vest");
  await page.screenshot({ path: testInfo.outputPath("combat-profile.png"), fullPage: true });
  await page.getByRole("button", { name: "Close panel" }).click();

  await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.save());
  await page.reload();
  await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true", { timeout: 35_000 });
  snapshot = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot());
  expect(snapshot.equipment).toMatchObject({ weapon: "meadowrest_sword", body: "boneguard_vest" });
  await page.getByRole("button", { name: "Skills" }).click();
  await expect(page.locator(".combat-summary")).toContainText("Defence30");
  expect(pageErrors).toEqual([]);
});
