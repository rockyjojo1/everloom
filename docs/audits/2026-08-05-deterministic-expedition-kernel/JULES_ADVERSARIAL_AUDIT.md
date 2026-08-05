# Gate 6A: Deterministic Expedition Resolution Kernel — Independent Adversarial Audit & Bounded Invariant Corrections

Date: 2026-08-05
Auditor: Jules
Original MC Base SHA: `c8dc4f35f56316b01656cc21c74e963bb3ec493b`
Rejected Starting Corrective Pass 4 SHA: `5ae8627d1ac74b645cb635452cdb8a00a104ba84`
Branch: `jules/gate6a-adversarial-hardening-11945358711948676083`

## Overview

This document records the independent adversarial audit of the deterministic expedition resolution kernel, the test suite added to expose remaining integrity gaps, and the bounded algebraic invariants implemented to correct them.

---

## 1. Revision History & Supervisor Rejections

1. **First Pass (MonkeyCode)**: Rejected for time model, inventory, and cumulative food clock bugs.
2. **Second Pass (Jules - `8b0a329`)**: Exceeded performance limits by replaying history from zero (O(N) `simulateUpTo`), and allowed starting state forgery by inferring the snapshot from forged current values.
3. **Third Pass (Jules - `b0dd373`)**: Replaced replay with schema version 2 and a copied starting snapshot. However, the supervisor re-audit found that the validator allowed impossible food-clock states, and lacked exact bounds for damage, encounters, terminal reasons, and combat time.
4. **Fourth Pass (Corrected in `5ae8627`)**: Implemented precise O(1) algebraic food, combat-time, damage, and terminal-reason consistency checks, with zero loops and full safe-integer protections.
5. **Fifth Pass (This corrective commit)**: Solves the remaining active progress missing-partial action and completed/food-exhausted shortened final gathering defects. It enforces the exact O(1) active/completed/stopped action-time accounting models cleanly without chronological loops or replaying history.

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

### A. Exact Active Action-Time Accounting
We enforce:
`productiveGatheringMs === completedGatherings * rules.gatheringWindowMs + partialGatheringMs`
`combatInterruptionMs === encounters * rules.combatDurationMs + partialCombatMs`
- Active progress with elapsed action time but no `partialAction` is rejected.
- Active progress with no `partialAction` is valid only at an exact completed action boundary.
- A partial gathering cannot assign its elapsed time to combat.
- A partial encounter cannot assign its elapsed time to gathering.
- `elapsedResolvedMs` is the exact sum of both buckets.

### B. Completed and Health-Critical Gathering Time
- For legimate `health_critical` stopped progress at positive elapsed:
  - `productiveGatheringMs === completedGatherings * rules.gatheringWindowMs` (no partial or short gatherings).
- For `completed` progress:
  - Nominal gathering is `nominalGatheringMs = completedGatherings * rules.gatheringWindowMs`.
  - Enforce `actualGatheringMs === nominalGatheringMs` (all full), OR exactly one final gathering was shortened at `requestedDurationMs` of type gathering (deficit is < `gatheringWindowMs`, and deterministic kind scheduled at its start timestamp is indeed gathering).
  - Reject actual exceeds nominal, multiple shortened gatherings, shortened gathering before plan end, or a deterministic final encounter represented as a shortened gathering.

### C. Food Exhausted Progress
- If before plan end: enforce all completed gatherings are full duration plus `residualGatheringMs`.
- If at plan end: enforce `residualCombatMs === 0`, `residualGatheringMs === 0`, and use completed progress all-full-or-one-short-final rule.

---

## 4. Verification & Final Test Counts

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

## 5. State

- **GATE 6A FINAL BOUNDED-INVARIANT CORRECTION: COMPLETE**
- **GATE 6A ACCEPTANCE: PENDING INDEPENDENT SUPERVISOR RE-AUDIT**
- **FULL-HISTORY VALIDATION REPLAY: ABSENT**
- **GATE 4 BRANCH: UNTOUCHED**
- **GATE 5 BRANCH: UNTOUCHED**
- **RECEIPT/SAVE INTEGRATION: NOT STARTED**
- **RUNTIME/UI INTEGRATION: NOT STARTED**
- **MERGE: NOT PERFORMED**
