-- ============================================================
-- EVERLOOM — Initial Schema
-- Prefix: el_  (isolated from brisbane-eats eats_ and movie-night mn_ tables)
-- RLS: players read only their own rows.
--      el_player_state has NO client write policy. Service role only.
-- ============================================================

-- ── Extensions ───────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Players ──────────────────────────────────────────────────
create table if not exists el_players (
  id            uuid primary key default auth.uid(),
  display_name  text unique not null,
  mode          text not null check (mode in ('cozy', 'standard', 'ironbound')),
  rng_seed      bigint not null default (floor(random() * 9223372036854775807)),
  created_at    timestamptz not null default now(),
  last_seen_at  timestamptz not null default now(),
  is_dead       boolean not null default false,
  days_survived int not null default 0,    -- headline flex stat
  rival_seed    bigint not null default (floor(random() * 9223372036854775807))
);

alter table el_players enable row level security;
create policy "players_select_own" on el_players for select using (auth.uid() = id);
create policy "players_insert_own" on el_players for insert with check (auth.uid() = id);
create policy "players_update_own" on el_players for update using (auth.uid() = id);

-- ── Player state ─────────────────────────────────────────────
-- THE critical table. Client has NO write permission.
-- All mutations via service-role edge functions.
create table if not exists el_player_state (
  player_id          uuid primary key references el_players(id) on delete cascade,
  checkpoint_at      timestamptz not null default now(),
  current_action     jsonb not null default '{"type":"idle","nodeId":null,"zoneId":"meadowrest","startedAt":0,"recipeId":null,"targetZoneId":null}'::jsonb,
  parallel_actions   jsonb not null default '[]'::jsonb,
  skills             jsonb not null default '{"woodcutting":0,"mining":0,"fishing":0,"crafting":0,"smithing":0,"fletching":0,"cooking":0,"combat":0,"wayfaring":0,"slayer":0}'::jsonb,
  mastery            jsonb not null default '{}'::jsonb,
  inventory          jsonb not null default '[]'::jsonb,
  slots              int not null default 10,
  stack_caps         jsonb not null default '{"log":1,"ore":1,"fish":1,"food":1,"board":1,"bar":1,"shaft":1,"rivet":1,"hide":1,"misc":1,"gear":1,"rare":1,"gem":1,"slayer":1,"tool_head":1,"tool_haft":1,"tool_bind":1,"armour":1}'::jsonb,
  bank               jsonb not null default '[]'::jsonb,
  larder             jsonb not null default '[]'::jsonb,
  equipment          jsonb not null default '{"hatchet":{"headId":"copper_hatchet_head","haftId":"pine_haft","bindingId":"rough_binding","headTier":1,"haftTier":1,"bindingTier":1,"wearMastery":0,"wearPct":1000},"pickaxe":null,"fishingRod":null,"helmet":null,"body":null,"legs":null,"kitUnlocked":false}'::jsonb,
  couriers           jsonb not null default '[{"id":"courier_0","name":"Wren","personality":"always leaves a pebble on top of the satchel","state":"idle","etaSeconds":0,"tripsCompleted":0}]'::jsonb,
  patterns           jsonb not null default '[]'::jsonb,
  motes              int not null default 0,
  rival_xp_snapshot  jsonb not null default '{}'::jsonb,
  rival_last_updated_at bigint not null default 0,
  hp                 int not null default 10,
  max_hp             int not null default 10,
  defence_rating     int not null default 0,
  attack_rating      int not null default 1,
  strength_rating    int not null default 1,
  zone_id            text not null default 'meadowrest',
  unlocked_zones     jsonb not null default '["meadowrest"]'::jsonb,
  travel_progress    int not null default 0,
  collected_item_ids jsonb not null default '[]'::jsonb,
  completed_bundle_ids jsonb not null default '[]'::jsonb,
  completed_weekly_contract_ids jsonb not null default '[]'::jsonb,
  found_blueprint_ids jsonb not null default '[]'::jsonb,
  pets               jsonb not null default '[]'::jsonb,
  version            int not null default 0,
  is_dead            boolean not null default false
);

alter table el_player_state enable row level security;
-- Read own state only.
create policy "state_select_own" on el_player_state for select using (auth.uid() = player_id);
-- NO insert/update/delete client policies. Service role only.

-- ── Item ledger (append-only audit log) ──────────────────────
create table if not exists el_item_ledger (
  id          bigint generated always as identity primary key,
  player_id   uuid not null references el_players(id) on delete cascade,
  item_id     text not null,
  delta       int not null,   -- positive = gained, negative = lost
  reason      text not null,
  at          timestamptz not null default now()
);

alter table el_item_ledger enable row level security;
create policy "ledger_select_own" on el_item_ledger for select using (auth.uid() = player_id);

-- ── Ledger progress ───────────────────────────────────────────
create table if not exists el_ledger_progress (
  player_id           uuid not null references el_players(id) on delete cascade,
  bundle_id           text not null,
  items_submitted     jsonb not null default '{}'::jsonb,
  completed_at        timestamptz,
  primary key (player_id, bundle_id)
);

alter table el_ledger_progress enable row level security;
create policy "ledger_progress_select_own" on el_ledger_progress for select using (auth.uid() = player_id);

-- ── Exchange offers ───────────────────────────────────────────
create table if not exists el_exchange_offers (
  id            bigint generated always as identity primary key,
  player_id     uuid not null references el_players(id) on delete cascade,
  item_id       text not null,
  side          text not null check (side in ('buy', 'sell')),
  qty           int not null check (qty > 0),
  qty_filled    int not null default 0,
  price_per     int not null check (price_per > 0),
  status        text not null default 'open' check (status in ('open', 'partial', 'filled', 'cancelled')),
  created_at    timestamptz not null default now()
);

alter table el_exchange_offers enable row level security;
create policy "offers_select_own" on el_exchange_offers for select using (auth.uid() = player_id);

-- ── Collection log ────────────────────────────────────────────
create table if not exists el_collection_log (
  player_id         uuid not null references el_players(id) on delete cascade,
  item_id           text not null,
  first_obtained_at timestamptz not null default now(),
  total_obtained    int not null default 1,
  primary key (player_id, item_id)
);

alter table el_collection_log enable row level security;
create policy "collection_select_own" on el_collection_log for select using (auth.uid() = player_id);

-- ── Cheat events ─────────────────────────────────────────────
create table if not exists el_cheat_events (
  id             bigint generated always as identity primary key,
  player_id      uuid not null references el_players(id) on delete cascade,
  kind           text not null,
  client_claim   jsonb not null default '{}'::jsonb,
  server_truth   jsonb not null default '{}'::jsonb,
  at             timestamptz not null default now()
);

alter table el_cheat_events enable row level security;
-- Players cannot read their own cheat events (no policy = no access).

-- ── Idempotency keys (prevent double-apply on flaky mobile) ──
create table if not exists el_idempotency_keys (
  key         text primary key,
  player_id   uuid not null references el_players(id) on delete cascade,
  created_at  timestamptz not null default now()
);

alter table el_idempotency_keys enable row level security;
-- Service role only.

-- ── Indexes ───────────────────────────────────────────────────
create index if not exists el_item_ledger_player_idx on el_item_ledger(player_id, at desc);
create index if not exists el_exchange_offers_item_idx on el_exchange_offers(item_id, status, side);
create index if not exists el_idempotency_cleanup_idx on el_idempotency_keys(created_at);

-- ── Auto-cleanup old idempotency keys (>7 days) ───────────────
create or replace function el_cleanup_idempotency_keys()
returns void language plpgsql as $$
begin
  delete from el_idempotency_keys where created_at < now() - interval '7 days';
end;
$$;
