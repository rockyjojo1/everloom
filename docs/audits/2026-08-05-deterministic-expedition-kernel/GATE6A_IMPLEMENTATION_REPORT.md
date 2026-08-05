# Gate 6A: Deterministic Expedition Resolution Kernel — Implementation Report

Date: 2026-08-05
Branch: `jules/gate6a-adversarial-hardening-11945358711948676083`
Base: `monkeycode/deterministic-expedition-kernel` at `c8dc4f35f56316b01656cc21c74e963bb3ec493b`

This is an implementation report for the MONKEYCODE Gate 6A task: build a pure, deterministic expedition-resolution kernel in `packages/core`, isolated from the legacy expedition/save modules. It records what was built, the exact semantics, how it was verified, and what is deliberately out of scope.

## Revision history

- **First pass (MonkeyCode)**: initial resolver implementation, rejected by independent supervisor for defects in time model, inventory capacity checks, lethal encounter wins, food clock tracking, terminal no-ops, and validation.
- **Second pass (MonkeyCode)**: corrected initial resolution kernel bugs and chunked partitions.
- **Third pass (Jules - Corrective Pass 1)**: added plan-aware validation with simulation history replay, rejected for O(N) scaling.
- **Fourth pass (Jules - Corrective Pass 2)**: upgraded schema to version 2 with snapshot state, added bounded algebraic O(1) checks. Rejected for impossible food clock transitions and lack of precise damage/loss bounds.
- **Fifth pass (Jules - Corrective Pass 3)**: implemented complete precise O(1) algebraic food, combat-time, damage, and terminal-reason consistency checks, with zero loops and full safe-integer protections.
- **Sixth pass (Jules - Corrective Pass 4)**: corrected remaining active progress missing-partial action and completed/food-exhausted shortened final gathering defects. Enforces exact active/completed/stopped action-time accounting models cleanly without chronological loops or replaying history.

## Scope and protected paths

Only the following files were created or modified:

| File | Change |
|---|---|
| `packages/core/src/expedition-contract.ts` | **Modified** — schema, types, stable validation, error class/codes; O(1) plan-aware validator |
| `packages/core/src/expedition-contract.test.ts` | **Modified** — contract/validation tests (73 tests) |
| `packages/core/src/expedition-adversarial.test.ts` | **Created** — 48 adversarial/gap test scenarios |
| `docs/audits/2026-08-05-deterministic-expedition-kernel/*` | **Created** — audit reports and logs |

All other packages/app files, save integrations, database rules, and locks were kept clean and untouched.

## Active Progress Action-Time accounting:
Enforces `productiveGatheringMs === completedGatherings * rules.gatheringWindowMs + partialGatheringMs` and `combatInterruptionMs === encounters * rules.combatDurationMs + partialCombatMs`, requiring `partialAction !== null` if there is elapsed action time, or that it is at an exact completed action boundary.

## Shortened Final-Gathering deficit formula:
Allows a single shortened gathering at plan end (`elapsedResolvedMs === plan.requestedDurationMs`). If `actualGatheringMs < nominalGatheringMs`, computes `deficitMs = nominalGatheringMs - actualGatheringMs`, `shortFinalGatheringMs = rules.gatheringWindowMs - deficitMs`. Rejects deficit if `deficitMs >= rules.gatheringWindowMs` (multiple shortened gatherings), or if final scheduled action is an encounter.

## Food exhausted at plan end:
At `requestedDurationMs` terminal boundary, residual combat and gathering times must equal 0, and gathering time is validated using the same `all-full-or-one-short-final` rule.

## Verification summary

All tests pass perfectly across the repository.

### Core Tests Executed
```bash
pnpm --filter @everloom/core run test
```
- **Total Test Files**: 6 passed
- **Total Tests Passed**: 321 passed
- **Targeted Test Count**: 242 passed (`expedition-contract.test.ts` (73), `expedition-kernel.test.ts` (121), `expedition-adversarial.test.ts` (48))
- **Skipped Test Count**: 0 skipped

### Build & Typecheck Compilation
- `pnpm --filter @everloom/core run typecheck` — **exit 0**
- `pnpm --filter @everloom/core run build` — **exit 0**
- `pnpm typecheck` (root-level) — **exit 0**
- `pnpm build` (root-level) — **exit 0**

---

## State

- **GATE 6A FINAL BOUNDED-INVARIANT CORRECTION: COMPLETE**
- **GATE 6A ACCEPTANCE: PENDING INDEPENDENT SUPERVISOR RE-AUDIT**
- **FULL-HISTORY REPLAY: ABSENT**
- **GATE 4 BRANCH: UNTOUCHED**
- **GATE 5 BRANCH: UNTOUCHED**
- **RECEIPT/SAVE INTEGRATION: NOT STARTED**
- **RUNTIME/UI INTEGRATION: NOT STARTED**
- **MERGE: NOT PERFORMED**
