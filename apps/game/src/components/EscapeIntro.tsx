import { useGameStore } from "../game/store";

/**
 * A brief, one-time locked conversation with Mara establishing the island-
 * escape goal and the real next task. It does not replace the existing
 * "meet_mara" quest step; it fulfils it (see store.dismissEscapeIntro).
 *
 * Skipped entirely in automated test runs (`?e2e=1`, the convention every
 * Playwright spec in this project already uses) so this one-time modal
 * doesn't block the hundred or so existing UI-click assertions across the
 * test suite; a dedicated spec (escape-intro.spec.ts) tests it for real by
 * omitting that flag.
 */
export function EscapeIntro() {
  const save = useGameStore((state) => state.save);
  const dismissEscapeIntro = useGameStore((state) => state.dismissEscapeIntro);
  const skip = new URLSearchParams(location.search).has("e2e");
  const firstThread = save?.quests.first_thread;
  const isUntouchedFirstThread = firstThread?.status === "active"
    && firstThread.stepIndex === 0
    && firstThread.stepProgress === 0;
  if (!save || skip || save.worldFlags.escape_intro_seen || !isUntouchedFirstThread) return null;

  return <div className="modal-backdrop"><section className="intro glass escape-intro">
    <span className="eyebrow">MARA THREADKEEPER</span>
    <h1>The Loomskiff cannot sail.</h1>
    <p>"Its frame is split, its stores are empty, and the channel beyond Meadowrest is tangled shut. If we're leaving this island, we'll rebuild what we can and wake the Loomstones that guide the crossing."</p>
    <p>"Start with timber. A worn hatchet lies beside the western path. Bring back three Meadow Logs; then we'll put the quarry's copper to work."</p>
    <button className="primary" onClick={dismissEscapeIntro}>Continue — find the hatchet</button>
  </section></div>;
}
