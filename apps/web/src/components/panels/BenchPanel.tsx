import { useGameStore } from "../../store/gameStore";
import { RECIPES, ITEMS } from "@everloom/gamedata";
import { levelFromXp } from "@everloom/engine";
import type { SkillId, ActionDescriptor } from "@everloom/engine";

const SKILL_ICONS: Record<string, string> = {
  smithing: "⚒️", crafting: "🔨", fletching: "🪶", cooking: "🍳",
};

function countInInventory(inv: readonly { itemId: string; qty: number }[], itemId: string): number {
  return inv.find((s) => s.itemId === itemId)?.qty ?? 0;
}

export function BenchPanel() {
  const ps = useGameStore((s) => s.playerState);
  const startAction = useGameStore((s) => s.startAction);
  if (!ps) return null;

  const productionSkills: SkillId[] = ["smithing", "crafting", "fletching", "cooking"];

  function handleCraft(recipeId: string) {
    const action: ActionDescriptor = {
      type: RECIPES.find((r) => r.id === recipeId)?.skill as SkillId ?? "crafting",
      nodeId: null,
      zoneId: ps!.zoneId,
      recipeId,
      targetZoneId: null,
    };
    startAction(action);
  }

  return (
    <>
      <div className="panel-handle" />
      <div className="panel-title">🔨 Bench</div>
      <div className="panel-body">
        {productionSkills.map((skill) => {
          const skillXp = ps.skills[skill] ?? 0;
          const skillLevel = levelFromXp(skillXp);
          const skillRecipes = RECIPES.filter((r) => r.skill === skill);

          return (
            <div key={skill} style={{ marginBottom: 16 }}>
              <div style={{
                fontFamily: "var(--font-ui)", fontSize: 10,
                color: "var(--walnut)", opacity: 0.6,
                marginBottom: 6, textTransform: "uppercase",
              }}>
                {SKILL_ICONS[skill]} {skill} — Level {skillLevel}
              </div>

              {skillRecipes.map((recipe) => {
                const canMake = recipe.inputs.every(
                  (inp) => countInInventory(ps.inventory, inp.itemId) >= inp.qty
                );
                const hasLevel = skillLevel >= recipe.levelReq;
                const hasBlueprint = !recipe.blueprintRequired || ps.foundBlueprintIds.includes(recipe.id);
                const available = canMake && hasLevel && hasBlueprint;

                const outputItem = ITEMS.find((i) => i.id === recipe.output.itemId);

                return (
                  <div key={recipe.id} style={{
                    border: "1px solid var(--walnut)",
                    borderRadius: 4,
                    padding: "8px 10px",
                    marginBottom: 6,
                    background: available ? "var(--linen)" : "rgba(74,55,40,0.05)",
                    opacity: available ? 1 : 0.6,
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                      <span style={{ fontFamily: "var(--font-ui)", fontSize: 11, color: "var(--walnut)" }}>
                        {outputItem?.name ?? recipe.output.itemId}
                        {recipe.output.qty > 1 && <span style={{ color: "var(--weld)" }}> ×{recipe.output.qty}</span>}
                      </span>
                      <span style={{ fontFamily: "var(--font-ui)", fontSize: 9, color: "var(--weld)" }}>
                        +{recipe.xpPerAction} xp
                      </span>
                    </div>

                    {/* Inputs */}
                    <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 6 }}>
                      {recipe.inputs.map((inp) => {
                        const have = countInInventory(ps.inventory, inp.itemId);
                        const itemData = ITEMS.find((i) => i.id === inp.itemId);
                        return (
                          <span key={inp.itemId} style={{
                            fontFamily: "var(--font-ui)", fontSize: 9,
                            color: have >= inp.qty ? "var(--lichen)" : "var(--madder)",
                            background: "var(--linen-dark)",
                            padding: "1px 5px",
                            borderRadius: 2,
                          }}>
                            {itemData?.name ?? inp.itemId}: {have}/{inp.qty}
                          </span>
                        );
                      })}
                    </div>

                    {!hasLevel ? (
                      <span style={{ fontFamily: "var(--font-ui)", fontSize: 9, color: "var(--madder)" }}>
                        Requires {skill} {recipe.levelReq}
                      </span>
                    ) : !hasBlueprint ? (
                      <span style={{ fontFamily: "var(--font-ui)", fontSize: 9, color: "var(--woad)" }}>
                        Blueprint required
                      </span>
                    ) : (
                      <button
                        className={`btn ${available ? "btn-primary" : ""}`}
                        style={{ fontSize: 10, padding: "4px 10px", width: "100%" }}
                        onClick={() => handleCraft(recipe.id)}
                        disabled={!available}
                      >
                        {ps.currentAction.recipeId === recipe.id ? "▶ Crafting..." : "Craft"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </>
  );
}
