import { useEffect } from "react";
import { useGameStore } from "../game/store";

const XP_DROP_LIFETIME_MS = 1600;

// Screen-anchored XP drop stack, matching the classic convention of XP
// feedback living in a fixed screen corner rather than floating in world
// space. Every entry is tied to a real xp_gained event from the store — see
// appendXpDrops in game/store.ts — so nothing here is fabricated.
export function XpDrops() {
  const xpDrops = useGameStore((state) => state.xpDrops);
  const dismissXpDrop = useGameStore((state) => state.dismissXpDrop);

  useEffect(() => {
    const timers = xpDrops.map((drop) =>
      setTimeout(() => dismissXpDrop(drop.id), XP_DROP_LIFETIME_MS));
    return () => timers.forEach(clearTimeout);
  }, [xpDrops, dismissXpDrop]);

  if (!xpDrops.length) return null;
  return <div className="xp-drops" aria-live="polite">
    {xpDrops.map((drop) => <span key={drop.id} className="xp-drop">+{drop.amount} <b>{drop.skill}</b></span>)}
  </div>;
}
