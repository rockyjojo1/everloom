// commit-action — validates and saves a player's new action to el_player_state.
// Called when the player explicitly changes what they're doing (click a node, start crafting, travel).
// The server runs resolve(elapsed=0) to apply the action change cleanly, then writes back.

import { createClient } from "npm:@supabase/supabase-js@2";
import { resolve } from "../_shared/engine.ts";
import type { ActionDescriptor, PlayerState } from "../_shared/engine.ts";
import { GAME_DATA } from "../_shared/gamedata.ts";

const VALID_ACTION_TYPES = new Set([
  "idle", "woodcutting", "mining", "fishing",
  "crafting", "smithing", "fletching", "cooking", "traveling", "slayer",
]);

const VALID_ZONE_IDS = new Set([
  "meadowrest", "bramblewood", "ashen_delve",
  "saltmarsh_reach", "gloamfen", "emberpeak", "frayed_reach", "loomheart",
]);

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders() });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return err(401, "Missing Authorization header");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Verify the JWT and get the user.
    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !user) return err(401, "Invalid token");

    const body = await req.json() as { action?: unknown; idempotencyKey?: string };

    // Idempotency: reject duplicate requests within 5 minutes.
    if (body.idempotencyKey) {
      const { data: existing } = await supabase
        .from("el_idempotency_keys")
        .select("key")
        .eq("key", body.idempotencyKey)
        .single();
      if (existing) return ok({ ok: true, idempotent: true });
    }

    // Validate the incoming action descriptor.
    const action = body.action as ActionDescriptor | undefined;
    if (!action || !VALID_ACTION_TYPES.has(action.type)) return err(400, "Invalid action type");
    if (!action.zoneId || !VALID_ZONE_IDS.has(action.zoneId)) return err(400, "Invalid zoneId");

    // Load current state from DB.
    const { data: stateRow, error: loadErr } = await supabase
      .from("el_player_state")
      .select("*")
      .eq("player_id", user.id)
      .single();
    if (loadErr || !stateRow) return err(404, "Player state not found");

    const ps = rowToPlayerState(stateRow as Record<string, unknown>);

    // Apply action with elapsedSeconds = 0 (just sets current_action, updates checkpoint).
    const now = Math.floor(Date.now() / 1000);
    const result = resolve({ state: ps, action, elapsedSeconds: 0, nowSeconds: now, rngSeed: ps.rngSeed }, GAME_DATA);

    // Write the new state back (service role bypasses RLS).
    const { error: saveErr } = await supabase
      .from("el_player_state")
      .update(playerStateToRow(result.state))
      .eq("player_id", user.id);
    if (saveErr) return err(500, "Failed to save state");

    // Record idempotency key.
    if (body.idempotencyKey) {
      await supabase.from("el_idempotency_keys").insert({ key: body.idempotencyKey, player_id: user.id });
    }

    return ok({ ok: true });
  } catch (e) {
    console.error("commit-action error:", e);
    return err(500, "Internal error");
  }
});

// ── Helpers ────────────────────────────────────────────────────

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
}

function ok(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function err(status: number, message: string) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders() },
  });
}

function rowToPlayerState(row: Record<string, unknown>): PlayerState {
  return {
    playerId: row["player_id"] as string,
    displayName: (row["display_name"] as string) ?? "Wanderer",
    mode: (row["mode"] as "cozy" | "standard" | "ironbound") ?? "standard",
    rngSeed: BigInt((row["rng_seed"] as string | number) ?? 0),
    checkpointAt: Math.floor(new Date(row["checkpoint_at"] as string).getTime() / 1000),
    currentAction: row["current_action"] as PlayerState["currentAction"],
    parallelActions: (row["parallel_actions"] as PlayerState["parallelActions"]) ?? [],
    skills: (row["skills"] as PlayerState["skills"]) ?? { woodcutting: 0, mining: 0, fishing: 0, crafting: 0, smithing: 0, fletching: 0, cooking: 0, combat: 0, wayfaring: 0, slayer: 0 },
    mastery: (row["mastery"] as PlayerState["mastery"]) ?? {},
    inventory: (row["inventory"] as PlayerState["inventory"]) ?? [],
    slots: (row["slots"] as number) ?? 10,
    stackCaps: (row["stack_caps"] as PlayerState["stackCaps"]) ?? {},
    bank: (row["bank"] as PlayerState["bank"]) ?? [],
    larder: (row["larder"] as PlayerState["larder"]) ?? [],
    equipment: row["equipment"] as PlayerState["equipment"],
    couriers: (row["couriers"] as PlayerState["couriers"]) ?? [],
    patterns: (row["patterns"] as PlayerState["patterns"]) ?? [],
    motes: (row["motes"] as number) ?? 0,
    rivalXpSnapshot: (row["rival_xp_snapshot"] as PlayerState["rivalXpSnapshot"]) ?? {},
    rivalLastUpdatedAt: (row["rival_last_updated_at"] as number) ?? 0,
    combat: { hp: (row["hp"] as number) ?? 10, maxHp: (row["max_hp"] as number) ?? 10, defenceRating: (row["defence_rating"] as number) ?? 0, attackRating: (row["attack_rating"] as number) ?? 1, strengthRating: (row["strength_rating"] as number) ?? 1 },
    zoneId: (row["zone_id"] as PlayerState["zoneId"]) ?? "meadowrest",
    unlockedZones: (row["unlocked_zones"] as PlayerState["unlockedZones"]) ?? ["meadowrest"],
    travelProgress: (row["travel_progress"] as number) ?? 0,
    collectedItemIds: (row["collected_item_ids"] as string[]) ?? [],
    completedBundleIds: (row["completed_bundle_ids"] as string[]) ?? [],
    completedWeeklyContractIds: (row["completed_weekly_contract_ids"] as string[]) ?? [],
    foundBlueprintIds: (row["found_blueprint_ids"] as string[]) ?? [],
    pets: (row["pets"] as string[]) ?? [],
    version: (row["version"] as number) ?? 0,
    isDead: (row["is_dead"] as boolean) ?? false,
  };
}

function playerStateToRow(ps: PlayerState): Record<string, unknown> {
  return {
    checkpoint_at: new Date(ps.checkpointAt * 1000).toISOString(),
    current_action: ps.currentAction,
    parallel_actions: ps.parallelActions,
    skills: ps.skills,
    mastery: ps.mastery,
    inventory: ps.inventory,
    slots: ps.slots,
    stack_caps: ps.stackCaps,
    bank: ps.bank,
    larder: ps.larder,
    equipment: ps.equipment,
    couriers: ps.couriers,
    patterns: ps.patterns,
    motes: ps.motes,
    rival_xp_snapshot: ps.rivalXpSnapshot,
    rival_last_updated_at: ps.rivalLastUpdatedAt,
    hp: ps.combat.hp,
    max_hp: ps.combat.maxHp,
    defence_rating: ps.combat.defenceRating,
    attack_rating: ps.combat.attackRating,
    strength_rating: ps.combat.strengthRating,
    zone_id: ps.zoneId,
    unlocked_zones: ps.unlockedZones,
    travel_progress: ps.travelProgress,
    collected_item_ids: ps.collectedItemIds,
    completed_bundle_ids: ps.completedBundleIds,
    completed_weekly_contract_ids: ps.completedWeeklyContractIds,
    found_blueprint_ids: ps.foundBlueprintIds,
    pets: ps.pets,
    version: ps.version,
    is_dead: ps.isDead,
  };
}
