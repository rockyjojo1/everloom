import { useRef } from "react";
import { useGameStore } from "../store/gameStore";
import { NODES, ZONES, ENEMIES } from "@everloom/gamedata";
import type { ActionDescriptor, CharacterAppearance } from "@everloom/engine";
import { estimateSurvivalSeconds } from "@everloom/engine";

// ── Colour palettes for pixel character ──────────────────────
const SKIN_TONES   = ["#FDBCB4","#F0A882","#D4845A","#B86035","#8B4215","#5C2A0A"];
const HAIR_COLORS  = ["#3C2514","#6B4226","#9B6633","#D9A441","#E8DCC4","#A63A32","#C0C0C0","#E8E8E8","#3C5A73","#5E7350"];
const TORSO_COLORS = ["#3C5A73","#A63A32","#5E7350","#4A3728","#D9A441","#7D3C98","#2C3E50","#C0392B","#1E8449","#1E2430"];
const LEGS_COLORS  = ["#4A3728","#2C3E50","#1A5276","#A63A32","#5E7350","#7D3C98","#6B4226","#E8DCC4","#1E2430","#3C5A73"];

function PixelCharacter({ appearance, action }: { appearance?: CharacterAppearance | undefined; action: string }) {
  const skin  = SKIN_TONES[appearance?.skinTone   ?? 0]!;
  const hair  = HAIR_COLORS[appearance?.hairColor  ?? 3]!;
  const torso = TORSO_COLORS[appearance?.torsoColor ?? 0]!;
  const legs  = LEGS_COLORS[appearance?.legsColor  ?? 0]!;

  const isChop = action === "woodcutting";
  const isMine = action === "mining";
  const isFish = action === "fishing";
  const isWalk = action !== "idle" && action !== "traveling";

  const ac = isChop ? "anim-chop" : isMine ? "anim-mine" : isFish ? "anim-fish" : isWalk ? "anim-walk" : "";

  return (
    <svg viewBox="0 0 16 32" className={`pixel-char ${ac}`} aria-hidden="true" style={{ width: 64, height: 128 }}>
      {/* Head */}
      <rect x="4" y="0" width="8" height="8" fill={skin} />
      {/* Hair */}
      <rect x="4" y="0" width="8" height="3" fill={hair} />
      {/* Eyes */}
      <rect x="6" y="2" width="1" height="1" fill="#1a0f00" />
      <rect x="9" y="2" width="1" height="1" fill="#1a0f00" />

      {/* Torso (wider) */}
      <rect x="3" y="8" width="10" height="8" fill={torso} />

      {/* Left arm */}
      <g className="arm-l" style={{ transformBox: "fill-box", transformOrigin: "50% 0" }}>
        <rect x="1" y="8" width="2" height="8" fill={torso} />
        <rect x="0" y="16" width="2" height="3" fill={skin} />
        {isChop && <rect x="-2" y="6" width="2" height="12" fill="#6B4226" opacity="0.9" />}
        {isMine && <rect x="-2" y="5" width="2" height="11" fill="#6B4226" opacity="0.9" />}
        {isFish && <rect x="-2" y="5" width="2" height="14" fill="#6B4226" opacity="0.9" />}
      </g>

      {/* Right arm */}
      <g className="arm-r" style={{ transformBox: "fill-box", transformOrigin: "50% 0" }}>
        <rect x="13" y="8" width="2" height="8" fill={torso} />
        <rect x="14" y="16" width="2" height="3" fill={skin} />
      </g>

      {/* Left leg */}
      <g className="leg-l" style={{ transformBox: "fill-box", transformOrigin: "50% 0" }}>
        <rect x="4" y="16" width="2" height="10" fill={legs} />
        <rect x="3" y="26" width="3" height="2" fill="#2C1810" />
      </g>

      {/* Right leg */}
      <g className="leg-r" style={{ transformBox: "fill-box", transformOrigin: "50% 0" }}>
        <rect x="10" y="16" width="2" height="10" fill={legs} />
        <rect x="10" y="26" width="3" height="2" fill="#2C1810" />
      </g>
    </svg>
  );
}

// ── Scene SVG backgrounds per zone ───────────────────────────

function SceneMeadowrest() {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id="sky-mr" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#87CEEB" />
          <stop offset="100%" stopColor="#C8E8A0" />
        </linearGradient>
        <linearGradient id="gnd-mr" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7faa6b" />
          <stop offset="100%" stopColor="#3a5c30" />
        </linearGradient>
        <linearGradient id="river-mr" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#5B8BAF" />
          <stop offset="100%" stopColor="#3C5A73" />
        </linearGradient>
        <linearGradient id="fall-mr" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="50%" stopColor="white" stopOpacity="0.7" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Sky */}
      <rect width="100" height="42" fill="url(#sky-mr)" />

      {/* Cloud puffs */}
      <ellipse cx="18" cy="12" rx="10" ry="5" fill="white" opacity="0.75" />
      <ellipse cx="26" cy="10" rx="8"  ry="4" fill="white" opacity="0.75" />
      <ellipse cx="12" cy="14" rx="7"  ry="4" fill="white" opacity="0.6" />
      <ellipse cx="62" cy="9"  rx="9"  ry="4" fill="white" opacity="0.65" />
      <ellipse cx="70" cy="7"  rx="7"  ry="3.5" fill="white" opacity="0.65" />

      {/* Distant hills */}
      <path d="M0 38 Q15 24 32 32 Q48 20 65 28 Q80 16 100 26 L100 42 L0 42 Z" fill="#6B9B5E" opacity="0.65" />
      <path d="M0 41 Q20 30 42 37 Q58 26 78 33 Q90 26 100 30 L100 42 L0 42 Z" fill="#8AAF72" opacity="0.5" />

      {/* Ground */}
      <rect x="0" y="42" width="100" height="58" fill="url(#gnd-mr)" />

      {/* Ground grass detail */}
      <ellipse cx="40" cy="44" rx="22" ry="4" fill="#8bc77a" opacity="0.3" />
      <ellipse cx="60" cy="46" rx="18" ry="3" fill="#8bc77a" opacity="0.25" />

      {/* River — runs across the lower third */}
      <path d="M0 62 Q28 58 52 60 Q72 58 100 63 L100 78 Q72 76 52 74 Q28 78 0 77 Z"
        fill="url(#river-mr)" />
      {/* Bank shading where water meets grass */}
      <path d="M0 62 Q28 58 52 60 Q72 58 100 63 L100 64.5 Q72 59.5 52 61.5 Q28 59.5 0 63.5 Z"
        fill="#2f4a5e" opacity="0.5" />
      {/* Shimmer — must stay sub-unit thin: 1 unit ≈ 15px on screen */}
      <rect x="14" y="66"  width="7"  height="0.35" fill="white" opacity="0.3" rx="0.2" />
      <rect x="40" y="69"  width="10" height="0.35" fill="white" opacity="0.28" rx="0.2" />
      <rect x="66" y="67"  width="6"  height="0.35" fill="white" opacity="0.26" rx="0.2" />
      <rect x="26" y="72"  width="8"  height="0.3"  fill="white" opacity="0.2"  rx="0.2" />
      {/* Lily pads — small, with a notch */}
      <ellipse cx="30" cy="71" rx="1.1" ry="0.55" fill="#4a8a3a" opacity="0.75" />
      <ellipse cx="58" cy="68" rx="0.9" ry="0.45" fill="#4a8a3a" opacity="0.75" />
      <ellipse cx="44" cy="74" rx="1"   ry="0.5"  fill="#3f7a32" opacity="0.7" />

      {/* RIGHT — cliff face */}
      <path d="M84 0 L100 0 L100 64 L90 60 L86 63 Z" fill="#5A6270" />
      <path d="M88 0 L100 0 L100 61 L92 57 L89 59 Z" fill="#4B5563" />
      {/* Cliff strata — thin horizontal seams */}
      <rect x="86" y="16" width="14" height="0.3" fill="#3a4049" opacity="0.6" />
      <rect x="87" y="30" width="13" height="0.3" fill="#3a4049" opacity="0.5" />
      <rect x="88" y="44" width="12" height="0.3" fill="#3a4049" opacity="0.45" />
      {/* Waterfall — narrow falling ribbons, not a slab */}
      <rect x="90.4" y="4" width="0.8" height="55" fill="url(#fall-mr)" opacity="0.85" rx="0.4" />
      <rect x="91.6" y="6" width="0.5" height="53" fill="white" opacity="0.45" rx="0.3" />
      <rect x="92.6" y="3" width="0.4" height="56" fill="white" opacity="0.3"  rx="0.2" />
      {/* Mist pool at the base */}
      <ellipse cx="91.5" cy="60" rx="4" ry="1.4" fill="white" opacity="0.22" />
      <ellipse cx="91.5" cy="60.5" rx="2.4" ry="0.8" fill="white" opacity="0.18" />
      {/* Rocks at cliff base */}
      <ellipse cx="86" cy="63" rx="3.2" ry="1.6" fill="#4B5563" />
      <ellipse cx="92" cy="64" rx="2.6" ry="1.3" fill="#374151" />

      {/* LEFT — treeline framing the edge (kept small so nodes stay dominant) */}
      <polygon points="-3,57 1.5,40 6,57"   fill="#24401f" />
      <polygon points="2,57  6.5,36 11,57"  fill="#2d4f27" />
      <polygon points="7.5,57 11,43 14.5,57" fill="#24401f" opacity="0.9" />
      {/* Trunks */}
      <rect x="1.1" y="54" width="0.8" height="4" fill="#3a2b1c" opacity="0.8" />
      <rect x="6.1" y="54" width="0.8" height="4" fill="#3a2b1c" opacity="0.8" />
      <rect x="10.6" y="54" width="0.7" height="4" fill="#3a2b1c" opacity="0.7" />
      {/* Forest floor shadow */}
      <ellipse cx="6" cy="57.5" rx="9" ry="1.4" fill="#1e3018" opacity="0.45" />

      {/* Ground texture — soft dappled patches so the clearing isn't flat */}
      <ellipse cx="36" cy="52" rx="13" ry="3"   fill="#8bc77a" opacity="0.16" />
      <ellipse cx="64" cy="56" rx="15" ry="3.4" fill="#8bc77a" opacity="0.13" />
      <ellipse cx="52" cy="47" rx="10" ry="2.2" fill="#6f9c5e" opacity="0.18" />
      <ellipse cx="80" cy="50" rx="9"  ry="2"   fill="#8bc77a" opacity="0.12" />

      {/* Grass tufts — thin blades, ~0.15 units wide */}
      {[[34,57],[41,59],[52,57],[60,58],[47,61],[66,59],[28,60]].map(([gx, gy], i) => (
        <g key={i} stroke="#4f6644" strokeWidth="0.15" fill="none" opacity="0.8">
          <path d={`M${gx} ${gy} Q${gx! - 0.4} ${gy! - 1.4} ${gx! - 0.9} ${gy! - 2.1}`} />
          <path d={`M${gx} ${gy} Q${gx! + 0.1} ${gy! - 1.6} ${gx! + 0.2} ${gy! - 2.4}`} />
          <path d={`M${gx} ${gy} Q${gx! + 0.6} ${gy! - 1.3} ${gx! + 1.1} ${gy! - 1.9}`} />
        </g>
      ))}
    </svg>
  );
}

function SceneBramblewood() {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id="sky-bw" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3d2b5a" />
          <stop offset="60%" stopColor="#7A4A6B" />
          <stop offset="100%" stopColor="#C08060" />
        </linearGradient>
        <linearGradient id="gnd-bw" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3d5a2e" />
          <stop offset="100%" stopColor="#1e2d15" />
        </linearGradient>
        <linearGradient id="river-bw" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2E4A6A" />
          <stop offset="100%" stopColor="#1A3050" />
        </linearGradient>
      </defs>

      {/* Dusk sky */}
      <rect width="100" height="44" fill="url(#sky-bw)" />

      {/* Moon */}
      <circle cx="80" cy="12" r="6" fill="#E8DCC4" opacity="0.9" />
      <circle cx="83" cy="10" r="5" fill="#7A4A6B" opacity="0.9" />

      {/* Ground */}
      <rect x="0" y="44" width="100" height="56" fill="url(#gnd-bw)" />

      {/* Wider river (downstream) */}
      <path d="M0 57 Q20 53 45 55 Q70 52 100 58 L100 74 Q70 76 45 74 Q20 76 0 74 Z"
        fill="url(#river-bw)" />
      <rect x="10" y="62" width="8"  height="1" fill="#4A7A9B" opacity="0.5" rx="1" />
      <rect x="45" y="65" width="12" height="1" fill="#4A7A9B" opacity="0.5" rx="1" />
      <rect x="75" y="63" width="7"  height="1" fill="#4A7A9B" opacity="0.5" rx="1" />

      {/* Background trees — gnarled, darker */}
      <polygon points="-5,54 6,18 17,54"  fill="#1e3018" />
      <polygon points="5,54  17,10 29,54"  fill="#2a3d1f" />
      <polygon points="16,54 26,22 36,54"  fill="#1e3018" opacity="0.9" />
      {/* Right side dense forest */}
      <polygon points="70,54 80,20 90,54"  fill="#1e3018" />
      <polygon points="80,54 88,16 96,54"  fill="#2a3d1f" />
      {/* Trunks with bramble thorns */}
      <rect x="9"  y="48" width="3" height="8" fill="#3C2514" opacity="0.7" />
      <rect x="20" y="48" width="3" height="8" fill="#3C2514" opacity="0.7" />
      {/* Bramble vines */}
      <path d="M9 44 Q14 40 18 44 Q22 48 26 44" stroke="#4a2d1a" strokeWidth="0.7" fill="none" />
      <path d="M20 38 Q25 34 30 38 Q33 42 28 46" stroke="#4a2d1a" strokeWidth="0.7" fill="none" />

      {/* Forest floor shadow */}
      <ellipse cx="20" cy="54" rx="22" ry="4" fill="#0d1a08" opacity="0.6" />
      <ellipse cx="85" cy="54" rx="15" ry="3.5" fill="#0d1a08" opacity="0.6" />

      {/* Fireflies */}
      <circle cx="40" cy="45" r="0.8" fill="#D9A441" opacity="0.8" />
      <circle cx="55" cy="48" r="0.6" fill="#D9A441" opacity="0.7" />
      <circle cx="62" cy="44" r="0.7" fill="#D9A441" opacity="0.6" />
    </svg>
  );
}

function SceneAshenDelve() {
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}>
      <defs>
        <linearGradient id="cave-gnd" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a2420" />
          <stop offset="100%" stopColor="#131820" />
        </linearGradient>
        <radialGradient id="glow-1" cx="30%" cy="60%">
          <stop offset="0%" stopColor="#A63A32" stopOpacity="0.3" />
          <stop offset="100%" stopColor="#A63A32" stopOpacity="0" />
        </radialGradient>
        <radialGradient id="glow-2" cx="65%" cy="65%">
          <stop offset="0%" stopColor="#5E7350" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#5E7350" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="pool" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1a2a3a" />
          <stop offset="100%" stopColor="#0d1520" />
        </linearGradient>
      </defs>

      {/* Cave ceiling */}
      <rect width="100" height="100" fill="url(#cave-gnd)" />
      <rect width="100" height="30" fill="#1a1714" />

      {/* Stalactites */}
      {[10,18,28,38,48,57,67,77,88,95].map((x, i) => (
        <polygon key={i}
          points={`${x-3},0 ${x+3},0 ${x},${10+(i%3)*6}`}
          fill="#2C2825" />
      ))}

      {/* Cave walls */}
      <path d="M0 0 L0 100 L18 100 L12 75 L8 55 L5 30 Z" fill="#1a1714" />
      <path d="M100 0 L100 100 L82 100 L87 75 L92 50 L95 25 Z" fill="#1a1714" />

      {/* Underground pool */}
      <ellipse cx="50" cy="75" rx="38" ry="12" fill="url(#pool)" />
      <ellipse cx="50" cy="75" rx="35" ry="10" fill="#1E2D3D" opacity="0.7" />
      <rect x="25" y="73" width="10" height="1" fill="#3A5A7A" opacity="0.5" rx="1" />
      <rect x="55" y="76" width="8"  height="1" fill="#3A5A7A" opacity="0.4" rx="1" />

      {/* Lava glow (right side forge area) */}
      <ellipse cx="30" cy="60" rx="18" ry="12" fill="url(#glow-1)" />
      <ellipse cx="65" cy="65" rx="15" ry="10" fill="url(#glow-2)" />

      {/* Glowing mushrooms */}
      <ellipse cx="22" cy="58" rx="4" ry="2" fill="#5E7350" opacity="0.8" />
      <rect x="21" y="52" width="2" height="7" fill="#5E7350" opacity="0.6" />
      <ellipse cx="68" cy="60" rx="3.5" ry="1.8" fill="#5E7350" opacity="0.75" />
      <rect x="67" y="55" width="2" height="6" fill="#5E7350" opacity="0.55" />

      {/* Rock formations */}
      <polygon points="0,90 15,62 28,90"  fill="#2C2825" />
      <polygon points="12,90 25,68 38,90" fill="#1e1c1a" />
      <polygon points="70,90 83,66 96,90" fill="#2C2825" />

      {/* Coal veins in wall */}
      <path d="M5 40 Q8 35 10 40 Q12 45 9 48" stroke="#1a1714" strokeWidth="2" fill="none" opacity="0.8" />
      <path d="M92 55 Q88 50 86 55 Q84 60 88 62" stroke="#1a1714" strokeWidth="2" fill="none" opacity="0.8" />
    </svg>
  );
}

function ZoneScene({ zoneId }: { zoneId: string }) {
  if (zoneId === "bramblewood") return <SceneBramblewood />;
  if (zoneId === "ashen_delve") return <SceneAshenDelve />;
  return <SceneMeadowrest />;
}

// ── Node positions ────────────────────────────────────────────

const NODE_POS: Record<string, Array<{ nodeId: string; x: number; y: number }>> = {
  meadowrest: [
    { nodeId: "meadowrest_pine",         x: 16, y: 40 },
    { nodeId: "meadowrest_willow",       x: 29, y: 52 },
    { nodeId: "meadowrest_campfire",     x: 44, y: 44 },
    { nodeId: "meadowrest_copper_vein",  x: 60, y: 50 },
    { nodeId: "meadowrest_tin_vein",     x: 72, y: 38 },
    { nodeId: "meadowrest_trout_stream", x: 50, y: 68 },
    { nodeId: "meadowrest_minnow_pool",  x: 74, y: 70 },
  ],
  bramblewood: [
    { nodeId: "bramblewood_oak",         x: 22, y: 42 },
    { nodeId: "bramblewood_iron_vein",   x: 60, y: 46 },
    { nodeId: "bramblewood_perch_pool",  x: 50, y: 66 },
  ],
  ashen_delve: [
    { nodeId: "ashen_delve_coal_vein",      x: 28, y: 52 },
    { nodeId: "ashen_delve_iron_vein",      x: 58, y: 42 },
    { nodeId: "ashen_delve_charwood",       x: 18, y: 62 },
    { nodeId: "ashen_delve_cave_eel_pool",  x: 65, y: 74 },
  ],
};

// ── Node SVG art ─────────────────────────────────────────────

function NodeArt({ nodeId, isActive }: { nodeId: string; isActive: boolean }) {
  const glow = isActive ? "drop-shadow(0 0 8px #D9A441) drop-shadow(0 0 3px #D9A441)" : "drop-shadow(0 3px 4px rgba(0,0,0,0.6))";

  if (nodeId.includes("pine")) {
    return (
      <svg viewBox="0 0 40 64" style={{ width: 70, height: 112, filter: glow }}>
        {/* Trunk */}
        <rect x="16" y="46" width="8" height="18" fill="#5C3A1F" />
        {/* Foliage — 3 triangles */}
        <polygon points="20,4 2,28 38,28" fill="#2a5a2a" />
        <polygon points="20,18 4,40 36,40" fill="#3d7a3d" />
        <polygon points="20,32 6,52 34,52" fill="#4a8a4a" />
        {/* Highlight on foliage */}
        <polygon points="18,10 12,22 24,22" fill="#5aaa5a" opacity="0.4" />
      </svg>
    );
  }
  if (nodeId.includes("oak")) {
    return (
      <svg viewBox="0 0 48 72" style={{ width: 84, height: 126, filter: glow }}>
        {/* Trunk — wider */}
        <rect x="20" y="48" width="8" height="24" fill="#4A2F1F" />
        {/* Foliage — rounder, denser */}
        <ellipse cx="24" cy="16" rx="20" ry="14" fill="#2d4a2a" />
        <ellipse cx="24" cy="18" rx="16" ry="12" fill="#3d6a3d" />
        <ellipse cx="10" cy="32" rx="10" ry="8" fill="#2d4a2a" />
        <ellipse cx="38" cy="32" rx="10" ry="8" fill="#2d4a2a" />
        <ellipse cx="24" cy="40" rx="18" ry="10" fill="#4a8a4a" />
      </svg>
    );
  }
  if (nodeId.includes("charwood")) {
    return (
      <svg viewBox="0 0 40 72" style={{ width: 70, height: 126, filter: glow }}>
        {/* Dark trunk */}
        <rect x="16" y="48" width="8" height="24" fill="#2C1810" />
        {/* Dark foliage */}
        <polygon points="20,4 4,32 36,32" fill="#1E2430" />
        <polygon points="20,22 2,48 38,48" fill="#2a3a42" />
        <polygon points="20,38 6,60 34,60" fill="#1E2430" />
        {/* Ember glow */}
        <circle cx="20" cy="50" r="3" fill="#A63A32" opacity="0.6" />
      </svg>
    );
  }
  if (nodeId.includes("willow")) {
    return (
      <svg viewBox="0 0 44 80" style={{ width: 77, height: 140, filter: glow }}>
        {/* Trunk */}
        <rect x="20" y="52" width="4" height="28" fill="#5C3A1F" />
        {/* Drooping foliage */}
        <circle cx="22" cy="24" r="14" fill="#3d7a3d" />
        <circle cx="22" cy="20" r="10" fill="#4a8a4a" />
        {/* Hanging branches */}
        <path d="M12 32 Q6 50 4 70" stroke="#3d5e3a" strokeWidth="1.5" fill="none" />
        <path d="M22 36 Q20 56 18 78" stroke="#3d5e3a" strokeWidth="1.5" fill="none" />
        <path d="M32 32 Q38 50 40 70" stroke="#3d5e3a" strokeWidth="1.5" fill="none" />
      </svg>
    );
  }
  if (nodeId.includes("copper_vein")) {
    return (
      <svg viewBox="0 0 44 48" style={{ width: 77, height: 84, filter: glow }}>
        {/* Rock formation */}
        <polygon points="8,44 22,2 36,44" fill="#6B7280" />
        <polygon points="4,44 14,14 28,44" fill="#5a6270" />
        <polygon points="16,44 32,8 44,44" fill="#4B5563" />
        {/* Ore veins */}
        <rect x="16" y="18" width="12" height="10" fill="#B87333" opacity="0.85" />
        <rect x="18" y="20" width="8" height="6" fill="#D4991A" opacity="0.7" />
        <circle cx="20" cy="24" r="2" fill="white" opacity="0.3" />
      </svg>
    );
  }
  if (nodeId.includes("tin_vein")) {
    return (
      <svg viewBox="0 0 44 48" style={{ width: 77, height: 84, filter: glow }}>
        {/* Rock formation */}
        <polygon points="8,44 22,2 36,44" fill="#6B7280" />
        <polygon points="4,44 14,14 28,44" fill="#5a6270" />
        <polygon points="16,44 32,8 44,44" fill="#4B5563" />
        {/* Tin ore — gray-white */}
        <rect x="16" y="18" width="12" height="10" fill="#8B8B9B" opacity="0.85" />
        <rect x="18" y="20" width="8" height="6" fill="#BFBFC7" opacity="0.7" />
      </svg>
    );
  }
  if (nodeId.includes("iron_vein")) {
    return (
      <svg viewBox="0 0 44 48" style={{ width: 77, height: 84, filter: glow }}>
        {/* Rock formation */}
        <polygon points="8,44 22,2 36,44" fill="#6B7280" />
        <polygon points="4,44 14,14 28,44" fill="#5a6270" />
        <polygon points="16,44 32,8 44,44" fill="#4B5563" />
        {/* Iron ore — dark blue */}
        <rect x="16" y="18" width="12" height="10" fill="#3B4A5A" opacity="0.9" />
        <rect x="18" y="20" width="8" height="6" fill="#5a6a8a" opacity="0.75" />
      </svg>
    );
  }
  if (nodeId.includes("coal")) {
    return (
      <svg viewBox="0 0 44 48" style={{ width: 77, height: 84, filter: glow }}>
        {/* Rock formation */}
        <polygon points="8,44 22,2 36,44" fill="#6B7280" />
        <polygon points="4,44 14,14 28,44" fill="#5a6270" />
        <polygon points="16,44 32,8 44,44" fill="#4B5563" />
        {/* Coal — black */}
        <rect x="14" y="16" width="16" height="14" fill="#0A0A0A" opacity="0.95" />
        <rect x="16" y="18" width="12" height="10" fill="#1a1a1a" opacity="0.8" />
      </svg>
    );
  }
  if (nodeId.includes("campfire")) {
    const flame = isActive ? "#FFD700" : "#FF6B35";
    return (
      <svg viewBox="0 0 32 48" style={{ width: 56, height: 84, filter: glow }}>
        {/* Logs */}
        <rect x="4" y="32" width="10" height="5" rx="2" fill="#5C3A1F" />
        <rect x="18" y="32" width="10" height="5" rx="2" fill="#4A2F1F" />
        <rect x="10" y="30" width="12" height="5" rx="2" fill="#6B4A2F" />
        {/* Embers */}
        <ellipse cx="16" cy="32" rx="8" ry="3" fill="#8B3A0A" opacity="0.9" />
        {/* Main flames */}
        <path d="M16 28 Q10 18 12 8 Q14 2 16 0 Q18 4 20 8 Q22 16 18 26 Q16 24 16 28 Z" fill={flame} opacity="0.95" />
        <path d="M12 28 Q6 20 8 12 Q10 18 14 14 Q12 22 12 28 Z" fill={flame} opacity="0.8" />
        <path d="M20 28 Q26 20 24 14 Q22 18 18 16 Q20 22 20 28 Z" fill={flame} opacity="0.8" />
      </svg>
    );
  }
  if (nodeId.includes("pool") || nodeId.includes("stream")) {
    return (
      <svg viewBox="0 0 48 32" style={{ width: 84, height: 56, filter: glow }}>
        {/* Water body */}
        <ellipse cx="24" cy="16" rx="22" ry="10" fill="#3C5A73" />
        <ellipse cx="24" cy="15" rx="18" ry="7" fill="#5B8BAF" opacity="0.8" />
        {/* Ripples */}
        <ellipse cx="12" cy="14" rx="6" ry="3" fill="white" opacity="0.25" />
        <ellipse cx="32" cy="18" rx="5" ry="2" fill="white" opacity="0.2" />
        {/* Fish */}
        <path d="M18 16 Q24 12 30 16 L28 16 Q24 19 20 16 Z" fill="#D9A441" opacity="0.75" />
        <path d="M22 14 Q26 12 30 14" stroke="#D9A441" strokeWidth="1" fill="none" opacity="0.6" />
      </svg>
    );
  }
  if (nodeId.includes("eel")) {
    return (
      <svg viewBox="0 0 48 40" style={{ width: 84, height: 70, filter: glow }}>
        {/* Deep pool */}
        <ellipse cx="24" cy="20" rx="24" ry="12" fill="#1a3a4a" />
        <ellipse cx="24" cy="19" rx="20" ry="9" fill="#2a4a5a" opacity="0.8" />
        {/* Grotto edges */}
        <path d="M4 32 Q4 24 6 20 Q8 22 10 28 Z" fill="#4B5563" opacity="0.6" />
        <path d="M44 32 Q44 24 42 20 Q40 22 38 28 Z" fill="#4B5563" opacity="0.6" />
        {/* Eel silhouette */}
        <path d="M16 20 Q20 18 28 20 Q32 22 36 24" stroke="#5E7350" strokeWidth="2" fill="none" opacity="0.8" />
        <circle cx="36" cy="24" r="1.5" fill="#5E7350" opacity="0.7" />
      </svg>
    );
  }

  return <span style={{ fontSize: 48 }}>❓</span>;
}

// ── Enemy emoji ───────────────────────────────────────────────
const ENEMY_EMOJI: Record<string, string> = {
  thornwretch:   "🌵",
  shade_crawler: "🕷️",
};

// ── Main Diorama ──────────────────────────────────────────────

export function Diorama() {
  const ps          = useGameStore((s) => s.playerState);
  const startAction = useGameStore((s) => s.startAction);
  const activeGlimmer = useGameStore((s) => s.activeGlimmer);
  const tapGlimmer  = useGameStore((s) => s.tapGlimmer);
  const containerRef = useRef<HTMLDivElement>(null);

  if (!ps) return null;

  const zone    = ZONES.find((z) => z.id === ps.zoneId);
  const positions = NODE_POS[ps.zoneId] ?? [];
  const enemy   = ENEMIES.find((e) => e.zoneId === ps.zoneId);

  const currentNodeId = ps.currentAction.nodeId;
  const actionType    = ps.currentAction.type;
  const isSkilling    = actionType !== "idle" && actionType !== "traveling";

  // Character walks to the active node, standing just beside/below it so the
  // node art stays visible. Idle spot is deliberately clear of every node.
  const activePos = positions.find((p) => p.nodeId === currentNodeId);
  const charX = activePos ? Math.max(8, activePos.x - 7) : 36;
  const charY = activePos ? activePos.y + 9 : 62;

  const threat = zone?.danger ? {
    zoneId: ps.zoneId as import("@everloom/engine").ZoneId,
    danger: zone.danger,
    ambientEnemyId: enemy?.id ?? "",
    damagePerHit: enemy?.damagePerHit ?? 0,
    hitIntervalSeconds: enemy?.hitIntervalSeconds ?? 10,
  } : null;
  const totalFood = ps.larder.reduce((a, e) => a + e.qty * 5, 0);
  const survivalSec = estimateSurvivalSeconds({ stats: ps.combat, threat: threat ?? null, foodHeal: totalFood });

  function handleNodeTap(nodeId: string) {
    if (!ps) return;
    const nodeData = NODES.find((n) => n.id === nodeId);
    if (!nodeData) return;
    const action: ActionDescriptor = {
      type: nodeData.skill as ActionDescriptor["type"],
      nodeId,
      zoneId: ps.zoneId,
      recipeId: null,
      targetZoneId: null,
    };
    startAction(action);
  }

  return (
    <div
      ref={containerRef}
      style={{
        flex: 1,
        position: "relative",
        overflow: "hidden",
        minHeight: 0,
        // Keep the scene (and its node hitboxes) clear of the inventory rail.
        marginRight: "var(--inv-rail)",
      }}
    >
      {/* ── Zone scene background ── */}
      <ZoneScene zoneId={ps.zoneId} />

      {/* ── Zone name ── */}
      <div style={{
        position: "absolute", top: 8, left: 8,
        fontFamily: "var(--font-display)", fontSize: 20,
        color: "var(--linen)", textShadow: "1px 2px 0 rgba(0,0,0,0.6)",
        pointerEvents: "none", zIndex: 10,
      }}>
        {zone?.name ?? ps.zoneId}
      </div>

      {/* ── Danger badge ── */}
      {zone && zone.danger > 0 && (
        <div className={`survival-badge ${
          survivalSec === null ? "safe" :
          survivalSec > 14400 ? "safe" :
          survivalSec > 3600  ? "warn" : "danger"
        }`} style={{ zIndex: 10 }}>
          {survivalSec === null ? "∞ safe" :
           survivalSec > 86400 ? `${Math.floor(survivalSec / 86400)}d safe` :
           survivalSec > 3600  ? `~${Math.floor(survivalSec / 3600)}h safe` :
           `~${Math.floor(survivalSec / 60)}m safe`}
        </div>
      )}

      {/* ── HP bar (danger zones) ── */}
      {zone && zone.danger > 0 && (
        <div style={{
          position: "absolute", top: 32, left: 8, right: 80,
          display: "flex", alignItems: "center", gap: 5, zIndex: 10,
        }}>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--madder)" }}>❤️</span>
          <div className="progress-wrap" style={{ flex: 1 }}>
            <div className="progress-fill red" style={{ width: `${(ps.combat.hp / ps.combat.maxHp) * 100}%` }} />
          </div>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--madder)" }}>
            {ps.combat.hp}/{ps.combat.maxHp}
          </span>
        </div>
      )}

      {/* ── Resource nodes ── */}
      {positions.map(({ nodeId, x, y }) => {
        const isActive = nodeId === currentNodeId;
        const node = NODES.find((n) => n.id === nodeId);
        return (
          <button
            key={nodeId}
            className={`node-btn ${isActive ? "active" : ""}`}
            style={{ left: `${x}%`, top: `${y}%`, zIndex: 20 }}
            onClick={() => handleNodeTap(nodeId)}
          >
            <NodeArt nodeId={nodeId} isActive={isActive} />
            <span className="node-label">{node?.name ?? nodeId}</span>
            {isActive && (
              <span style={{
                fontFamily: "var(--font-ui)", fontSize: 8,
                color: "var(--weld)", background: "rgba(30,36,48,0.8)",
                padding: "1px 5px", borderRadius: 2, marginTop: 1,
              }}>▶ Active</span>
            )}
          </button>
        );
      })}

      {/* ── Player character ── */}
      <div style={{
        position: "absolute",
        left: `${charX}%`,
        top: `${charY}%`,
        transform: "translate(-50%,-100%)",
        zIndex: 25,
        transition: "left 0.8s ease, top 0.8s ease",
        pointerEvents: "none",
      }}>
        <PixelCharacter appearance={ps.appearance} action={isSkilling ? actionType : "idle"} />
        <div style={{
          fontFamily: "var(--font-ui)", fontSize: 8,
          color: "var(--linen)", textAlign: "center",
          background: "rgba(30,36,48,0.65)", padding: "1px 4px", borderRadius: 2, marginTop: 1,
          whiteSpace: "nowrap",
        }}>
          {ps.displayName}
        </div>
      </div>

      {/* ── Wandering enemy ── */}
      {enemy && isSkilling && (
        <div style={{
          position: "absolute", bottom: "20%", right: "10%",
          fontSize: 28, zIndex: 22,
          animation: "enemyWander 4s ease-in-out infinite",
          filter: "drop-shadow(1px 2px 0 rgba(0,0,0,0.5))",
          pointerEvents: "none",
        }}>
          {ENEMY_EMOJI[enemy.id] ?? "👾"}
          <div style={{ fontFamily: "var(--font-ui)", fontSize: 7, color: "var(--madder)", textAlign: "center" }}>
            {enemy.name}
          </div>
        </div>
      )}

      {/* ── Glimmer ── */}
      {activeGlimmer && (
        <button
          className="glimmer-dot"
          style={{
            left: `${50 + Math.sin(Date.now() / 1000) * 18}%`,
            top:  `${38 + Math.cos(Date.now() / 1000) * 12}%`,
            zIndex: 30,
          }}
          onClick={tapGlimmer}
        />
      )}

      {/* ── Motes + days ── */}
      <div style={{
        position: "absolute", bottom: 6, left: 8, zIndex: 10,
        fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--weld)",
        background: "rgba(30,36,48,0.65)", padding: "2px 7px", borderRadius: 3,
        pointerEvents: "none",
      }}>
        ✨ {ps.motes}
      </div>

      {/* ── CSS animations ── */}
      <style>{`
        /* ── Pixel character animations ── */
        .pixel-char { image-rendering: pixelated; image-rendering: crisp-edges; }

        /* Walking */
        .pixel-char.anim-walk .leg-l { animation: legSwing 0.48s ease-in-out infinite; }
        .pixel-char.anim-walk .leg-r { animation: legSwing 0.48s ease-in-out infinite 0.24s; }
        .pixel-char.anim-walk .arm-l { animation: armSwing 0.48s ease-in-out infinite 0.24s; }
        .pixel-char.anim-walk .arm-r { animation: armSwing 0.48s ease-in-out infinite; }

        /* Woodcutting — left arm chops */
        .pixel-char.anim-chop .arm-l { animation: armChop 0.75s cubic-bezier(0.34, 1.56, 0.64, 1) infinite; }
        .pixel-char.anim-chop .arm-r { transform: rotate(20deg); }

        /* Mining — left arm picks */
        .pixel-char.anim-mine .arm-l { animation: armMine 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) infinite; }

        /* Fishing — arm casts */
        .pixel-char.anim-fish .arm-l { animation: armFish 2.2s ease-in-out infinite; }
        .pixel-char.anim-fish .arm-r { transform: rotate(10deg); }

        /* Cooking */
        .pixel-char.anim-cooking .arm-l { animation: armChop 0.6s ease-in-out infinite; }
        .pixel-char.anim-cooking .arm-r { transform: rotate(15deg); }

        @keyframes legSwing {
          0%,100% { transform: rotate(0deg); }
          25%     { transform: rotate(-28deg); }
          75%     { transform: rotate(28deg); }
        }
        @keyframes armSwing {
          0%,100% { transform: rotate(0deg); }
          25%     { transform: rotate(22deg); }
          75%     { transform: rotate(-22deg); }
        }
        @keyframes armChop {
          0%,100% { transform: rotate(0deg); }
          20%     { transform: rotate(-135deg); }
          50%     { transform: rotate(-135deg); }
          75%     { transform: rotate(0deg); }
        }
        @keyframes armMine {
          0%,100% { transform: rotate(0deg); }
          18%     { transform: rotate(-110deg); }
          42%     { transform: rotate(-110deg); }
          68%     { transform: rotate(0deg); }
        }
        @keyframes armFish {
          0%,62%,100% { transform: rotate(-30deg); }
          28%         { transform: rotate(35deg); }
        }

        /* Enemy */
        @keyframes enemyWander {
          0%,100% { transform: translateX(0); }
          33%     { transform: translateX(-18px); }
          66%     { transform: translateX(14px); }
        }
      `}</style>
    </div>
  );
}
