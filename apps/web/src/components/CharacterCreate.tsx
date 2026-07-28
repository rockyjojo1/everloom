import { useState } from "react";
import { useGameStore } from "../store/gameStore";
import type { DeathMode, CharacterAppearance } from "@everloom/engine";

// ── Appearance palettes ───────────────────────────────────────
const SKIN_TONES   = ["#FDBCB4","#F0A882","#D4845A","#B86035","#8B4215","#5C2A0A"];
const HAIR_COLORS  = ["#3C2514","#6B4226","#9B6633","#D9A441","#E8DCC4","#A63A32","#C0C0C0","#E8E8E8","#3C5A73","#5E7350"];
const TORSO_COLORS = ["#3C5A73","#A63A32","#5E7350","#4A3728","#D9A441","#7D3C98","#2C3E50","#C0392B","#1E8449","#1E2430"];
const LEGS_COLORS  = ["#4A3728","#2C3E50","#1A5276","#A63A32","#5E7350","#7D3C98","#6B4226","#E8DCC4","#1E2430","#3C5A73"];
const HAIR_LABELS  = ["Short","Swept","Long","Spiky","Bun","Bald","Curly","Wild"];

const MODES: Array<{ id: DeathMode; label: string; desc: string }> = [
  { id: "cozy",      label: "Cozy",      desc: "Lose only unbanked yield on death." },
  { id: "standard",  label: "Standard",  desc: "Lose yield + one random item." },
  { id: "ironbound", label: "Ironbound", desc: "Permanent death. Unlocks at P4." },
];

function Swatch({ color, selected, onClick }: { color: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: 24, height: 24,
        background: color,
        border: selected ? "2px solid var(--weld)" : "2px solid transparent",
        borderRadius: 3,
        boxShadow: selected ? "0 0 0 1px var(--walnut)" : "none",
        cursor: "pointer",
        flexShrink: 0,
      }}
    />
  );
}

function AppearancePreview({ app }: { app: CharacterAppearance }) {
  const skin  = SKIN_TONES[app.skinTone]!;
  const hair  = HAIR_COLORS[app.hairColor]!;
  const torso = TORSO_COLORS[app.torsoColor]!;
  const legs  = LEGS_COLORS[app.legsColor]!;

  return (
    <svg viewBox="0 0 12 24" style={{ width: 64, height: 128, imageRendering: "pixelated" }}>
      <rect x="3" y="0" width="6" height="3" fill={hair} />
      <rect x="2" y="3" width="8" height="6" fill={skin} />
      <rect x="4" y="5" width="1" height="1" fill="#1a0f00" />
      <rect x="7" y="5" width="1" height="1" fill="#1a0f00" />
      <rect x="5" y="7" width="2" height="1" fill={hair} opacity="0.5" />
      <rect x="3" y="9" width="6" height="6" fill={torso} />
      <rect x="1" y="9" width="2" height="5" fill={torso} />
      <rect x="9" y="9" width="2" height="5" fill={torso} />
      <rect x="1" y="14" width="2" height="2" fill={skin} />
      <rect x="9" y="14" width="2" height="2" fill={skin} />
      <rect x="3" y="15" width="2" height="5" fill={legs} />
      <rect x="7" y="15" width="2" height="5" fill={legs} />
      <rect x="2" y="20" width="3" height="2" fill="#2C1810" />
      <rect x="7" y="20" width="3" height="2" fill="#2C1810" />
    </svg>
  );
}

export function CharacterCreate() {
  const [name, setName] = useState("");
  const [mode, setMode] = useState<DeathMode>("standard");
  const [app, setApp]   = useState<CharacterAppearance>({
    skinTone: 0, hairStyle: 0, hairColor: 3, torsoColor: 0, legsColor: 0,
  });
  const [loading, setLoading] = useState(false);
  const createCharacter = useGameStore((s) => s.createCharacter);

  function setA<K extends keyof CharacterAppearance>(key: K, val: number) {
    setApp((prev) => ({ ...prev, [key]: val }));
  }

  async function handleCreate() {
    if (!name.trim()) return;
    setLoading(true);
    await createCharacter(name.trim(), mode, app);
    setLoading(false);
  }

  return (
    <div className="landing" style={{ justifyContent: "flex-start", paddingTop: 32, overflowY: "auto" }}>
      <h1 style={{ fontSize: 38, marginBottom: 2 }}>Your Thread</h1>
      <p style={{ marginBottom: 16 }}>Every tapestry starts with a single thread.</p>

      <div style={{ width: "100%", maxWidth: 340, display: "flex", flexDirection: "column", gap: 14 }}>

        {/* Name */}
        <div>
          <label className="field-label">CHARACTER NAME</label>
          <input
            type="text"
            placeholder="Enter a name…"
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={20}
            autoFocus
          />
        </div>

        {/* Appearance */}
        <div>
          <label className="field-label">APPEARANCE</label>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            {/* Preview */}
            <div style={{
              background: "rgba(94,115,80,0.25)", borderRadius: 6,
              border: "2px solid var(--walnut)", padding: 8,
              display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0,
            }}>
              <AppearancePreview app={app} />
            </div>

            {/* Controls */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <div className="appear-label">Skin</div>
                <div className="swatch-row">
                  {SKIN_TONES.map((c, i) => (
                    <Swatch key={i} color={c} selected={app.skinTone === i} onClick={() => setA("skinTone", i)} />
                  ))}
                </div>
              </div>
              <div>
                <div className="appear-label">Hair colour</div>
                <div className="swatch-row">
                  {HAIR_COLORS.map((c, i) => (
                    <Swatch key={i} color={c} selected={app.hairColor === i} onClick={() => setA("hairColor", i)} />
                  ))}
                </div>
              </div>
              <div>
                <div className="appear-label">Hair style</div>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {HAIR_LABELS.map((label, i) => (
                    <button
                      key={i}
                      className={`style-chip ${app.hairStyle === i ? "active" : ""}`}
                      onClick={() => setA("hairStyle", i)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="appear-label">Torso</div>
                <div className="swatch-row">
                  {TORSO_COLORS.map((c, i) => (
                    <Swatch key={i} color={c} selected={app.torsoColor === i} onClick={() => setA("torsoColor", i)} />
                  ))}
                </div>
              </div>
              <div>
                <div className="appear-label">Legs</div>
                <div className="swatch-row">
                  {LEGS_COLORS.map((c, i) => (
                    <Swatch key={i} color={c} selected={app.legsColor === i} onClick={() => setA("legsColor", i)} />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mode */}
        <div>
          <label className="field-label">GAME MODE</label>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {MODES.map((m) => (
              <div key={m.id} className={`mode-card ${mode === m.id ? "selected" : ""}`} onClick={() => setMode(m.id)}>
                <h3>{m.label}</h3>
                <p style={{ fontSize: 11, marginBottom: 0 }}>{m.desc}</p>
              </div>
            ))}
          </div>
        </div>

        <button
          className="btn btn-gold"
          onClick={handleCreate}
          disabled={!name.trim() || loading}
          style={{ marginTop: 4 }}
        >
          {loading ? "Weaving your thread…" : "Enter the Tapestry"}
        </button>
      </div>
    </div>
  );
}
