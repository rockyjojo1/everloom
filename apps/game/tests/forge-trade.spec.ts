import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test, type Page } from "@playwright/test";

// apps/game/tests/forge-trade.spec.ts -> repo root is three levels up.
// Resolved explicitly (matching phase-four-world-polish.spec.ts) so artifacts
// always land at the exact repo-relative path the assignment specifies.
const artifactsDir = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "artifacts", "phase-five");
mkdirSync(artifactsDir, { recursive: true });
const artifactPath = (filename: string) => join(artifactsDir, filename);

type TestApi = {
  activateTarget: (id: string) => boolean;
  navigateToTarget: (id: string) => boolean;
  equip: (id: string) => boolean;
  simulate: (ms: number) => void;
  stop: () => void;
  dismissReport: () => void;
  attuneAllSkills: () => void;
  completeQuest: (questId: string) => void;
  giveItem: (itemId: string, quantity: number) => void;
  save: () => Promise<void>;
  navigation: () => { route: { x: number; z: number }[]; visual: { x: number; z: number }; hidden: boolean };
  snapshot: () => {
    quests: Record<string, { status: string; stepIndex: number; stepProgress: number }>;
    worldFlags: Record<string, boolean>;
    inventory: { itemId: string; quantity: number }[];
    equipment: { tool: string | null; weapon: string | null; body: string | null };
    skills: Record<string, { xp: number }>;
    player: { hp: number; maxHp: number };
  };
};

/**
 * Walks the player to a real interactable via the same pathToTarget/setRoute
 * flow the pointer handler uses, then waits for the walk animation to finish.
 * Uses navigateToTarget (walk only, never auto-acts) rather than
 * activateTarget, so this test can walk to a facility and start its activity
 * as two separately-timed steps without a race: activateTarget both routes
 * AND auto-performs the target's action on arrival, so calling it once to
 * "walk there" and again to "start the activity" can let the first call's
 * auto-started activity already finish (e.g. inputs_exhausted) before the
 * second call runs, leaving a later `expect(Stop button).toBeVisible()`
 * waiting forever. See phase-four-world-polish.spec.ts for the rationale on
 * the generous timeouts this sandbox's SwiftShader software renderer needs.
 */
async function walkTo(page: Page, targetId: string, timeout = 90_000) {
  const ok = await page.evaluate(
    (id) => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.navigateToTarget(id),
    targetId,
  );
  expect(ok, `navigateToTarget(${targetId}) should find a real path`).toBe(true);
  await expect
    .poll(
      async () =>
        (await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.navigation()))
          .route.length,
      { timeout, message: `player should finish walking to ${targetId}` },
    )
    .toBe(0);
  await page.waitForTimeout(700);
}

async function readWorldMetrics(page: Page): Promise<string | null> {
  const metrics = page.locator(".world-metrics");
  if ((await metrics.count()) === 0) return null;
  return metrics.textContent();
}

function expectDrawBudget(metrics: string | null, location: string): void {
  expect(metrics, `${location} should expose debug world metrics`).not.toBeNull();
  const draws = Number(metrics?.match(/(\d+) draws/)?.[1]);
  expect(Number.isFinite(draws), `${location} should report a numeric draw count: ${metrics}`).toBe(true);
  expect(draws, `${location} should stay within the world draw-call budget`).toBeLessThanOrEqual(350);
}

test.describe("The Forge's Trade — Smithing tutorial loop", () => {
  test("mines, smelts, smiths, and equips the Copper Battleaxe through the real facility loop", async ({ page }, testInfo) => {
    // Real walks to three quarry facilities plus real mine/smelt/smith
    // production ticks, so this gets a large budget like the other full
    // real-navigation chapter specs in this sandbox's software renderer.
    test.setTimeout(600_000);
    const isDesktop = testInfo.project.name === "desktop";
    const viewSuffix = isDesktop ? "desktop" : "landscape";

    const pageErrors: Error[] = [];
    page.on("pageerror", (error) => pageErrors.push(error));

    await page.goto("/?e2e=1&debug=1");
    await page.getByRole("button", { name: "Enter Meadowrest" }).click();
    await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true", { timeout: 35_000 });

    // New players naturally receive The Forge's Trade the instant they finish
    // First Thread — this is the real persisted quest chain
    // (first_thread.nextQuestId now points at forge_trade, not
    // verdant_loomstone directly), not a HUD-only string. The full First
    // Thread walk is already proven end-to-end by phase-one-flow.spec.ts.
    await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.completeQuest("first_thread"));
    let snapshot = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot());
    expect(snapshot.quests.first_thread?.status).toBe("completed");
    expect(snapshot.quests.forge_trade).toEqual({ status: "active", stepIndex: 0, stepProgress: 0 });
    expect(snapshot.quests.verdant_loomstone).toBeUndefined();

    await expect(page.locator(".objective")).toContainText(/Mine four Copper Ore from the northern quarry/i);
    await page.screenshot({ path: artifactPath(`active-smithing-objective-${viewSuffix}.png`), fullPage: true });

    // The pickaxe's ground pickup/equip is already proven end-to-end by
    // phase-one-flow.spec.ts; grant + equip it directly to keep this test's
    // real-movement budget on what Phase Five actually adds. First Thread was
    // force-completed above (not physically played through), so it also did
    // not actually deposit the 3 Meadow Logs that step normally would —
    // grant enough for the smith recipe's 2-log input directly, matching the
    // same precedent verdant-loomstone.spec.ts uses for its own brew step.
    await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.giveItem("worn_pickaxe", 1));
    expect(await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.equip("worn_pickaxe"))).toBe(true);
    await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.giveItem("meadow_log", 4));

    // 1. Mine Copper Ore for real at a physical quarry node.
    await walkTo(page, "copper_north_1");
    const minedStarted = await page.evaluate(() =>
      (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.activateTarget("copper_north_1"));
    expect(minedStarted).toBe(true);
    await expect(page.getByRole("button", { name: "Stop" })).toBeVisible({ timeout: 35_000 });
    // meadowrest_copper always succeeds at actionDurationMs 3200, but each
    // successful gather also puts the node on a 6000ms respawn cooldown
    // before the NEXT action can even begin — so the Nth ore costs roughly
    // 3200 + (N-1) * (3200 + 6000) simulated ms, not just N * 3200. Four ore
    // needs ~30_800ms; simulate comfortably past that.
    await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.simulate(45_000));
    await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.stop());
    // debugSimulateOffline always raises the "WHILE YOU WERE AWAY" modal
    // (unlike the real offline-return path, it has no productive-time
    // threshold gate) — dismiss it every time or it blocks the next UI click.
    await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.dismissReport());

    snapshot = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot());
    const oreCount = snapshot.inventory.find((item) => item.itemId === "copper_ore")?.quantity ?? 0;
    expect(oreCount).toBeGreaterThanOrEqual(4);
    expect(snapshot.quests.forge_trade).toEqual({ status: "active", stepIndex: 1, stepProgress: 0 });
    await expect(page.locator(".objective")).toContainText(/Smelt two Copper Ingots at the Meadowrest Smelter/i);

    // 2 & 3. Smelt two ingots at the furnace — a source-specific "produce"
    // match, constrained by targetId to the Meadowrest Smelter specifically
    // (proven generically at the unit level in core.test.ts's "produce quest
    // step source binding" suite; this proves the real authored content
    // actually wires that binding correctly end-to-end).
    await walkTo(page, "meadowrest_smelter");
    // The anvil sits one grid-step away and is visible in the same frame —
    // this is "the quarry forge area" screenshot.
    await page.screenshot({ path: artifactPath(`quarry-forge-area-${viewSuffix}.png`), fullPage: true });
    const forgeAreaMetrics = await readWorldMetrics(page);
    testInfo.annotations.push({ type: "world-metrics-forge", description: forgeAreaMetrics ?? "unavailable" });
    expectDrawBudget(forgeAreaMetrics, "the quarry forge area");

    const smeltStarted = await page.evaluate(() =>
      (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.activateTarget("meadowrest_smelter"));
    expect(smeltStarted).toBe(true);
    await expect(page.getByRole("button", { name: "Stop" })).toBeVisible({ timeout: 35_000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: artifactPath(`smelting-in-progress-${viewSuffix}.png`), fullPage: true });
    // Production activities (unlike gathering) have no respawn cooldown — 2
    // smelts * 2600ms with generous margin for the in-progress tick.
    await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.simulate(9_000));
    await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.stop());
    await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.dismissReport());

    snapshot = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot());
    const ingotCount = snapshot.inventory.find((item) => item.itemId === "copper_ingot")?.quantity ?? 0;
    expect(ingotCount).toBeGreaterThanOrEqual(2);
    expect(snapshot.quests.forge_trade).toEqual({ status: "active", stepIndex: 2, stepProgress: 0 });
    const smithingXpAfterSmelt = snapshot.skills.smithing?.xp ?? 0;
    expect(smithingXpAfterSmelt).toBeGreaterThanOrEqual(60); // 2 x 30xp smelts
    await expect(page.locator(".objective")).toContainText(/Forge a Copper Battleaxe at the Anvil/i);

    // 4. Smith the battleaxe at the anvil.
    await walkTo(page, "meadowrest_anvil");
    const smithStarted = await page.evaluate(() =>
      (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.activateTarget("meadowrest_anvil"));
    expect(smithStarted).toBe(true);
    await expect(page.getByRole("button", { name: "Stop" })).toBeVisible({ timeout: 35_000 });
    await page.waitForTimeout(600);
    await page.screenshot({ path: artifactPath(`smithing-in-progress-${viewSuffix}.png`), fullPage: true });
    // 3600ms needed for one smith action, with generous margin.
    await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.simulate(7_000));
    await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.stop());
    await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.dismissReport());

    snapshot = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot());
    const axeCount = snapshot.inventory.find((item) => item.itemId === "copper_battleaxe")?.quantity ?? 0;
    expect(axeCount).toBeGreaterThanOrEqual(1);
    expect(snapshot.quests.forge_trade).toEqual({ status: "active", stepIndex: 3, stepProgress: 0 });
    const smithingXpAfterSmith = snapshot.skills.smithing?.xp ?? 0;
    // Both production recipes must have awarded Smithing XP (30xp/smelt, 60xp/smith).
    expect(smithingXpAfterSmith).toBeGreaterThan(smithingXpAfterSmelt);
    expect(smithingXpAfterSmith).toBeGreaterThanOrEqual(120); // 60 (2 smelts) + 60 (1 smith)
    await expect(page.locator(".objective")).toContainText(/Equip the Copper Battleaxe/i);

    // 5. Equip the Copper Battleaxe — a real, observable combat-stat change,
    // measured against the Militia Sword rather than assumed.
    await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.giveItem("meadowrest_sword", 1));
    expect(await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.equip("meadowrest_sword"))).toBe(true);
    await page.getByRole("button", { name: "Skills", exact: true }).click();
    const swordAccuracyText = await page.locator(".combat-summary div", { hasText: "Accuracy" }).innerText();
    await expect(page.locator(".combat-summary")).toContainText("Militia Sword");
    await page.getByRole("button", { name: "Close panel" }).click();

    await page.getByRole("button", { name: "Pack", exact: true }).click();
    const axeRow = page.locator(".inventory article").filter({ hasText: "Copper Battleaxe" });
    await expect(axeRow).toContainText("Accuracy +13");
    await expect(axeRow).toContainText("Strength +8");
    await page.screenshot({ path: artifactPath(`battleaxe-inventory-${viewSuffix}.png`), fullPage: true });
    await axeRow.getByRole("button", { name: "Equip" }).click();
    await page.getByRole("button", { name: "Close panel" }).click();

    await page.getByRole("button", { name: "Skills", exact: true }).click();
    await expect(page.locator(".combat-summary")).toContainText("Weapon: Copper Battleaxe");
    const axeAccuracyText = await page.locator(".combat-summary div", { hasText: "Accuracy" }).innerText();
    await page.screenshot({ path: artifactPath(`battleaxe-equipped-${viewSuffix}.png`), fullPage: true });
    await page.getByRole("button", { name: "Close panel" }).click();

    const swordAccuracy = Number(swordAccuracyText.match(/(\d+)/)?.[1]);
    const axeAccuracy = Number(axeAccuracyText.match(/(\d+)/)?.[1]);
    expect(Number.isFinite(swordAccuracy) && Number.isFinite(axeAccuracy)).toBe(true);
    expect(axeAccuracy).toBeGreaterThan(swordAccuracy);

    snapshot = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot());
    expect(snapshot.equipment.weapon).toBe("copper_battleaxe");
    expect(snapshot.quests.forge_trade?.status).toBe("completed");
    expect(snapshot.worldFlags.forge_trade_completed).toBe(true);
    // Completing The Forge's Trade must chain straight into the Verdant gate.
    expect(snapshot.quests.verdant_loomstone).toEqual({ status: "active", stepIndex: 0, stepProgress: 0 });
    const finishedSmithingXp = snapshot.skills.smithing?.xp ?? 0;

    // Save/reload equivalence: the completed chapter, equipped axe, and
    // Smithing XP must all survive a real reload through the production
    // IndexedDB path (not merely the deterministic core-level proof).
    await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.save());
    await page.reload();
    await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true", { timeout: 35_000 });
    snapshot = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot());
    expect(snapshot.equipment.weapon).toBe("copper_battleaxe");
    expect(snapshot.quests.forge_trade?.status).toBe("completed");
    expect(snapshot.skills.smithing?.xp).toBe(finishedSmithingXp);

    // 6. Six-skill tutorial completion: drive on through the Verdant gate
    // (real Loomstone interaction, same as verdant-loomstone.spec.ts) so all
    // six Meadowrest skills — including Smithing, which sits outside the
    // five-skill attunement gate by design — show real, non-zero progress.
    await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.attuneAllSkills());
    await expect(page.locator(".objective")).toContainText(/Tell Mara the five threads are ready/i, { timeout: 60_000 });
    await walkTo(page, "npc_mara", 150_000);
    const talkedToMara = await page.evaluate(() =>
      (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.activateTarget("npc_mara"));
    expect(talkedToMara).toBe(true);
    await expect(page.locator(".objective")).toContainText(/Walk north to the grove and wake the Verdant Loomstone/i, { timeout: 30_000 });
    await walkTo(page, "verdant_loomstone", 150_000);
    const wokeLoomstone = await page.evaluate(() =>
      (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.activateTarget("verdant_loomstone"));
    expect(wokeLoomstone).toBe(true);
    await expect(page.getByText("The Verdant Loomstone wakes beneath the grove.")).toBeVisible({ timeout: 30_000 });

    // groves_gift's own gather-and-brew loop is already exercised in full by
    // verdant-loomstone.spec.ts; force-complete it here purely to reach the
    // authored end of the current Meadowrest tutorial chain for the
    // completion screenshot.
    await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.completeQuest("groves_gift"));

    snapshot = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot());
    expect(snapshot.quests.groves_gift?.status).toBe("completed");
    for (const skill of ["woodcutting", "mining", "fishing", "cooking", "smithing", "melee"]) {
      expect(snapshot.skills[skill]?.xp ?? 0, `${skill} should have real XP by tutorial completion`).toBeGreaterThan(0);
    }

    await page.getByRole("button", { name: "Skills", exact: true }).click();
    await expect(page.locator(".rows")).toContainText("smithing");
    await page.waitForTimeout(500);
    await page.screenshot({ path: artifactPath(`six-skill-tutorial-completion-${viewSuffix}.png`), fullPage: true });

    expect(pageErrors, `page errors: ${pageErrors.map((error) => error.message).join("; ")}`).toHaveLength(0);
  });
});
