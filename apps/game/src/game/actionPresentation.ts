// Pure timing logic for the gathering wind-up/impact/recovery cycle. Reward
// timing itself is never decided here — it stays fully owned by the
// authoritative simulation (packages/core/src/simulation.ts), which resets
// currentActivity.progressMs to 0 and emits item_gained/xp_gained events at
// the exact tick a cycle completes. This module only classifies where in
// that already-authoritative cycle the presentation layer currently is, so
// animation/impact-FX/audio can track it without a second, competing timer.
export type ActionPhase = "windup" | "impact" | "recovery";

export interface ActionPresentation {
  readonly phase: ActionPhase;
  readonly cycleProgress: number;
}

// Fractions of the cycle where each phase begins. Impact sits late in the
// swing (an axe/pickaxe connects near the end of its animation, not at the
// midpoint), leaving a short recovery beat before the next cycle.
const IMPACT_START = 0.55;
const RECOVERY_START = 0.82;

export function presentationForProgress(progressMs: number, durationMs: number): ActionPresentation {
  if (durationMs <= 0) return { phase: "windup", cycleProgress: 0 };
  const cycleProgress = Math.max(0, Math.min(1, progressMs / durationMs));
  const phase: ActionPhase =
    cycleProgress < IMPACT_START ? "windup" : cycleProgress < RECOVERY_START ? "impact" : "recovery";
  return { phase, cycleProgress };
}

// The simulation resets progressMs to 0 (or a small remainder) exactly when
// a cycle completes and grants its reward. Comparing this frame's progressMs
// against last frame's is how the presentation layer detects that moment
// without owning any timing of its own — it is purely reactive to the
// authoritative state.
export function didCycleComplete(previousProgressMs: number, currentProgressMs: number): boolean {
  return currentProgressMs < previousProgressMs;
}
