import path from "node:path";
import { expect, test, type Page } from "@playwright/test";

type TestApi = {
  activateTarget: (id: string) => boolean;
  attuneAllSkills: () => void;
  completeQuest: (questId: string) => void;
  giveItem: (itemId: string, quantity: number) => void;
  equip: (id: string) => boolean;
};

// Not a functional test — this drives the app into the post-awakening Verdant
// Grove state and writes the two hand-inspection screenshots required by the
// Phase Three handoff, straight to disk via page.screenshot().
test("capture Phase Three hand-inspection screenshots", async ({ page }, testInfo) => {
  test.setTimeout(120_000);
  await page.goto("/?e2e=1");
  await page.getByRole("button", { name: "Enter Meadowrest" }).click();
  await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true");

  await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.completeQuest("first_thread"));
  await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.attuneAllSkills());
  await expect(page.locator(".objective")).toContainText(/Tell Mara/i);

  const wentToMara = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.activateTarget("npc_mara"));
  expect(wentToMara).toBe(true);
  await expect(page.locator(".objective")).toContainText(/Walk north/i, { timeout: 35_000 });

  const wokeLoomstone = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.activateTarget("verdant_loomstone"));
  expect(wokeLoomstone).toBe(true);
  await expect(page.locator(".objective")).toContainText(/Meadowrest is steady/i, { timeout: 90_000 });

  // Give the grove a moment for the awakening glow/particles to settle before capture.
  await page.waitForTimeout(1500);

  const outputName = testInfo.project.name === "desktop" ? "phase-three-desktop.png" : "phase-three-landscape.png";
  // testInfo.config.rootDir resolves to this project's testDir (apps/game/tests);
  // walk up to the repo root (apps/game/tests -> apps/game -> apps -> repo root).
  const outputPath = path.resolve(testInfo.config.rootDir, "..", "..", "..", "artifacts", outputName);
  await page.screenshot({ path: outputPath, fullPage: true });

  // eslint-disable-next-line no-console
  console.log(`Wrote screenshot: ${outputPath}`);
});
