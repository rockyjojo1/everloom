import { useGameStore } from "../game/store";

// Screen-anchored XP drop stack, matching the classic convention of XP
// feedback living in a fixed screen corner rather than floating in world
// space. Every entry is tied to a real xp_gained event from the store — see
// appendXpDrops in game/store.ts — so nothing here is fabricated.
//
// Expiry is owned entirely by the store (each drop schedules its own
// dismissal once, at creation) rather than by an effect here, so one drop's
// lifetime can never be reset by another drop arriving later. This
// component is a pure, stateless read of store.xpDrops.
export function XpDrops() {
  const xpDrops = useGameStore((state) => state.xpDrops);

  if (!xpDrops.length) return null;
  return <div className="xp-drops" aria-live="polite">
    {xpDrops.map((drop) => <span key={drop.id} className="xp-drop">+{drop.amount} <b>{drop.skill}</b></span>)}
  </div>;
}
