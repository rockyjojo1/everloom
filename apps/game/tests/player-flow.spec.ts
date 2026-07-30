import { expect, test, type Page } from "@playwright/test";

async function clickTarget(page: Page, targetId: string) {
  const started = await page.evaluate((id) => {
    const api = (window as unknown as { __EVERLOOM_TEST__: { activateTarget: (target: string) => boolean } }).__EVERLOOM_TEST__;
    return api.activateTarget(id);
  }, targetId);
  if (!started) throw new Error(`Could not activate ${targetId}`);
}

test("first tree is a complete persisted player flow", async ({ page }) => {
  await page.goto("/?e2e=1");
  await page.getByRole("button", { name: "Enter Meadowrest" }).click();
  await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true");

  await clickTarget(page, "npc_mara");
  await expect(page.getByText(/Pick up the worn hatchet/i)).toBeVisible();

  await clickTarget(page, "ground_worn_hatchet");
  await expect(page.getByText(/Open your pack and equip/i)).toBeVisible();
  await page.getByRole("button", { name: "Pack" }).click();
  await page.getByText("Worn Hatchet", { exact: true }).first().click();
  await page.locator("article").filter({ hasText: "Worn Hatchet" }).getByRole("button", { name: "Equip" }).click();
  await expect(page.getByText(/Chop three Meadow Logs/i)).toBeVisible();
  await page.getByRole("button", { name: "Close panel" }).click();

  await clickTarget(page, "oak_west_1");
  await expect(page.getByText(/Obtained 1 × Meadow Log/i)).toBeVisible();
  await page.getByRole("button", { name: "Stop" }).click();
  await expect(page.getByText(/1 \/ 3/)).toBeVisible();
  await page.reload();
  await expect(page.getByText(/Chop three Meadow Logs/i)).toBeVisible();
  await page.getByRole("button", { name: "Pack" }).click();
  await expect(page.getByText("Meadow Log", { exact: true }).first()).toBeVisible();
});

test("developer asset browser exposes the full indexed library", async ({ page }) => {
  await page.goto("/?asset-browser=1");
  await expect(page.getByText(/554 assets indexed/i)).toBeVisible();
  await expect(page.getByText("Everloom Asset Browser")).toBeVisible();
  await page.getByPlaceholder("Filter assets…").fill("skeleton");
  await expect(page.locator(".asset-list button").first()).toBeVisible();
});
