import type { GridPosition } from "@everloom/core";

// Explicit player-command lifecycle. GameWorld.tsx used to track route,
// afterArrival, and pendingPickupTimeout as independent closures with no
// shared identity, which made it easy for a stale arrival callback or a
// stale reward timer to fire after the player had already moved on to a
// new command. Every command below carries a unique, monotonically
// increasing id; a caller holding an id must check isActive(id) (or use
// transition(), which checks for it) before acting, so cancelled work is
// provably inert rather than merely "usually harmless".
export type PlayerCommand =
  | { readonly type: "idle" }
  | { readonly type: "moving"; readonly id: number; readonly destination: GridPosition }
  | { readonly type: "moving_to_interact"; readonly id: number; readonly targetId: string }
  | { readonly type: "gathering"; readonly id: number; readonly targetId: string }
  | { readonly type: "picking_up"; readonly id: number; readonly targetId: string }
  | { readonly type: "talking"; readonly id: number; readonly targetId: string };

type ActiveCommand = Exclude<PlayerCommand, { type: "idle" }>;

export class PlayerCommandController {
  private sequence = 0;
  private command: PlayerCommand = { type: "idle" };

  get current(): PlayerCommand {
    return this.command;
  }

  get currentId(): number | null {
    return this.command.type === "idle" ? null : this.command.id;
  }

  isActive(id: number): boolean {
    return this.currentId === id;
  }

  isIdle(): boolean {
    return this.command.type === "idle";
  }

  // Starts a brand-new command, invalidating whatever was active before it
  // (any id a caller is still holding onto from the previous command will
  // now fail isActive()/transition()). Returns the fresh command so the
  // caller can read its id.
  begin<T extends ActiveCommand>(build: (id: number) => T): T {
    this.sequence += 1;
    const next = build(this.sequence);
    this.command = next;
    return next;
  }

  // Moves the command forward within the SAME logical action (e.g.
  // moving_to_interact -> gathering on arrival) without minting a new id.
  // Returns false — and leaves state untouched — if id no longer matches
  // the active command, which is the normal, expected outcome when the
  // player cancelled or replaced the command while this phase was pending.
  transition<T extends ActiveCommand>(id: number, next: T): boolean {
    if (!this.isActive(id)) return false;
    this.command = next;
    return true;
  }

  // Returns to idle. Safe to call unconditionally; it is what every
  // terminal completion and every new command's cancellation step does.
  cancel(): void {
    this.command = { type: "idle" };
  }
}
