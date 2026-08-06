import { describe, expect, it } from "vitest";
import { didCycleComplete, presentationForProgress } from "./actionPresentation";

describe("presentationForProgress", () => {
  it("starts in windup at the beginning of a cycle", () => {
    expect(presentationForProgress(0, 2400).phase).toBe("windup");
    expect(presentationForProgress(0, 2400).cycleProgress).toBe(0);
  });

  it("reaches impact partway through the cycle, before recovery", () => {
    expect(presentationForProgress(1400, 2400).phase).toBe("impact");
  });

  it("reaches recovery near the end of the cycle", () => {
    expect(presentationForProgress(2200, 2400).phase).toBe("recovery");
  });

  it("clamps cycleProgress to [0, 1] for out-of-range progress", () => {
    expect(presentationForProgress(-50, 2400).cycleProgress).toBe(0);
    expect(presentationForProgress(9999, 2400).cycleProgress).toBe(1);
  });

  it("falls back to windup for a zero or negative duration", () => {
    expect(presentationForProgress(100, 0)).toEqual({ phase: "windup", cycleProgress: 0 });
  });
});

describe("didCycleComplete", () => {
  it("detects the wrap when progress resets after a reward", () => {
    expect(didCycleComplete(2380, 40)).toBe(true);
  });

  it("does not fire while progress is still climbing", () => {
    expect(didCycleComplete(400, 900)).toBe(false);
  });

  it("does not fire on the very first frame of a fresh activity", () => {
    expect(didCycleComplete(0, 16)).toBe(false);
  });
});
