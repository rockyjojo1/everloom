# Gate 6A: Deterministic Expedition Resolution Kernel — Independent Adversarial Audit

Date: 2026-08-05
Auditor: Jules
MonkeyCode Base SHA: `c8dc4f35f56316b01656cc21c74e963bb3ec493b`
Jules Rejected SHA: `8b0a329223b0c40b6fa08742f76ebaed7f7deade`
Branch: `jules/gate6a-adversarial-hardening-11945358711948676083`

## Overview

This document records the independent adversarial audit of the deterministic expedition resolution kernel, the test suite added to expose remaining integrity gaps, and the hardening measures implemented.

No UI or savegame integration was started, keeping the scope limited entirely to pure deterministic validation and the resolution contract.

---

## 1. Supervisor Rejection of first Jules Audit Pass (`8b0a329`)

The initial hardening solution in SHA `8b0a329` was rejected by the independent supervisor for two fundamental reasons:
1. **Simulation Overhead**: Re-running the entire deterministic chronological timeline via `simulateUpTo` from zero on every validation became increasingly expensive ($O(N)$ with total elapsed time), leading to quadratic total work over a long expedition or synchronous UI blocking on AFK logins.
2. **Starting State Forgery**: The validator derived/guessed starting state values from current values (e.g., `startingHealth = health + damageTaken`), which allowed a user to forge starting health, starting food, or starting inventory together and bypass verification because the validator would blindly infer a different starting state.

This corrective pass completely removes `simulateUpTo` and replaces it with an explicit initial-state snapshot and $O(1)$ bounded algebraic invariants.

---

## 2. Corrected Threat Model

Gate 6A is a pure deterministic resolver. Its validation contract is designed to detect:
- Malformed progress or corrupted schemas;
- Impossible numeric states;
- Inconsistent counters;
- Mismatched plan/progress IDs;
- Reward inconsistencies;
- Partial actions inconsistent with the next deterministic action;
- Accidental or partial save corruption;
- Invalid terminal states.

### Important Boundaries & Limitations:
Gate 6A **does not** provide cryptographic authenticity, server-authoritative anti-cheat, or protection against a user deliberately rewriting *every* mutually dependent field in a local save simultaneously. Coordinated local editing of the snapshot and all counters together cannot be prevented inside a pure local resolver. Enforcing total security against coordinated tampering requires trusted receipts or an authenticated/encrypted persistence mechanism, which is deferred to later Gates.

---

## 3. Explicit Initial-State Snapshot & Schema Version

To solve the starting state guessing vulnerability, we upgraded the progress schema version to `2` and added an immutable snapshot of the starting state directly into `DeterministicExpeditionProgress`:

```typescript
export interface DeterministicExpeditionProgress {
  // ... other fields
  readonly initialState: DeterministicExpeditionStartingState;
}
```

- `createDeterministicExpeditionProgress` clones the supplied `startingState` into this snapshot.
- Every later resolution preserves it completely unchanged.
- JSON serialization/parsing round-trips preserve it perfectly.
- Inconsistent current states or transitions relative to this snapshot are strictly rejected.

---

## 4. Bounded Algebraic Invariants implemented ($O(1)$)

Chronological replay has been entirely removed from the contract validator. Instead, the contract performs instant, $O(1)$ mathematical checks:

1. **Health**: Enforces that `currentHealth === Math.max(0, initialState.startingHealth - damageTaken)`. Rejects positive `damageTaken` if no encounters occurred.
2. **Food**: Enforces `foodConsumed <= initialState.availableFood` and `currentAvailableFood === initialState.availableFood - foodConsumed`. It also caps `foodConsumed` chronologically based on elapsed time: `foodConsumed <= Math.floor(elapsedResolvedMs / foodConsumptionIntervalMs)`.
3. **Inventory & Stack Transition**: Strictly asserts starting slot limits and monotonic stack transitions (new stack consumes exactly 1 slot, existing stack consumes no additional slot, stack cannot transition from true to false, stack cannot transition false to true if obtained resources is 0).
4. **Gathering Rewards**: Enforces resources obtained are divisible by `resourceQuantityPerGather`, and `resourceXpGained === completedGatherings * resourceXpPerGather` with safe overflow checks.
5. **Encounter Rewards**: Enforces `encountersWon + encountersLost === encounters` and `combatXpGained === encountersWon * combatXpPerWin`.
6. **Action-Sequence Accounting**: Enforces `nextActionSequence === completedGatherings + encounters`.
7. **Time Buckets**: Enforces `productiveGatheringMs + combatInterruptionMs === elapsedResolvedMs`.
8. **Current Partial Action**: When `partialAction` is present, it validates its sequence, start bounds, and derives the *single* next action kind using deterministic RNG helpers to check if it matches the current in-flight kind. This is a bounded $O(1)$ check and never loops over past actions.

---

## 5. Adversarial & Performance Tests Added

Our corrective pass preserves all necessary adversarial coverage while introducing new targeted checks:

### A. Health Forgery
- Rejects if current health is forged upward independently of `initialState` or `damageTaken`.
- Rejects if `damageTaken` is forged independently.
- Rejects positive `damageTaken` when `encounters` count is 0.

### B. Food Forgery
- Rejects if `availableFood` is forged independently.
- Rejects if `foodConsumed` is forged independently.
- Rejects if `foodConsumed` exceeds maximum possible chronological boundaries crossed.

### C. Inventory Transition Forgery
- Rejects if `inventoryUsedSlots` is modified independently.
- Rejects if `existingResourceStackPresent` is toggled or forged.
- Rejects stack transition false-to-true when obtained resources is 0.

### D. Snapshot Immutability
- Confirms modifying the caller's starting state object *after* progress creation has no effect on `progress.initialState`.
- Confirms repeated resolutions do not mutate the snapshot.
- Confirms JSON parse/serialize roundtrip preserves the snapshot.

### E. Action-Sequence Algebra & Transition Checks
- Proves sequence matches `completedGatherings + encounters` under mixed histories, food exhaustion inside combat, and short final windows.

### F. Performance Scaling Regression
- Statically parses `validateDeterministicExpeditionProgressAgainstPlan.toString()` to verify that there are **no loops (`for`, `while`)** or history-dependent simulator calls whatsoever in the production validator.
- Verifies that validation executes instantly on an accumulated progress of 3,600,000ms with 120 completed gatherings.

---

## 6. Verification & Final Test Counts

All tests pass perfectly across the repository.

### Core Tests Executed
```bash
pnpm --filter @everloom/core run test
```
- **Total Test Files**: 6 passed
- **Total Tests Passed**: 292 passed (73 contract, 121 kernel, 19 adversarial, 22 legacy core, 12 e2e, 45 core.test)
- **Targeted Test Count**: 213 passed (`expedition-contract.test.ts`, `expedition-kernel.test.ts`, `expedition-adversarial.test.ts`)
- **Skipped Test Count**: 0 skipped

### Build & Typecheck Compilation
- `pnpm --filter @everloom/core run typecheck` — **exit 0**
- `pnpm --filter @everloom/core run build` — **exit 0**
- `pnpm typecheck` (root-level) — **exit 0**
- `pnpm build` (root-level) — **exit 0**

---

## 7. Limitations & Reflection

- **Coordinated Editing**: Deferring cryptographic receipts and save integration to later Gates is appropriate, as Gate 6A's objective was explicitly a decoupled resolver.
- **Gate 4 Isolation**: Gate 4 branch was untouched.
- **Gate 5 Isolation**: Gate 5 files remain completely untouched.

---

## 8. Commit Confirmation

All changes are committed cleanly to:
`jules/gate6a-adversarial-hardening-11945358711948676083`

Final Status:
**GATE 6A ADVERSARIAL HARDENING CORRECTION: COMPLETE**
**GATE 6A ACCEPTANCE: PENDING INDEPENDENT SUPERVISOR RE-AUDIT**
**FULL-HISTORY VALIDATION REPLAY: REMOVED**
**GATE 4 BRANCH: UNTOUCHED**
**GATE 5 BRANCH: UNTOUCHED**
**RECEIPT/SAVE INTEGRATION: NOT STARTED**
**RUNTIME/UI INTEGRATION: NOT STARTED**
