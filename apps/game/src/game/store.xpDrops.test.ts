import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { appendXpDrops, useGameStore, XP_DROP_LIFETIME_MS } from "./store";

describe("XP drop expiry (each drop owns its own timer)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useGameStore.setState({ xpDrops: [] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("expires a drop on its own schedule, independent of later drops", () => {
    const firstBatch = appendXpDrops([], [{ type: "xp_gained", skill: "woodcutting", amount: 10 }]);
    useGameStore.setState({ xpDrops: firstBatch });
    expect(useGameStore.getState().xpDrops).toHaveLength(1);
    const firstId = useGameStore.getState().xpDrops[0]!.id;

    // Advance most, but not all, of the first drop's lifetime, then add a
    // second drop the way store.tick() does — via appendXpDrops on top of
    // the CURRENT store state, exactly like a live xp_gained event mid-flight.
    vi.advanceTimersByTime(XP_DROP_LIFETIME_MS - 200);
    const secondBatch = appendXpDrops(useGameStore.getState().xpDrops, [{ type: "xp_gained", skill: "mining", amount: 5 }]);
    useGameStore.setState({ xpDrops: secondBatch });
    expect(useGameStore.getState().xpDrops).toHaveLength(2);

    // The first drop's timer was scheduled when IT was created, not when
    // the second drop arrived — it must still expire ~200ms later, not be
    // reset to a fresh 1600ms lifetime.
    vi.advanceTimersByTime(200);
    const remaining = useGameStore.getState().xpDrops;
    expect(remaining.find((drop) => drop.id === firstId)).toBeUndefined();
    expect(remaining).toHaveLength(1);
  });

  it("each drop expires roughly 1.6s after its own creation", () => {
    const batch = appendXpDrops([], [{ type: "xp_gained", skill: "fishing", amount: 8 }]);
    useGameStore.setState({ xpDrops: batch });
    vi.advanceTimersByTime(XP_DROP_LIFETIME_MS - 1);
    expect(useGameStore.getState().xpDrops).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(useGameStore.getState().xpDrops).toHaveLength(0);
  });

  it("multiple drops can stack simultaneously", () => {
    const batch = appendXpDrops([], [
      { type: "xp_gained", skill: "woodcutting", amount: 10 },
      { type: "xp_gained", skill: "mining", amount: 5 },
      { type: "xp_gained", skill: "fishing", amount: 7 },
    ]);
    useGameStore.setState({ xpDrops: batch });
    expect(useGameStore.getState().xpDrops).toHaveLength(3);
  });

  it("dismissing an id that is no longer present is a harmless no-op", () => {
    useGameStore.setState({ xpDrops: [] });
    expect(() => useGameStore.getState().dismissXpDrop(999)).not.toThrow();
    expect(useGameStore.getState().xpDrops).toHaveLength(0);
  });
});
