import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

// This is the one spec that deliberately does NOT use `?e2e=1` — every other
// spec in this suite does, specifically so the one-time locked opening
// conversation (EscapeIntro) stays out of their way (see
// apps/game/src/components/EscapeIntro.tsx). This file tests that
// conversation directly, on the real first-run path.
const artifactsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "artifacts", "phase-five");
mkdirSync(artifactsDir, { recursive: true });
const artifactPath = (filename: string) => join(artifactsDir, filename);

type TestApi = {
  snapshot: () => {
    quests: Record<string, { status: string; stepIndex: number; stepProgress: number }>;
    worldFlags: Record<string, boolean>;
  };
  activateTarget: (targetId: string) => boolean;
  save: () => Promise<void>;
};

test.describe("Escape intro — locked opening conversation", () => {
  test("a brand new save shows one locked conversation with Mara, then returns full control with a clear next task", async ({ page }, testInfo) => {
    test.setTimeout(60_000);
    const viewSuffix = testInfo.project.name === "desktop" ? "desktop" : "landscape";

    await page.goto("/");
    await page.getByRole("button", { name: "Enter Meadowrest" }).click();
    await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true", { timeout: 35_000 });

    // The conversation appears automatically — no prior interaction needed —
    // and establishes the premise plus the very next concrete task.
    await expect(page.getByText("MARA THREADKEEPER", { exact: true })).toBeVisible();
    await expect(page.getByText(/Loomskiff cannot sail/i)).toBeVisible();
    await expect(page.getByText(/worn hatchet lies beside the western path/i)).toBeVisible();
    await page.waitForTimeout(400);
    await page.screenshot({ path: artifactPath(`escape-intro-conversation-${viewSuffix}.png`), fullPage: true });

    // Locked: a real click on the dock underneath the modal backdrop must
    // not reach it (Playwright's normal .click() performs an actionability
    // check — an obscured element fails/times out rather than clicking
    // through) — proven functionally: no panel opens despite the attempt.
    await page.getByRole("button", { name: "Pack" }).click({ timeout: 1_500 }).catch(() => {});
    await expect(page.getByRole("button", { name: "Close panel" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Continue — find the hatchet/i })).toBeVisible();

    // Dismiss — this is the one and only unlock.
    await page.getByRole("button", { name: /Continue — find the hatchet/i }).click();
    await expect(page.getByText("MARA THREADKEEPER", { exact: true })).toBeHidden();

    // The conversation IS meeting Mara: it must have advanced the real
    // first_thread quest step, not just closed a decorative dialogue box.
    const snapshot = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot());
    expect(snapshot.quests.first_thread).toMatchObject({ status: "active", stepIndex: 1 });
    expect(snapshot.worldFlags.escape_intro_seen).toBe(true);
    await expect(page.locator(".objective")).toContainText(/Pick up the worn hatchet/i);

    // Control is genuinely restored: real HUD interaction now works.
    await page.getByRole("button", { name: "Pack" }).click();
    await expect(page.getByRole("button", { name: "Close panel" })).toBeVisible();
    await page.getByRole("button", { name: "Close panel" }).click();

    await page.waitForTimeout(400);
    await page.screenshot({ path: artifactPath(`escape-intro-dismissed-${viewSuffix}.png`), fullPage: true });

    // Reloading must not show the conversation again.
    await page.reload();
    await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true", { timeout: 35_000 });
    await expect(page.getByText("MARA THREADKEEPER", { exact: true })).toHaveCount(0);
  });

  test("a save that has already met Mara is never treated as a new arrival", async ({ page }) => {
    test.setTimeout(60_000);
    await page.goto("/?e2e=1");
    await page.getByRole("button", { name: "Enter Meadowrest" }).click();
    await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true", { timeout: 35_000 });

    const activated = await page.evaluate(() => (
      window as unknown as { __EVERLOOM_TEST__: TestApi }
    ).__EVERLOOM_TEST__.activateTarget("npc_mara"));
    expect(activated).toBe(true);
    await expect(page.locator(".objective")).toContainText(/Pick up the worn hatchet/i);
    await page.evaluate(() => (
      window as unknown as { __EVERLOOM_TEST__: TestApi }
    ).__EVERLOOM_TEST__.save());

    await page.goto("/");
    await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true", { timeout: 35_000 });
    await expect(page.getByText("MARA THREADKEEPER", { exact: true })).toHaveCount(0);
    await expect(page.locator(".objective")).toContainText(/Pick up the worn hatchet/i);
  });

  test("every other spec's convention (?e2e=1) skips the conversation entirely", async ({ page }) => {
    await page.goto("/?e2e=1");
    await page.getByRole("button", { name: "Enter Meadowrest" }).click();
    await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true", { timeout: 35_000 });
    await page.waitForTimeout(500);
    await expect(page.getByText("MARA THREADKEEPER", { exact: true })).toHaveCount(0);
    await expect(page.locator(".objective")).toContainText(/Meet Mara beside Meadowrest/i);
  });
});
