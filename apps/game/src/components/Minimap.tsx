import { CONTENT } from "@everloom/content";
import type { ZoneInteractable } from "@everloom/core";
import { useGameStore } from "../game/store";

const zone = CONTENT.zones.meadowrest!;

function markerColour(target: ZoneInteractable): string {
  if (target.kind === "npc") return "#f2cf6b";
  if (target.kind === "enemy") return "#cf5f50";
  if (target.kind === "resource") return target.resourceId?.includes("riverling") ? "#78d7dc" : target.resourceId?.includes("copper") ? "#c88859" : "#73b96e";
  if (target.kind === "landmark") return "#cf9cff";
  if (target.kind === "facility") return "#ff9c53";
  return "#eee1bb";
}

export function Minimap() {
  const save = useGameStore((state) => state.save);
  if (!save) return null;
  return <section className="minimap glass" aria-label="Meadowrest minimap">
    <svg viewBox={`0 0 ${zone.width} ${zone.depth}`} role="img">
      <defs><clipPath id="map-circle"><circle cx={zone.width / 2} cy={zone.depth / 2} r={14.7} /></clipPath></defs>
      <g clipPath="url(#map-circle)">
        <rect width={zone.width} height={zone.depth} fill="#6d9d57" />
        {zone.terrain.filter((region) => region.shape === "rect").map((region, index) => <rect key={index} x={region.x} y={region.z}
          width={region.width} height={region.depth} fill={region.surface === "water" ? "#397c8c" : region.surface === "soil" ? "#8c6747" : region.surface === "stone" ? "#77766e" : "#75a65c"} />)}
        {zone.terrain.filter((region) => region.shape === "path" && region.endX !== null && region.endZ !== null).map((region, index) =>
          <line key={index} x1={region.x} y1={region.z} x2={region.endX!} y2={region.endZ!} stroke="#c6a36b" strokeWidth={region.width} strokeLinecap="round" />)}
        <circle cx="19" cy="15" r="3.5" fill="#c6a36b" />
        {zone.scenery.filter((item) => item.assetId.startsWith("town.") || item.assetId.includes("watermill")).map((item) =>
          <rect key={item.id} x={item.x - .65} y={item.z - .45} width="1.3" height=".9" rx=".15" fill="#5a3e2c" />)}
        {zone.interactables.map((target) => <circle key={target.id} cx={target.x} cy={target.z} r={target.kind === "landmark" ? .55 : .33}
          fill={markerColour(target)} stroke="#17211d" strokeWidth=".16" />)}
        <g transform={`translate(${save.position.x} ${save.position.z}) rotate(${Math.atan2(save.position.facingZ, save.position.facingX) * 180 / Math.PI + 90})`}>
          <path d="M0,-1 L.65,.65 L0,.4 L-.65,.65 Z" fill="#fff3c5" stroke="#18231f" strokeWidth=".2" />
        </g>
      </g>
      <circle cx={zone.width / 2} cy={zone.depth / 2} r="14.7" fill="none" stroke="#d0ad68" strokeWidth=".65" />
    </svg>
    <span>MEADOWREST</span>
  </section>;
}
