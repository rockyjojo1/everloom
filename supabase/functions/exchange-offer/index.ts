// exchange-offer — place or cancel buy/sell offers on el_exchange_offers.
// Placing a sell offer deducts from the player's bank (server-authoritative).
// Placing a buy offer reserves gold (not yet implemented — future feature).
// Tries instant matching against the opposite side before creating an open offer.

import { createClient } from "npm:@supabase/supabase-js@2";

type SupabaseClient = ReturnType<typeof createClient>;

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

    const { data: { user }, error: authErr } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (authErr || !user) return err(401, "Invalid token");

    const body = await req.json() as {
      action: "place" | "cancel";
      side?: "buy" | "sell";
      itemId?: string;
      qty?: number;
      priceGp?: number;
      offerId?: number;
    };

    if (body.action === "place") {
      return await placeOffer(supabase, user.id, body);
    } else if (body.action === "cancel") {
      return await cancelOffer(supabase, user.id, body.offerId);
    }

    return err(400, "Unknown action");
  } catch (e) {
    console.error("exchange-offer error:", e);
    return err(500, "Internal error");
  }
});

async function placeOffer(
  supabase: SupabaseClient,
  playerId: string,
  body: { side?: "buy" | "sell"; itemId?: string; qty?: number; priceGp?: number },
): Promise<Response> {
  const { side, itemId, qty, priceGp } = body;
  if (!side || !itemId || !qty || !priceGp) return err(400, "Missing required fields");
  if (qty < 1 || priceGp < 1) return err(400, "qty and priceGp must be >= 1");
  if (!["buy", "sell"].includes(side)) return err(400, "side must be buy or sell");

  // For sell offers: deduct the items from the player's bank.
  if (side === "sell") {
    const { data: stateRow, error: loadErr } = await supabase
      .from("el_player_state")
      .select("bank")
      .eq("player_id", playerId)
      .single();
    if (loadErr || !stateRow) return err(404, "Player state not found");

    const bank = (stateRow as { bank: Array<{ itemId: string; qty: number }> }).bank;
    const stackIdx = bank.findIndex((s: { itemId: string }) => s.itemId === itemId);
    if (stackIdx < 0 || bank[stackIdx]!.qty < qty) return err(400, "Insufficient items in bank");

    bank[stackIdx] = { itemId, qty: bank[stackIdx]!.qty - qty };
    const newBank = bank.filter((s: { qty: number }) => s.qty > 0);

    const { error: bankErr } = await supabase
      .from("el_player_state")
      .update({ bank: newBank })
      .eq("player_id", playerId);
    if (bankErr) return err(500, "Failed to update bank");
  }

  // Try instant matching: find the best opposing offer.
  const opposingSide = side === "sell" ? "buy" : "sell";
  const { data: matches } = await supabase
    .from("el_exchange_offers")
    .select("*")
    .eq("item_id", itemId)
    .eq("side", opposingSide)
    .in("status", ["open", "partial"])
    .neq("player_id", playerId)
    .order("price_per", { ascending: side === "sell" }) // seller wants highest buy price
    .limit(1);

  const bestMatch = matches?.[0];
  const canMatch = bestMatch && (
    side === "sell" ? bestMatch.price_per >= priceGp : bestMatch.price_per <= priceGp
  );

  if (canMatch && bestMatch) {
    const fillQty = Math.min(qty, bestMatch.qty - bestMatch.qty_filled);
    const newFilled = bestMatch.qty_filled + fillQty;
    const newStatus = newFilled >= bestMatch.qty ? "filled" : "partial";

    await supabase
      .from("el_exchange_offers")
      .update({ qty_filled: newFilled, status: newStatus })
      .eq("id", bestMatch.id);

    const remaining = qty - fillQty;

    // Give the matched items to the appropriate player's bank.
    if (side === "sell") {
      // Buyer gets the items.
      await creditBank(supabase, bestMatch.player_id, itemId, fillQty);
    } else {
      // Seller gets the items (or they've already been deducted, buyer receives later).
      await creditBank(supabase, playerId, itemId, fillQty);
    }

    if (remaining <= 0) return ok({ ok: true, filled: fillQty });

    // Create a partially-filled offer for the remainder.
    const { data: newOffer } = await supabase
      .from("el_exchange_offers")
      .insert({ player_id: playerId, item_id: itemId, side, qty: remaining, qty_filled: 0, price_per: priceGp, status: "open" })
      .select("id")
      .single();
    return ok({ ok: true, filled: fillQty, offerId: newOffer?.id });
  }

  // No match — create open offer.
  const { data: newOffer, error: insertErr } = await supabase
    .from("el_exchange_offers")
    .insert({ player_id: playerId, item_id: itemId, side, qty, qty_filled: 0, price_per: priceGp, status: "open" })
    .select("id")
    .single();
  if (insertErr) return err(500, "Failed to create offer");

  return ok({ ok: true, offerId: newOffer?.id, filled: 0 });
}

async function cancelOffer(
  supabase: SupabaseClient,
  playerId: string,
  offerId?: number,
): Promise<Response> {
  if (!offerId) return err(400, "offerId required");

  const { data: offer, error: fetchErr } = await supabase
    .from("el_exchange_offers")
    .select("*")
    .eq("id", offerId)
    .eq("player_id", playerId)
    .single();
  if (fetchErr || !offer) return err(404, "Offer not found");

  const o = offer as { status: string; side: string; item_id: string; qty: number; qty_filled: number };
  if (o.status === "filled" || o.status === "cancelled") return err(400, "Offer already resolved");

  const { error: cancelErr } = await supabase
    .from("el_exchange_offers")
    .update({ status: "cancelled" })
    .eq("id", offerId);
  if (cancelErr) return err(500, "Failed to cancel offer");

  // Return unfilled items to bank for sell offers.
  if (o.side === "sell") {
    const unfilled = o.qty - o.qty_filled;
    if (unfilled > 0) {
      await creditBank(supabase, playerId, o.item_id, unfilled);
    }
  }

  return ok({ ok: true });
}

async function creditBank(supabase: SupabaseClient, playerId: string, itemId: string, qty: number) {
  const { data: stateRow } = await supabase
    .from("el_player_state")
    .select("bank")
    .eq("player_id", playerId)
    .single();
  if (!stateRow) return;

  const bank = (stateRow as { bank: Array<{ itemId: string; qty: number }> }).bank;
  const existing = bank.find((s: { itemId: string }) => s.itemId === itemId);
  if (existing) existing.qty += qty; else bank.push({ itemId, qty });

  await supabase
    .from("el_player_state")
    .update({ bank })
    .eq("player_id", playerId);
}

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
