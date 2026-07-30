import type { ReactNode } from "react";

const paths: Record<string, ReactNode> = {
  "icon.hatchet": <><path d="M13 3 7 9l3 3 6-6-3-3Z" /><path d="m10 10 9 9" /></>,
  "icon.pickaxe": <><path d="M4 8c5-4 11-4 16 0M12 6v15" /><path d="m9 18 3 3 3-3" /></>,
  "icon.fishing-rod": <><path d="M5 19C8 9 12 5 20 4M5 19l3 1" /><path d="M20 4v10c0 3-4 3-4 0" /></>,
  "icon.sword": <><path d="m5 19 11-11 3-4 1 1-4 3L5 19Z" /><path d="m8 15 3 3M4 18l2 2-2 2-2-2 2-2Z" /></>,
  "icon.log": <><path d="M5 7h13v10H5z" /><ellipse cx="18" cy="12" rx="3" ry="5" /><path d="M18 10c-2 1-2 3 0 4" /></>,
  "icon.ore": <path d="m4 10 5-6 8 2 3 8-6 6-8-2-2-8Z" />,
  "icon.fish": <><path d="M4 12c4-6 10-6 15 0-5 6-11 6-15 0Z" /><path d="m19 12 3-4v8l-3-4ZM9 9l2-3 2 3" /><circle cx="8" cy="11" r=".8" /></>,
  "icon.food": <><path d="M5 9c2-5 12-5 14 0v8H5V9Z" /><path d="M4 17h16M8 9c0-3 2-5 4-6" /></>,
  "icon.bone": <path d="M6 9c-3 0-3-5 1-5 2 0 2 2 3 3l4 4c1 1 3 1 3 3 0 4-5 4-5 1l-4-4C7 10 7 9 6 9Z" />,
  "icon.amber": <><path d="m12 2 7 6-3 11-8 2-4-10 8-9Z" /><path d="m12 6 3 4-2 6-4-4 3-6Z" /></>,
  "icon.heartwood": <><path d="M5 7h13v10H5z" /><path d="M11.5 7v10M18 12c-2 1-2 3 0 4" /><circle cx="8" cy="12" r="1.4" /></>,
  "icon.tonic": <><path d="M9 2h6M10 2v5l-4 8a3 3 0 0 0 3 5h6a3 3 0 0 0 3-5l-4-8V2" /><path d="M7.5 15h9" /></>,
};

export function ItemIcon({ iconId }: { iconId: string }) {
  return <svg className="item-icon" viewBox="0 0 24 24" aria-hidden="true">
    <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[iconId] ?? <circle cx="12" cy="12" r="7" />}
    </g>
  </svg>;
}
