import { useEffect, useRef } from "react";
import { useGameStore } from "../game/store";

export function ContextMenu() {
  const contextMenu = useGameStore((state) => state.contextMenu);
  const setContextMenu = useGameStore((state) => state.setContextMenu);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!contextMenu) return;

    // Dismiss on clicking anywhere else
    const handleDismiss = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setContextMenu(null);
      }
    };

    window.addEventListener("mousedown", handleDismiss, true);
    window.addEventListener("touchstart", handleDismiss as any, true);

    return () => {
      window.removeEventListener("mousedown", handleDismiss, true);
      window.removeEventListener("touchstart", handleDismiss as any, true);
    };
  }, [contextMenu, setContextMenu]);

  if (!contextMenu) return null;

  // Ensure menu doesn't overflow screen boundaries
  const menuWidth = 160;
  const menuHeight = contextMenu.options.length * 28 + 24;
  const x = Math.min(contextMenu.x, window.innerWidth - menuWidth);
  const y = Math.min(contextMenu.y, window.innerHeight - menuHeight);

  return (
    <div
      ref={menuRef}
      className="osrs-context-menu"
      style={{
        position: "absolute",
        left: `${Math.max(0, x)}px`,
        top: `${Math.max(0, y)}px`,
        zIndex: 999999,
      }}
    >
      <header className="context-menu-title">Choose Option</header>
      <ul className="context-menu-options">
        {contextMenu.options.map((option, index) => (
          <li
            key={index}
            className="context-menu-option"
            onPointerDown={(e) => {
              e.stopPropagation();
              option.action();
              setContextMenu(null);
            }}
          >
            {option.label}
          </li>
        ))}
      </ul>
    </div>
  );
}
