import { expect, test } from "@playwright/test";

test("the installed production game reopens offline with its world and save", async ({ page, context }) => {
  await page.goto("/?e2e=1");
  await page.getByRole("button", { name: "Enter Meadowrest" }).click();
  await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true");

  await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) throw new Error("Service workers are unavailable.");
    await navigator.serviceWorker.ready;
  });

  // The first controlled navigation activates the generated worker. It also proves
  // the entry document and every requested world model have reached their caches.
  await page.reload();
  await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true");
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect(page.getByTestId("game-world")).toHaveAttribute("data-assets-settled", "true", { timeout: 60_000 });

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true");
  await expect(page.getByText(/Meet Mara beside Meadowrest/i)).toBeVisible();
});

test.describe("production world-chunk recovery", () => {
  // A generated service worker may precache the chunk before page.route sees
  // it, making this failure injection timing-dependent. Blocking workers in
  // this one context guarantees the request reaches Playwright's route.
  test.use({ serviceWorkers: "block" });

  test("a failed production world chunk leaves the save-safe recovery screen", async ({ page }) => {
    await page.route(/\/assets\/GameWorld-[^/]+\.js$/, (route) => route.abort("failed"));
    await page.goto("/?e2e=1");
    await page.getByRole("button", { name: "Enter Meadowrest" }).click();

    await expect(page.getByRole("heading", { name: "Meadowrest could not open." })).toBeVisible();
    await expect(page.getByRole("button", { name: "Reload Everloom" })).toBeVisible();
  });
});
