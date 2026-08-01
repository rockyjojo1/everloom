import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

// This spec proves a specific, previously-reported onboarding defect is
// fixed: a manual tester could not locate the starter Worn Pickaxe. That is
// a release-blocking clarity problem, not a player mistake, so it gets a
// dedicated regression test rather than being folded into the broader First
// Thread walkthrough (phase-one-flow.spec.ts). This test uses ONLY real
// pathfinding/interaction (`activateTarget`, which performs the same
// route+action a real click does) — never the debug-only shortcuts
// (`completeQuest`, `giveItem`, `attuneAllSkills`) that skip real gameplay.
const artifactsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "artifacts", "phase-five");
mkdirSync(artifactsDir, { recursive: true });
const artifactPath = (filename: string) => join(artifactsDir, filename);

type TestApi = {
  activateTarget: (id: string) => boolean;
  navigateToTarget: (id: string) => boolean;
  snapshot: () => {
    quests: Record<string, { status: string; stepIndex: number; stepProgress: number }>;
    inventory: { itemId: string; quantity: number }[];
  };
  objectiveBeacon: () => { visible: boolean; targetId: string | null };
  objectiveRoute: () => { visible: boolean; targetId: string | null; points: number };
  equipmentVisual: () => { itemId: string | null; attached: boolean };
  visibleTarget: (targetId: string) => boolean;
  visibleLabel: (targetId: string) => boolean;
};

async function activate(page: Page, target: string, objective: RegExp) {
  const ok = await page.evaluate((id) => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.activateTarget(id), target);
  expect(ok, `activateTarget(${target}) should find a real path`).toBe(true);
  await expect(page.locator(".objective")).toContainText(objective, { timeout: 35_000 });
}

// Navigation-only walk (no auto-action), used purely to bring the camera
// close enough to a target for a screenshot to actually show its beacon —
// see forge-trade.spec.ts for the full rationale on why this is distinct
// from activateTarget.
async function walkNear(page: Page, targetId: string, timeout = 60_000) {
  const ok = await page.evaluate((id) => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.navigateToTarget(id), targetId);
  expect(ok, `navigateToTarget(${targetId}) should find a real path`).toBe(true);
  await expect
    .poll(
      async () => (await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: { navigation: () => { route: unknown[] } } }).__EVERLOOM_TEST__.navigation())).route.length,
      { timeout, message: `player should finish walking near ${targetId}` },
    )
    .toBe(0);
  await page.waitForTimeout(700);
}

async function beacon(page: Page) {
  return page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.objectiveBeacon());
}

test.describe("Tutorial guidance — starter tool discoverability", () => {
  test("a fresh save's objective beacon leads a player straight to the Worn Pickaxe, and it is genuinely reachable", async ({ page }, testInfo) => {
    test.setTimeout(180_000);
    const isDesktop = testInfo.project.name === "desktop";
    const viewSuffix = isDesktop ? "desktop" : "landscape";

    await page.goto("/?e2e=1");
    await page.getByRole("button", { name: "Enter Meadowrest" }).click();
    await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true", { timeout: 35_000 });
    await page.waitForTimeout(400);

    // Step 1 (meet_mara, targetId npc_mara): the beacon should already be
    // guiding the player to Mara before they have clicked anything.
    let mark = await beacon(page);
    expect(mark).toEqual({ visible: true, targetId: "npc_mara" });
    await expect(page.locator(".objective-map-marker")).toHaveAttribute("data-target-id", "npc_mara");

    // The trail is present by default. The button remains available only to
    // refresh it from the player's new position.
    await expect.poll(async () => page.evaluate(() => (
      window as unknown as { __EVERLOOM_TEST__: TestApi }
    ).__EVERLOOM_TEST__.objectiveRoute())).toMatchObject({ visible: true, targetId: "npc_mara" });
    await expect.poll(async () => page.evaluate(() => (
      window as unknown as { __EVERLOOM_TEST__: TestApi }
    ).__EVERLOOM_TEST__.visibleLabel("npc_mara"))).toBe(true);

    await activate(page, "npc_mara", /Pick up the worn hatchet/i);

    // Step 2 (pickup_hatchet, targetId ground_worn_hatchet): the beacon must
    // now point at the hatchet, proving the guidance follows quest progress
    // in real time, not just at load.
    mark = await beacon(page);
    expect(mark).toEqual({ visible: true, targetId: "ground_worn_hatchet" });
    await expect(page.locator(".objective-map-marker")).toHaveAttribute("data-target-id", "ground_worn_hatchet");
    await expect.poll(async () => page.evaluate(() => (
      window as unknown as { __EVERLOOM_TEST__: TestApi }
    ).__EVERLOOM_TEST__.objectiveRoute())).toMatchObject({ visible: true, targetId: "ground_worn_hatchet" });
    await expect.poll(async () => page.evaluate(() => (
      window as unknown as { __EVERLOOM_TEST__: TestApi }
    ).__EVERLOOM_TEST__.visibleLabel("ground_worn_hatchet"))).toBe(true);
    await page.waitForTimeout(350);
    await page.screenshot({ path: artifactPath(`objective-route-${viewSuffix}.png`), fullPage: true });

    await activate(page, "ground_worn_hatchet", /Open your pack and equip the worn hatchet/i);

    // Step 3 is a UI action rather than a world target. The beacon clears,
    // while the objective itself provides a direct, working Pack action.
    mark = await beacon(page);
    expect(mark).toEqual({ visible: false, targetId: null });
    await expect(page.locator(".objective")).toContainText(/Open Pack below/i);

    await page.getByRole("button", { name: "Open Pack" }).click();
    await page.locator("article").filter({ hasText: "Worn Hatchet" }).getByRole("button", { name: "Equip" }).click();
    await expect.poll(async () => page.evaluate(() => (
      window as unknown as { __EVERLOOM_TEST__: TestApi }
    ).__EVERLOOM_TEST__.equipmentVisual())).toEqual({ itemId: "worn_hatchet", attached: true });
    await expect(page.getByText(/Chop three Meadow Logs/i)).toBeVisible();
    await page.getByRole("button", { name: "Close panel" }).click();

    // Step 4 accepts any oak, but guidanceTargetId deliberately chooses one
    // representative nearby oak so the player is never left without a lead.
    mark = await beacon(page);
    expect(mark).toEqual({ visible: true, targetId: "oak_west_1" });
    await expect(page.locator(".objective")).toContainText(/gold marker to the western oaks/i);

    await activate(page, "oak_west_1", /Chop three Meadow Logs|Collect the worn pickaxe/i);
    // meadowrest_oak always succeeds at actionDurationMs 2800 with a 5500ms
    // respawn cooldown between successful chops — same shape of timing as
    // meadowrest_copper (see forge-trade.spec.ts). Real time, not a debug
    // jump: 21s comfortably covers the three logs (matches the budget
    // phase-one-flow.spec.ts already proved sufficient for this same step).
    await expect(page.getByRole("button", { name: "Stop" })).toBeVisible({ timeout: 35_000 });
    await expect.poll(async () => page.evaluate(() => (
      window as unknown as { __EVERLOOM_TEST__: TestApi }
    ).__EVERLOOM_TEST__.visibleTarget("oak_west_1"))).toBe(true);
    await expect(page.locator(".objective")).toContainText(/Collect the worn pickaxe at the quarry entrance/i, { timeout: 40_000 });
    await page.getByRole("button", { name: "Stop" }).click();

    // Step 5 (pickup_pickaxe, targetId ground_worn_pickaxe): this is the
    // exact defect under test. The beacon must now clearly mark the
    // pickaxe's real world location.
    mark = await beacon(page);
    expect(mark).toEqual({ visible: true, targetId: "ground_worn_pickaxe" });

    // Walk close enough that the beacon is actually inside the camera frame
    // before capturing — the follow camera tracks the player, not the
    // objective, so a screenshot taken before walking would only prove the
    // objective TEXT changed, not that the beacon is visually present.
    await walkNear(page, "ground_worn_pickaxe");
    await page.waitForTimeout(500);
    await page.screenshot({ path: artifactPath(`pickaxe-objective-beacon-${viewSuffix}.png`), fullPage: true });

    // Prove it is not just labeled but genuinely reachable and pickup-able,
    // through real pathfinding and the real pickup action — no debug helper.
    await activate(page, "ground_worn_pickaxe", /Equip the worn pickaxe/i);
    const snapshot = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot());
    expect(snapshot.quests.first_thread).toMatchObject({ status: "active" });
    expect(snapshot.inventory.some((item) => item.itemId === "worn_pickaxe")).toBe(true);

    // Step 6 (equip_pickaxe, targetId: null again) — beacon correctly clears.
    mark = await beacon(page);
    expect(mark).toEqual({ visible: false, targetId: null });
    await expect(page.getByRole("button", { name: "Open Pack" })).toBeVisible();
  });
});
