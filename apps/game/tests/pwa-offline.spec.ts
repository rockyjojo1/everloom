import { expect, test } from "@playwright/test";

test("the installed production game reopens offline with its world and save", async ({ page, context }) => {
  await page.goto("/");
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

  await context.setOffline(true);
  await page.reload({ waitUntil: "domcontentloaded" });

  await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true");
  await expect(page.getByText(/Meet Mara beside Meadowrest/i)).toBeVisible();
});
