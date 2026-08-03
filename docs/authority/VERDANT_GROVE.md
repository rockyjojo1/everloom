# Verdant Grove

Last reviewed: 2026-08-04

Governs: the approved *target* for the Verdant Grove expedition loop — not
the current prototype's behaviour. For current implementation status, see
[`CURRENT_STATE.md`](CURRENT_STATE.md); for full engine-level requirement
detail, see `docs/VERDANT_GROVE_VERTICAL_SLICE.md`; for machine-readable
status flags, see `docs/VERDANT_GROVE_STATUS.md`.

Source authority:
[`CODEX_SUPERVISOR_CONTINUATION.md`](CODEX_SUPERVISOR_CONTINUATION.md) §2, §4
(work packages 6–9), §9. If current repository evidence contradicts this
file, the repository wins.

Related: [`CURRENT_STATE.md`](CURRENT_STATE.md) · [`RISKS.md`](RISKS.md) · [`DECISIONS.md`](DECISIONS.md) · `docs/VERDANT_GROVE_VERTICAL_SLICE.md` · `docs/VERDANT_GROVE_STATUS.md`

## Approved target

Verdant Grove is intended to be the first preparation-driven expedition
loop. The player physically discovers and establishes it in the world.

The eventual loop includes:

- a bounded duration;
- a retreat threshold;
- a food reserve;
- stopping when inventory is full;
- gathering interrupted by deterministic encounters;
- a safe retreat that preserves equipment, earned XP and earned resources;
- an understandable return report.

### Target duration choices

15 minutes · 1 hour · 4 hours · 8 hours · 12 hours

### Target retreat thresholds

25% · 40% · 55%

### Target food reserves

0 · 1 · 3

These are **target settings for the redesigned loop**, not values currently
enforced anywhere in the running game. Do not treat them as implemented
until [`CURRENT_STATE.md`](CURRENT_STATE.md) says otherwise.

## Current implementation reality

Verdant Grove is a domain prototype, not a playable vertical slice. See
[`CURRENT_STATE.md`](CURRENT_STATE.md) for verified facts and
`docs/VERDANT_GROVE_STATUS.md` for the machine-readable flags (all `false`
except `status: prototype`).

## Current blocker list

Before runtime integration proceeds, the following must be resolved (see
`CODEX_SUPERVISOR_CONTINUATION.md` §4 and §8 for full detail):

- stable expedition identity (currently derived from `Date.now()` +
  `Math.random()`);
- injected time and deterministic inputs (no ambient `Date.now()`/
  `Math.random()` reads inside resolution);
- a shared active/offline resolver (one reducer for both paths);
- explicit event ordering (a bounded persisted event sequence);
- one-shot versus chunked resolution equivalence (currently unverified);
- receipt-based idempotency (currently inferred from clearing
  `activeExpedition`, not a stable checked receipt);
- save migration for any new resolver state;
- food and inventory semantics (shared, content-driven, not
  prototype-specific logic);
- retreat semantics;
- shared combat/gathering rules (current wolf combat is an aggregate
  approximation, not the ordinary shared combat system);
- world-to-panel runtime integration (`ExpeditionPanel` has no caller;
  the Ironbark world object does not start an expedition);
- return-report architecture (no integrated report, no separation between
  reward application and acknowledgement);
- real browser (Playwright) tests;
- physical iPhone evidence;
- owner playtesting and confirmation the loop is enjoyable.

## Explicitly deferred scope

- Durability.
- Additional Grove enemy variants.
- Leaderboards.
- More expedition types.
- More skills.
- Multiplayer.
- Cloud expedition sync.
