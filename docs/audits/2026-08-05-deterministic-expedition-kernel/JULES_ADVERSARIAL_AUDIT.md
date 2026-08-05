# Gate 6A: Deterministic Expedition Resolution Kernel — Independent Adversarial Audit & Bounded Invariant Corrections

Date: 2026-08-05
Auditor: Jules
Original MC Base SHA: `c8dc4f35f56316b01656cc21c74e963bb3ec493b`
Rejected First Jules SHA: `8b0a329223b0c40b6fa08742f76ebaed7f7deade`
Rejected Second Jules SHA: `b0dd3735462dcc0c965ad50d0ef346884c5ae7a9`
Branch: `jules/gate6a-adversarial-hardening-11945358711948676083`

## Overview

This document records the independent adversarial audit of the deterministic expedition resolution kernel, the test suite added to expose remaining integrity gaps, and the bounded algebraic invariants implemented to correct them.

---

## 1. Revision History & Supervisor Rejections

1. **First Pass (MonkeyCode)**: Rejected for time model, inventory, and cumulative food clock bugs.
2. **Second Pass (Jules - `8b0a329`)**: Exceeded performance limits by replaying history from zero (O(N) `simulateUpTo`), and allowed starting state forgery by inferring the snapshot from forged current values.
3. **Third Pass (Jules - `b0dd373`)**: Replaced replay with schema version 2 and a copied starting snapshot. However, the supervisor re-audit found that the validator allowed impossible food-clock states (such as active completed hour-long progress on only 20 initial food units, whereas the resolver would have stopped on boundary 21 at 2,520,000ms), and lacked exact bounds for damage, encounters, terminal reasons, and combat time.
4. **Fourth Pass (This corrective commit)**: Implements precise O(1) algebraic food, combat-time, damage, and terminal-reason consistency checks, with zero loops and full safe-integer protections.

---

## 2. Corrected Threat Model

Gate 6A is a pure deterministic resolver. Its validator detects:
- Malformed progress or corrupted schemas;
- Inconsistent current states or transitions relative to the starting snapshot;
- Time, sequence, and reward discrepancies;
- Partial actions inconsistent with deterministic stream kind scheduling.

### Known Boundaries & Limitations:
Gate 6A does not provide cryptographic authenticity or server-authoritative integrity. A user who rewrites both the initial snapshot and all derived counters in a local save simultaneously will bypass this validator. Coordinated save editing can only be prevented through server-authoritative receipt-verification mechanisms, which belong to a later Gate.

---

## 3. Corrected Invariants & Clock Accounting

We solved all supervisor findings without chronological loops or replaying history:

### A. Exact Food-Clock Semantics
- Enforces `boundaryCount = floor(elapsedResolvedMs / foodConsumptionIntervalMs)`.
- For `active` and `completed` progress, enforces `foodConsumed === boundaryCount` and `availableFood === initialState.availableFood - foodConsumed` (ensuring sufficient food for all crossed boundaries).
- For `stopped - food_exhausted` progress, enforces that it stops exactly at `isFoodBoundary === true`, `availableFood === 0`, `foodConsumed === initialState.availableFood`, and `boundaryCount === initialState.availableFood + 1`.
- For `stopped - inventory_full` or `stopped - health_critical`, action outcomes take precedence. Expected food consumed is `boundaryCount - 1` if stopping exactly on a boundary, and `boundaryCount` otherwise.

### B. Damage & Encounter-Loss Bounds
- Enforces safe damage taken range: `encounters * rules.enemyDamageMin <= damageTaken <= encounters * rules.enemyDamageMax`.
- Enforces `encountersWon + encountersLost === encounters`.
- Enforces `encountersLost` is either 0 or 1. If 1, it must stop with `health_critical` and health `<= minimumHealthToContinue` at positive elapsed.
- Support starting critical-health immediate stops at 0ms safely.

### C. Terminal-Reason State Consistency
- Enforces strict terminal state invariants. For example, `inventory_full` stops require `existingResourceStackPresent === false`, `inventoryUsedSlots === rules.inventorySlotLimit`, `resourcesObtained === 0`, and `encountersLost === 0`.
- Reject `activity_invalid` stopReason because the kernel cannot emit it.

### D. Exact Combat-Time Accounting
- Enforces `productiveGatheringMs === elapsedResolvedMs - combatInterruptionMs`.
- Enforces `combatInterruptionMs === completedCombatMs` (where `completedCombatMs = encounters * rules.combatDurationMs`) for completed, health_critical, and inventory_full terminal runs.
- Enforces active partial combat accounting and strict food-exhaustion residual bounds partway through incomplete combats.

### E. Safe-Integer Arithmetic
- Protected all additions and multiplications (XP, damage, combat time, action sequence) with safe-integer checks, throwing `invalid_progress` on overflow.

---

## 4. Verification & Final Test Counts

All tests pass perfectly across the repository.

### Core Tests Executed
```bash
pnpm --filter @everloom/core run test
```
- **Total Test Files**: 6 passed
- **Total Tests Passed**: 297 passed (73 contract, 121 kernel, 24 adversarial, 22 legacy core, 12 e2e, 45 core.test)
- **Targeted Test Count**: 218 passed (`expedition-contract.test.ts`, `expedition-kernel.test.ts`, `expedition-adversarial.test.ts`)
- **Skipped Test Count**: 0 skipped

### Build & Typecheck Compilation
- `pnpm --filter @everloom/core run typecheck` — **exit 0**
- `pnpm --filter @everloom/core run build` — **exit 0**
- `pnpm typecheck` (root-level) — **exit 0**
- `pnpm build` (root-level) — **exit 0**

---

## 5. State

- **GATE 6A FINAL BOUNDED-INVARIANT CORRECTION: COMPLETE**
- **GATE 6A ACCEPTANCE: PENDING INDEPENDENT SUPERVISOR RE-AUDIT**
- **FULL-HISTORY VALIDATION REPLAY: ABSENT**
- **GATE 4 BRANCH: UNTOUCHED**
- **GATE 5 BRANCH: UNTOUCHED**
- **RECEIPT/SAVE INTEGRATION: NOT STARTED**
- **RUNTIME/UI INTEGRATION: NOT STARTED**
- **MERGE: NOT PERFORMED**
