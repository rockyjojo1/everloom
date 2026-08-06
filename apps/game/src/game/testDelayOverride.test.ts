import { describe, expect, it } from "vitest";
import { MAX_TEST_DELAY_MS, sanitiseTestDelayOverride } from "./testDelayOverride";

describe("sanitiseTestDelayOverride", () => {
  it("never returns less than the base production delay", () => {
    expect(sanitiseTestDelayOverride(480, 100)).toBe(480);
    expect(sanitiseTestDelayOverride(480, 0)).toBe(480);
  });

  it("accepts a valid widened request", () => {
    expect(sanitiseTestDelayOverride(480, 6000)).toBe(6000);
    expect(sanitiseTestDelayOverride(460, 900)).toBe(900);
  });

  it("caps a request above the maximum", () => {
    expect(sanitiseTestDelayOverride(480, 999_999)).toBe(MAX_TEST_DELAY_MS);
  });

  it("rejects NaN by falling back to the base delay", () => {
    expect(sanitiseTestDelayOverride(480, NaN)).toBe(480);
  });

  it("rejects Infinity by falling back to the base delay", () => {
    expect(sanitiseTestDelayOverride(480, Infinity)).toBe(480);
    expect(sanitiseTestDelayOverride(480, -Infinity)).toBe(480);
  });

  it("rejects negative numbers by falling back to the base delay", () => {
    expect(sanitiseTestDelayOverride(480, -500)).toBe(480);
  });

  it("returns exactly the base delay when the request equals it", () => {
    expect(sanitiseTestDelayOverride(460, 460)).toBe(460);
  });
});
