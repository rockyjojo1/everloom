import { expect, test } from "@playwright/test";

test("fresh saves defer the 3D runtime until the player enters Meadowrest", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop", "Loading behavior is viewport-independent.");
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));

  await page.goto("/?e2e=1");
  await expect(page.getByRole("button", { name: "Enter Meadowrest" })).toBeVisible();
  expect(requests.some((url) => url.includes("/world/GameWorld.tsx"))).toBe(false);
  await expect(page.getByTestId("game-world")).toHaveCount(0);

  await page.getByRole("button", { name: "Enter Meadowrest" }).click();
  await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true");
  expect(requests.some((url) => url.includes("/world/GameWorld.tsx"))).toBe(true);
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
