import React from "react";
import { forecastExpedition, startExpedition, resolveExpedition } from "@everloom/core";
import type { GameSave, ExpeditionResult } from "@everloom/core";

interface ExpeditionPanelProps {
  save: GameSave;
  onStart: (save: GameSave) => void;
  onResolve: (result: ExpeditionResult, state: GameSave) => void;
}

export function ExpeditionPanel({ save, onStart, onResolve }: ExpeditionPanelProps) {
  const expedition = save.activeExpedition;
  const [durationMinutes, setDurationMinutes] = React.useState(30);

  if (expedition) {
    // Active or resume view
    const elapsedMs = save.simulationTimeMs - expedition.startedAtMs;
    const remainingMs = expedition.requestedDurationMs - elapsedMs;
    const progressPercent = (elapsedMs / expedition.requestedDurationMs) * 100;

    return (
      <div className="expedition-active">
        <h3>Verdant Grove: Ironbark Expedition</h3>
        <p>Duration: {Math.ceil(remainingMs / 1000)}s remaining</p>
        <progress value={progressPercent} max={100} />
        <button onClick={() => {
          const result = resolveExpedition(save, Math.min(remainingMs, expedition.requestedDurationMs));
          if (result) onResolve(result.result, result.state);
        }}>
          Complete Expedition
        </button>
      </div>
    );
  }

  // Start view
  const forecast = forecastExpedition(save, durationMinutes * 60000);

  return (
    <div className="expedition-start">
      <h3>Verdant Grove: Ironbark Woodcutting</h3>

      <div className="expedition-controls">
        <label>Duration (minutes):
          <input
            type="range"
            min="1"
            max="60"
            value={durationMinutes}
            onChange={(e) => setDurationMinutes(Number(e.target.value))}
          />
          <span>{durationMinutes}m</span>
        </label>
      </div>

      <div className="expedition-forecast">
        <h4>Forecast</h4>
        <dl>
          <dt>Logs:</dt>
          <dd>{forecast.estimatedLogsMin}-{forecast.estimatedLogsMax}</dd>
          <dt>Woodcutting XP:</dt>
          <dd>{forecast.estimatedWoodcuttingXpMin}-{forecast.estimatedWoodcuttingXpMax}</dd>
          <dt>Wolf Encounters:</dt>
          <dd>~{Math.round(durationMinutes * (forecast.encounterRiskPercent / 100))}</dd>
          <dt>Expected Damage:</dt>
          <dd>{forecast.estimatedDamageMin}-{forecast.estimatedDamageMax}</dd>
          <dt>Food Usage:</dt>
          <dd>{forecast.estimatedFoodUsageMin}-{forecast.estimatedFoodUsageMax}</dd>
          <dt>Current Food:</dt>
          <dd>{forecast.currentFoodSupply}</dd>
        </dl>
      </div>

      {forecast.warnings.length > 0 && (
        <div className="expedition-warnings">
          <h4>⚠️ Warnings</h4>
          <ul>
            {forecast.warnings.map((w, i) => <li key={i}>{w}</li>)}
          </ul>
        </div>
      )}

      <div className="expedition-loadout">
        <h4>Loadout</h4>
        <p>Hatchet: {save.equipment.tool || "None equipped"}</p>
        <p>Health: {save.player.hp}/{save.player.maxHp}</p>
        <p>Inventory: {save.inventory.length}/{save.inventorySlots}</p>
      </div>

      <button
        onClick={() => {
          const { state } = startExpedition(save, "verdant-grove", "ironbark-woodcutting", durationMinutes * 60000);
          onStart(state);
        }}
        disabled={forecast.warnings.some(w => w.includes("immediately"))}
      >
        Begin Expedition
      </button>
    </div>
  );
}
