import { useLayoutEffect, useRef, useState } from "react";
import { useGameStore } from "../game/store";

const MENU_MARGIN = 8;

// Compact original long-press context menu. Renders near the press point,
// then a layout pass clamps it inside the viewport so it stays usable near
// every edge (section 11 of the OSRS-feel direction).
export function ContextMenu() {
  const menu = useGameStore((state) => state.contextMenu);
  const closeContextMenu = useGameStore((state) => state.closeContextMenu);
  const ref = useRef<HTMLDivElement>(null);
  const [style, setStyle] = useState<{ left: number; top: number } | null>(null);

  useLayoutEffect(() => {
    if (!menu || !ref.current) {
      setStyle(null);
      return;
    }
    const rect = ref.current.getBoundingClientRect();
    const left = Math.min(Math.max(MENU_MARGIN, menu.x), window.innerWidth - rect.width - MENU_MARGIN);
    const top = Math.min(Math.max(MENU_MARGIN, menu.y), window.innerHeight - rect.height - MENU_MARGIN);
    setStyle({ left, top });
  }, [menu]);

  if (!menu) return null;
  return <>
    <div className="context-menu-scrim" onPointerDown={closeContextMenu} onContextMenu={(event) => event.preventDefault()} />
    <div
      ref={ref}
      className="context-menu"
      style={style ?? { left: menu.x, top: menu.y, visibility: "hidden" }}
      onContextMenu={(event) => event.preventDefault()}
    >
      <span className="context-menu-title">{menu.title}</span>
      {menu.options.map((option, index) => (
        <button
          key={index}
          className={option.isCancel ? "cancel" : ""}
          onClick={() => {
            closeContextMenu();
            option.onSelect();
          }}
        >
          {option.label}
        </button>
      ))}
    </div>
  </>;
}
