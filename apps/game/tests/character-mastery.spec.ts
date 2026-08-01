import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const artifactsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "artifacts", "phase-six");
mkdirSync(artifactsDir, { recursive: true });

test("character creation persists into the world and mastery is legible", async ({ page }, testInfo) => {
  const consoleErrors: string[] = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });

  await page.goto("/?e2e=1");
  await expect(page.getByRole("heading", { name: "Who washed ashore?" })).toBeVisible();
  await page.getByLabel("Character name").fill("Rook Tideborn");
  await page.getByRole("button", { name: "tide" }).click();
  await page.getByRole("button", { name: "Enter Meadowrest" }).click();
  await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true", { timeout: 35_000 });

  const player = await page.evaluate(() => (window as unknown as {
    __EVERLOOM_TEST__: { snapshot: () => { player: { name: string; appearanceId: string } } };
  }).__EVERLOOM_TEST__.snapshot().player);
  expect(player).toMatchObject({ name: "Rook Tideborn", appearanceId: "tide" });
  await expect(page.locator(".player-label")).toHaveText("Rook Tideborn");

  await page.getByRole("button", { name: "Skills", exact: true }).click();
  await expect(page.getByText("Practice changes the grind")).toBeVisible();
  await expect(page.locator(".mastery-grid article")).toHaveCount(4);
  await expect(page.locator(".mastery-grid")).toContainText("next rank:");
  await page.screenshot({
    path: join(artifactsDir, `character-mastery-${testInfo.project.name}.png`),
    fullPage: true,
  });

  expect(consoleErrors).toEqual([]);
});
