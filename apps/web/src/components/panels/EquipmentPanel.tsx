import { useGameStore } from "../../store/gameStore";
import { ITEMS } from "@everloom/gamedata";

const ITEM_ICONS: Record<string, string> = {
  worn_hatchet: "🪓", worn_pickaxe: "⛏️",
  copper_hatchet: "🪓", copper_pickaxe: "⛏️",
  iron_hatchet: "🪓", iron_pickaxe: "⛏️",
  copper_fishing_rod: "🎣", iron_fishing_rod: "🎣",
  bronze_helm: "⛑️", bronze_body: "🥇", bronze_legs: "🩱",
  iron_helm: "⛑️", iron_body: "🥇", iron_legs: "🩱",
};

function getIcon(itemId: string): string {
  return ITEM_ICONS[itemId] ?? "📦";
}

function getToolName(tool: any): string {
  if (!tool || !tool.headId) return "—";
  const item = ITEMS.find((it) => it.id === tool.headId);
  return item?.name ?? tool.headId;
}

function getWearPercentage(wearPct: number): number {
  return Math.floor((wearPct / 1000) * 100);
}

export function EquipmentPanel() {
  const ps = useGameStore((s) => s.playerState);
  if (!ps) return null;

  const { equipment } = ps;

  return (
    <>
      <div className="panel-handle" />
      <div className="panel-title">⚔️ Equipment</div>
      <div className="panel-body">
        {/* Tool Slots */}
        <div style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--walnut)", opacity: 0.6, marginBottom: 6 }}>
          TOOLS
        </div>

        {/* Hatchet Slot */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 11 }}>🪓 Hatchet</span>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 10, opacity: 0.7 }}>
              {equipment.hatchet ? getWearPercentage(equipment.hatchet.wearPct) + "%" : "—"}
            </span>
          </div>
          {equipment.hatchet ? (
            <>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 9, opacity: 0.8, marginBottom: 4 }}>
                {getToolName(equipment.hatchet)}
              </div>
              <div className="progress-wrap">
                <div
                  className="progress-fill blue"
                  style={{ width: `${getWearPercentage(equipment.hatchet.wearPct)}%` }}
                />
              </div>
            </>
          ) : (
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 9, opacity: 0.5, color: "var(--danger)" }}>
              No hatchet equipped
            </div>
          )}
        </div>

        {/* Pickaxe Slot */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 11 }}>⛏️ Pickaxe</span>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 10, opacity: 0.7 }}>
              {equipment.pickaxe ? getWearPercentage(equipment.pickaxe.wearPct) + "%" : "—"}
            </span>
          </div>
          {equipment.pickaxe ? (
            <>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 9, opacity: 0.8, marginBottom: 4 }}>
                {getToolName(equipment.pickaxe)}
              </div>
              <div className="progress-wrap">
                <div
                  className="progress-fill blue"
                  style={{ width: `${getWearPercentage(equipment.pickaxe.wearPct)}%` }}
                />
              </div>
            </>
          ) : (
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 9, opacity: 0.5, color: "var(--danger)" }}>
              No pickaxe equipped
            </div>
          )}
        </div>

        {/* Fishing Rod Slot */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 11 }}>🎣 Fishing Rod</span>
            <span style={{ fontFamily: "var(--font-ui)", fontSize: 10, opacity: 0.7 }}>
              {equipment.fishingRod ? getWearPercentage(equipment.fishingRod.wearPct) + "%" : "—"}
            </span>
          </div>
          {equipment.fishingRod ? (
            <>
              <div style={{ fontFamily: "var(--font-ui)", fontSize: 9, opacity: 0.8, marginBottom: 4 }}>
                {getToolName(equipment.fishingRod)}
              </div>
              <div className="progress-wrap">
                <div
                  className="progress-fill blue"
                  style={{ width: `${getWearPercentage(equipment.fishingRod.wearPct)}%` }}
                />
              </div>
            </>
          ) : (
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 9, opacity: 0.5, color: "var(--danger)" }}>
              No fishing rod equipped
            </div>
          )}
        </div>

        {/* Armour Slots */}
        <div style={{ fontFamily: "var(--font-ui)", fontSize: 10, color: "var(--walnut)", opacity: 0.6, marginBottom: 6 }}>
          ARMOUR
        </div>

        {/* Helmet Slot */}
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 11 }}>⛑️ Helmet</span>
          {equipment.helmet ? (
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 9, opacity: 0.8, marginTop: 2 }}>
              {ITEMS.find((it) => it.id === equipment.helmet)?.name ?? equipment.helmet}
            </div>
          ) : (
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 9, opacity: 0.5, color: "var(--danger)" }}>
              None equipped
            </div>
          )}
        </div>

        {/* Body Slot */}
        <div style={{ marginBottom: 6 }}>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 11 }}>🥇 Body</span>
          {equipment.body ? (
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 9, opacity: 0.8, marginTop: 2 }}>
              {ITEMS.find((it) => it.id === equipment.body)?.name ?? equipment.body}
            </div>
          ) : (
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 9, opacity: 0.5, color: "var(--danger)" }}>
              None equipped
            </div>
          )}
        </div>

        {/* Legs Slot */}
        <div>
          <span style={{ fontFamily: "var(--font-ui)", fontSize: 11 }}>🩱 Legs</span>
          {equipment.legs ? (
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 9, opacity: 0.8, marginTop: 2 }}>
              {ITEMS.find((it) => it.id === equipment.legs)?.name ?? equipment.legs}
            </div>
          ) : (
            <div style={{ fontFamily: "var(--font-ui)", fontSize: 9, opacity: 0.5, color: "var(--danger)" }}>
              None equipped
            </div>
          )}
        </div>
      </div>
    </>
  );
}
