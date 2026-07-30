import { expect, test, type Page } from "@playwright/test";

type TestApi = {
  activateTarget: (id: string) => boolean;
  equip: (id: string) => boolean;
  simulate: (ms: number) => void;
  stop: () => void;
  dismissReport: () => void;
  attuneAllSkills: () => void;
  completeQuest: (questId: string) => void;
  giveItem: (itemId: string, quantity: number) => void;
  damage: () => void;
  consume: (itemId: string) => boolean;
  snapshot: () => {
    quests: Record<string, { status: string; stepIndex: number; stepProgress: number }>;
    worldFlags: Record<string, boolean>;
    inventory: { itemId: string; quantity: number }[];
    player: { hp: number; maxHp: number };
  };
};

async function activate(page: Page, target: string, objective: RegExp) {
  const ok = await page.evaluate((id) => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.activateTarget(id), target);
  expect(ok).toBe(true);
  await expect(page.locator(".objective")).toContainText(objective, { timeout: 35_000 });
}

test.describe("The Verdant Loomstone", () => {
  test("formalizes the attunement gate, chains from The First Thread, awakens the Loomstone, and unlocks the grove reward", async ({ page }, testInfo) => {
    test.setTimeout(210_000);
    await page.goto("/?e2e=1");
    await page.getByRole("button", { name: "Enter Meadowrest" }).click();
    await expect(page.getByTestId("game-world")).toHaveAttribute("data-ready", "true");

    // The full First Thread flow (grinding every skill, equipping every tool,
    // defeating the skeleton) is already exercised end-to-end by
    // phase-one-flow.spec.ts. This test starts from "First Thread complete" via
    // the same dev-only debug hook exposed to the DebugPanel, so it can focus
    // its time budget on what Phase Three actually adds.
    await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.completeQuest("first_thread"));

    let snapshot = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot());
    expect(snapshot.quests.first_thread?.status).toBe("completed");
    // Completing First Thread must chain straight into the new quest — this is
    // persisted quest state, not HUD-only text.
    expect(snapshot.quests.verdant_loomstone).toEqual({ status: "active", stepIndex: 0, stepProgress: 0 });

    await expect(page.locator(".objective")).toContainText(/Strengthen every Meadowrest skill to level 5\. 0 of 5 attuned\./i);
    await page.getByRole("button", { name: "Thread" }).click();
    await expect(page.getByText("The Verdant Loomstone", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Close panel" }).click();

    // Grinding five skills to level 5 for real is already covered by core's
    // deterministic unit tests (applyQuestEvents "attune" step). Here we drive
    // the exact same xp_gained/level_gained event pipeline through the running
    // game (not a fabricated shortcut) to reach the gate quickly.
    await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.attuneAllSkills());

    await expect(page.locator(".objective")).toContainText(/Tell Mara the five threads are ready/i);
    snapshot = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot());
    expect(snapshot.quests.verdant_loomstone).toEqual({ status: "active", stepIndex: 1, stepProgress: 0 });

    await page.screenshot({ path: testInfo.outputPath("everloom-attunement-complete.png"), fullPage: true });

    // Real NPC interaction.
    await activate(page, "npc_mara", /Walk north to the grove and wake the Verdant Loomstone/i);

    // The grove reward must still be locked before the Loomstone is touched.
    const lockedBefore = await page.evaluate(() =>
      (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.activateTarget("verdant_heartwood_1"));
    expect(lockedBefore).toBe(false);

    // Real Loomstone interaction — this is the chapter's culmination, and the
    // longest single trek in this test (village to the northern grove), so it
    // gets a larger movement budget than the shorter walks above.
    const ok = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.activateTarget("verdant_loomstone"));
    expect(ok).toBe(true);
    await expect(page.locator(".objective")).toContainText(/Harvest two Heartwood Logs/i, { timeout: 90_000 });
    await expect(page.getByText("The Verdant Loomstone wakes beneath the grove.")).toBeVisible();

    snapshot = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot());
    expect(snapshot.quests.verdant_loomstone?.status).toBe("completed");
    expect(snapshot.quests.groves_gift).toEqual({ status: "active", stepIndex: 0, stepProgress: 0 });
    expect(snapshot.worldFlags.verdant_loomstone_awakened).toBe(true);

    await page.screenshot({ path: testInfo.outputPath("everloom-verdant-awakened.png"), fullPage: true });

    // Meaningful gameplay after the gate: the reward-tier resource + recipe are
    // now reachable and actually change what the player can do. Granting the
    // hatchet directly (instead of walking all the way back to its ground
    // spawn near the village) keeps this test's real-movement budget on what
    // Phase Three actually added; picking up starter tools from the ground is
    // already covered end-to-end by phase-one-flow.spec.ts and
    // player-flow.spec.ts.
    await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.giveItem("worn_hatchet", 1));
    const equipped = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.equip("worn_hatchet"));
    expect(equipped).toBe(true);

    const startedHeartwood = await page.evaluate(() =>
      (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.activateTarget("verdant_heartwood_1"));
    expect(startedHeartwood).toBe(true);
    await expect(page.getByRole("button", { name: "Stop" })).toBeVisible({ timeout: 35_000 });
    await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.simulate(20_000));
    await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.stop());

    snapshot = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot());
    expect(snapshot.inventory.some((item) => item.itemId === "heartwood_log" && item.quantity > 0)).toBe(true);
    expect(snapshot.quests.groves_gift?.stepIndex).toBe(1);
    await expect(page.locator(".objective")).toContainText(/Brew a Verdant Tonic at the Grove Hearth/i);

    // Now brew the reward recipe at the grove hearth and confirm it is a real,
    // observable gameplay improvement (heals more than the tutorial food). The
    // recipe also needs a raw_riverling — fishing it for real is already
    // covered by phase-one-flow.spec.ts, so grant one directly here to keep
    // this test focused on the new hearth/recipe mechanics.
    await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.giveItem("raw_riverling", 1));
    const startedHearth = await page.evaluate(() =>
      (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.activateTarget("grove_hearth"));
    expect(startedHearth).toBe(true);
    await expect(page.getByRole("button", { name: "Stop" })).toBeVisible({ timeout: 35_000 });
    await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.simulate(30_000));
    await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.stop());
    await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.dismissReport());

    snapshot = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot());
    const tonicBefore = snapshot.inventory.find((item) => item.itemId === "verdant_tonic")?.quantity ?? 0;
    expect(tonicBefore).toBeGreaterThan(0);
    expect(snapshot.quests.groves_gift?.status).toBe("completed");
    expect(snapshot.worldFlags.groves_gift_completed).toBe(true);

    // Prove the reward changes play, rather than merely existing in inventory.
    await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.damage());
    snapshot = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot());
    expect(snapshot.player.hp).toBe(snapshot.player.maxHp - 5);
    const consumed = await page.evaluate(() =>
      (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.consume("verdant_tonic"));
    expect(consumed).toBe(true);
    snapshot = await page.evaluate(() => (window as unknown as { __EVERLOOM_TEST__: TestApi }).__EVERLOOM_TEST__.snapshot());
    expect(snapshot.player.hp).toBe(snapshot.player.maxHp);
    expect(snapshot.inventory.find((item) => item.itemId === "verdant_tonic")?.quantity ?? 0).toBe(tonicBefore - 1);

    await page.screenshot({ path: testInfo.outputPath("everloom-grove-reward.png"), fullPage: true });
  });
});
