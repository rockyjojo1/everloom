import { describe, expect, it, vi } from "vitest";

vi.mock("@capacitor/core", () => ({
  Capacitor: {
    isNativePlatform: vi.fn(),
  },
}));

describe("isNativePlatform", () => {
  it("returns true when Capacitor.isNativePlatform() returns true", async () => {
    const { Capacitor } = await import("@capacitor/core");
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);

    const { isNativePlatform } = await import("./platform");
    expect(isNativePlatform()).toBe(true);
  });

  it("returns false when Capacitor.isNativePlatform() returns false", async () => {
    const { Capacitor } = await import("@capacitor/core");
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);

    const { isNativePlatform } = await import("./platform");
    expect(isNativePlatform()).toBe(false);
  });
});
