import { describe, expect, it } from "vitest";
import { PlayerCommandController } from "./playerCommand";

describe("PlayerCommandController", () => {
  it("starts idle", () => {
    const commands = new PlayerCommandController();
    expect(commands.current).toEqual({ type: "idle" });
    expect(commands.isIdle()).toBe(true);
    expect(commands.currentId).toBeNull();
  });

  it("replacing a movement command invalidates the old id", () => {
    const commands = new PlayerCommandController();
    const first = commands.begin((id) => ({ type: "moving" as const, id, destination: { x: 1, z: 1 } }));
    expect(commands.isActive(first.id)).toBe(true);

    const second = commands.begin((id) => ({ type: "moving" as const, id, destination: { x: 2, z: 2 } }));
    expect(second.id).not.toBe(first.id);
    expect(commands.isActive(first.id)).toBe(false);
    expect(commands.isActive(second.id)).toBe(true);
    expect(commands.current).toEqual({ type: "moving", id: second.id, destination: { x: 2, z: 2 } });
  });

  it("cancelling movement-to-interact returns to idle and invalidates its id", () => {
    const commands = new PlayerCommandController();
    const moving = commands.begin((id) => ({ type: "moving_to_interact" as const, id, targetId: "oak_west_1" }));
    commands.cancel();
    expect(commands.isIdle()).toBe(true);
    expect(commands.isActive(moving.id)).toBe(false);
  });

  it("a stale arrival callback cannot transition a cancelled command", () => {
    const commands = new PlayerCommandController();
    const moving = commands.begin((id) => ({ type: "moving_to_interact" as const, id, targetId: "oak_west_1" }));
    commands.cancel();
    // Simulates an arrival callback captured before cancellation firing late.
    const transitioned = commands.transition(moving.id, { type: "gathering", id: moving.id, targetId: "oak_west_1" });
    expect(transitioned).toBe(false);
    expect(commands.isIdle()).toBe(true);
  });

  it("cancelling a pickup before the pickup event prevents the stale reward timer from applying", () => {
    const commands = new PlayerCommandController();
    const pickup = commands.begin((id) => ({ type: "picking_up" as const, id, targetId: "ground_worn_hatchet" }));
    // Player taps elsewhere before the ~480ms pickup timer fires.
    const nextMove = commands.begin((id) => ({ type: "moving" as const, id, destination: { x: 5, z: 5 } }));
    // The stale setTimeout callback holds pickup.id; it must find itself inactive.
    expect(commands.isActive(pickup.id)).toBe(false);
    expect(commands.isActive(nextMove.id)).toBe(true);
  });

  it("cancelling gathering stops further reward transitions from that command", () => {
    const commands = new PlayerCommandController();
    const gathering = commands.begin((id) => ({ type: "gathering" as const, id, targetId: "oak_west_1" }));
    commands.cancel();
    expect(commands.transition(gathering.id, { type: "gathering", id: gathering.id, targetId: "oak_west_1" })).toBe(false);
  });

  it("moving_to_interact transitions into gathering under the same id on arrival", () => {
    const commands = new PlayerCommandController();
    const moving = commands.begin((id) => ({ type: "moving_to_interact" as const, id, targetId: "oak_west_1" }));
    const transitioned = commands.transition(moving.id, { type: "gathering", id: moving.id, targetId: "oak_west_1" });
    expect(transitioned).toBe(true);
    expect(commands.current).toEqual({ type: "gathering", id: moving.id, targetId: "oak_west_1" });
  });

  it("returns to idle after a terminal completion", () => {
    const commands = new PlayerCommandController();
    const pickup = commands.begin((id) => ({ type: "picking_up" as const, id, targetId: "ground_worn_hatchet" }));
    expect(commands.isActive(pickup.id)).toBe(true);
    commands.cancel();
    expect(commands.isIdle()).toBe(true);
  });

  it("talking is cancellable like any other command", () => {
    const commands = new PlayerCommandController();
    const talking = commands.begin((id) => ({ type: "talking" as const, id, targetId: "npc_mara" }));
    expect(commands.current.type).toBe("talking");
    commands.cancel();
    expect(commands.isActive(talking.id)).toBe(false);
  });
});
