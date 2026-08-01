# Codex Offline Simulation Handoff

Branch: `codex/offline-simulation-foundation`

Base: `7bc859a` from `claude/tutorial-island-playable`

## Scope

This isolated slice does not touch Claude's current EscapeIntro/App/store work. It improves the deterministic core and the existing offline return report.

## Changes

- Conservatively batches deterministic production when time, inputs, output capacity, quest ordering, and integer safety prove aggregation is safe.
- Falls back to the existing per-action path for partial actions, active output objectives, ambiguous inputs, input/output aliasing, capacity-sensitive recipes, and unsafe integer ranges.
- Aggregates production inputs, output, XP, sequence advancement, report totals, and level-gain reporting.
- Renames runtime report `stopAtMs` to `stoppedAfterMs` and defines it as elapsed time within the current simulation window, rather than the player's lifetime simulation clock.
- Updates the offline report UI to use the corrected relative stop time.
- Adds a 100,000-action production regression test and verifies that a save with seven days of prior simulation reports a relative natural-stop time.

## Validation

- `pnpm --filter @everloom/core test`: 44/44 passed.
- `pnpm --filter @everloom/core typecheck`: passed.
- `pnpm --filter @everloom/game typecheck`: passed.
- `pnpm test`: 10/10 Turbo tasks passed; core 44/44, content 23/23, game 7/7.
- `pnpm typecheck`: 13/13 Turbo tasks passed.
- `pnpm build`: 8/8 Turbo tasks passed; player entry 304.6 KiB / 400 KiB.

The existing legacy `client3d` chunk warning remains unrelated. The Turbo shared-cache log replays an old absolute path for asset-catalog output; no asset files are part of this branch.

## Integration

Integrate after Claude commits the EscapeIntro slice. Cherry-pick this branch's implementation commit; expected overlap is limited to none of Claude's current source files. Re-run core tests, typecheck, build, and any updated offline/PWA browser coverage after integration.

## Deliberate limits

This is the production batching foundation, not a claim that every activity is now constant-time. Gathering and combat remain event-by-event because RNG, mastery changes, respawns, drops, equipment, HP, and stop boundaries must remain exact. Extend those only with independently proven event-boundary algorithms.
