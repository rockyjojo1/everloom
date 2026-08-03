import { expect, test } from "@playwright/test";

// Delivery proof only: confirms the authoritative apps/game runtime can
// actually fetch real model bytes from the canonical packages/assets/models
// root through a real browser during initial Meadowrest load. This does not
// assert anything about visual quality, production-art status, or
// placeholder-vs-final classification — see docs/authority/ART_PIPELINE.md
// and the visual-production manifest for that.
test("initial Meadowrest load delivers real models with zero /models/ 404s", async ({ page }) => {
  const modelRequests: { url: string; status: number }[] = [];
  page.on("response", (response) => {
    const url = response.url();
    if (url.includes("/models/")) {
      modelRequests.push({ url, status: response.status() });
    }
  });

  await page.goto("/?e2e=1");
  await page.getByRole("button", { name: "Enter Meadowrest" }).click();
  await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true", { timeout: 35_000 });

  // Give in-flight model fetches a moment to resolve after the world reports ready.
  await page.waitForTimeout(1000);

  const failed = modelRequests.filter((r) => r.status >= 400);
  expect(failed, `model requests that failed: ${JSON.stringify(failed, null, 2)}`).toEqual([]);
  expect(modelRequests.length).toBeGreaterThan(0);

  const playerRequest = modelRequests.find((r) => r.url.includes("kaykit-adventurers/Character.glb"));
  expect(playerRequest?.status).toBe(200);

  const environmentRequest = modelRequests.find((r) =>
    r.url.includes("kenney-nature/") || r.url.includes("kenney-fantasy/"));
  expect(environmentRequest?.status).toBe(200);
});
