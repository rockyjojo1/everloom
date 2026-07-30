import { expect, test } from "@playwright/test";

test("capture polished world", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Enter Meadowrest" }).click();
  await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true");
  await page.waitForTimeout(2500);
  await page.screenshot({ path: testInfo.outputPath(`everloom-${testInfo.project.name}.png`), fullPage: true });
});

test("capture asset browser", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "One desktop evidence capture is sufficient.");
  await page.goto("/?asset-browser=1");
  await expect(page.getByText(/554 assets indexed/i)).toBeVisible();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: testInfo.outputPath("everloom-asset-browser.png"), fullPage: true });
});
