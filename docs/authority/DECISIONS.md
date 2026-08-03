# Everloom Decisions

Last reviewed: 2026-08-04

Governs: the register of settled, provisional, unresolved, deferred and
forbidden product/technical decisions. This file does not restate rationale
in full — see [`PRODUCT.md`](PRODUCT.md) and
[`TECHNICAL_ARCHITECTURE.md`](TECHNICAL_ARCHITECTURE.md) for the operating
detail behind each settled decision.

Source authority:
[`CODEX_SUPERVISOR_CONTINUATION.md`](CODEX_SUPERVISOR_CONTINUATION.md) §9. If
current repository evidence contradicts this file, the repository wins and
the discrepancy must be recorded, not silently resolved.

Related: [`PRODUCT.md`](PRODUCT.md) · [`TECHNICAL_ARCHITECTURE.md`](TECHNICAL_ARCHITECTURE.md) · [`RISKS.md`](RISKS.md)

## Settled

Do not reopen these without an explicit strategy-chat decision to do so.

- Expedition planner is the primary fantasy; account builder second; active
  adventurer third.
- AFK-first is the internal framing, with activities physically established
  in the world.
- iPhone is priority one; browser remains mandatory; desktop remains strong.
- Active and offline play share one deterministic domain model.
- Combat remains simple point-and-click auto-combat.
- First six skills are Woodcutting, Mining, Fishing, Cooking, Smithing and
  Melee.
- Ordinary retreat preserves equipment, earned XP and earned resources.
- Single-player through first public release.
- Current TypeScript/React/Three.js stack stays pending the physical
  bake-off.
- Capacitor is the proposed iPhone wrapper.
- Godot/GDScript is only the fallback prototype after strategy escalation.
- Original Everloom expression may strongly target OSRS-like readability and
  interaction grammar, but must not copy protectable Jagex expression.
- Blender and GLB/glTF are the target art pipeline.
- Generated images are references, not production assets.
- Stronger Claude models are preferred when their better reasoning avoids
  repeated rework. Haiku is restricted to low-ambiguity, narrow-contract
  work.

## Provisional

Each entry includes the evidence or trigger required to revisit it.

- **Landscape as primary iPhone orientation** — revisit if physical-device
  testing shows portrait is materially better for AFK check-in sessions.
- **30 FPS sustained floor for a representative 20-minute physical session**
  — revisit if the physical bake-off (work package 5) shows this target is
  unreachable on target devices without unacceptable visual cuts.
- **Skill cap of 99** — revisit only if balance simulation or playtesting
  shows a different cap materially improves pacing.
- **One familiarity value per region initially** — revisit if playtesting
  shows regional familiarity needs finer granularity.
- **Verdant numerical tuning bands and encounter schedule** (see
  [`VERDANT_GROVE.md`](VERDANT_GROVE.md)) — revisit after owner playtest of
  the redesigned, runtime-integrated loop.
- **Eventual cloud provider and conflict protocol** — revisit once local
  deterministic resolution and receipts are correct (see
  [`RISKS.md`](RISKS.md) — cloud conflict).
- **Three or four regions and possibly one boss/delve for first public
  release** — revisit based on production capacity evidence after the asset
  and platform gates.

## Unresolved

- Whether the Vercel project actually deploys `apps/game` rather than a
  legacy app.
- Whether the current stack passes the physical iPhone bake-off.
- Exact asset provenance coverage and the signature-asset production route.
- Final deterministic expedition state/receipt representation.
- Final public monetisation.
- Whether Verdant preparation/encounter behaviour is genuinely enjoyable.

## Deferred

Additional skills, pets, prestige, durability, ordinary equipment/resource
loss, offline dungeons, free-form camps, regional talent trees, procedural
world generation, more Grove enemy types, elaborate combat abilities, social
features, multiplayer, trading, player economy, guilds, housing, seasons,
localisation, mod support, live events, extensive bespoke animation.

## Forbidden before private alpha unless strategy explicitly reopens

MMO architecture, server-authoritative shared-world combat, player
trading/economy, loot boxes, paid progression, paid offline time, energy
systems, compulsory streaks, destructive routine failure, engine migration
without bake-off evidence, unclear-licence production assets.
