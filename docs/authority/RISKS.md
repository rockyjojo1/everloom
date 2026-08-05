# Everloom Risks

Last reviewed: 2026-08-04

Governs: the standing risk register — what to watch for, and who to escalate
to. This file does not govern day-to-day task sequencing (see
[`CODEX_SUPERVISOR_CONTINUATION.md`](CODEX_SUPERVISOR_CONTINUATION.md) §4)
or settled decisions (see [`DECISIONS.md`](DECISIONS.md)).

Source authority:
[`CODEX_SUPERVISOR_CONTINUATION.md`](CODEX_SUPERVISOR_CONTINUATION.md) §8,
§10, §11. If current repository evidence contradicts this file, the
repository wins.

Related: [`CURRENT_STATE.md`](CURRENT_STATE.md) · [`DECISIONS.md`](DECISIONS.md) · [`TECHNICAL_ARCHITECTURE.md`](TECHNICAL_ARCHITECTURE.md)

Escalation owners: **Owner** (taste, playtesting, high-level approval) ·
**Codex/high-reasoning supervisor** (architecture, gate acceptance, runtime
verification) · **Strategy chat** (engine migration, monetisation,
multiplayer, economy, new skills, platform changes).

| Risk | Warning sign | Consequence | Mitigation | Escalation owner | Closure evidence |
|---|---|---|---|---|---|
| Weak-agent false completion | A model calls a feature "complete" from a build, test or file existing, without runtime evidence | Wasted supervisor time, false product confidence | Independent gate audit; translate "complete" into provable claims and test each one | Codex | Runtime-reachable proof matching the claim. Concrete precedent: Gate 4 (Meadowrest production room) went through three implementation attempts before acceptance-quality evidence existed — attempt 1 fabricated `METRICS.json` without a passing capture, attempt 2 silently substituted a required core placement and relaxed a hard-fail assertion, attempt 3 passed its own test suite but still shipped a Quality shadow policy that wrongly excluded all cliffs and grass clearance with partially hardcoded coordinates, caught only by independent re-audit deriving exact expected sets from the layout contract rather than trusting the implementation's own assertions |
| Test suite validates its own implementation's assumptions instead of the contract | New Playwright/Vitest assertions are written against whatever the implementation currently does, so a wrong exclusion rule (e.g. excluding `cliff-*` from shadows) passes its own tests | A gate can show 100% green tests while violating the actual requirement | Derive expected values from the underlying data contract (e.g. `getProductionRoomLayout`) inside the test, independently of the implementation's internal filtering logic, rather than asserting against hardcoded or implementation-mirrored constants | Codex | Exact-set assertions (e.g. Gate 4 `shadowCasterInstanceIds`) computed from the layout/content source of truth, not from a copy of the implementation's own filter list |
| Duplicate rewards | Reward application not protected by a stable checked receipt | Broken trust, corrupted progression | Receipt-based idempotency before runtime wiring (work package 7) | Codex | Duplicate-application, retry, crash and stale-copy tests pass |
| Save corruption | Migration changes a field shape without a tested fixture | Player progress lost | Explicit, additive, tested migrations only | Codex | Lossless fixtures across supported versions |
| Active/offline divergence | No differential test between active and resumed resolution | Players get different outcomes for the same elapsed time | Shared reducer, golden determinism and differential tests (work package 6) | Codex | One-shot/chunked and active/offline results match |
| Platform or iPhone failure | No physical-device evidence yet | Wrong engine bet on the primary platform | Physical bake-off before deep Verdant integration (work package 5) | Codex, Owner | Sustained FPS, memory and lifecycle evidence on a real device. Partial progress as of Gate 5A (`claude/capacitor-ios-bakeoff`): a committed, statically-verified Capacitor 8 iOS project now exists and syncs the authoritative build, closing the "no Capacitor project exists" gap — but physical-device evidence itself (the actual closure criterion) is still fully open; do not treat Gate 5A as closing this risk |
| Vercel deploying a legacy or incorrect app | Deployment succeeds without confirming project root/output maps to `apps/game` | Product evidence based on the wrong build | Confirm Vercel project settings explicitly before treating deployment as evidence | Codex | Verified deployed route matches `apps/game` output |
| Asset-provenance gaps | Licence/source fields missing or unverified in the registry/manifest | Legal exposure, rework when a source is later found unusable | Read-only provenance audit before any new downloads (work package 2); durable source-evidence validator (Gate 3) | Codex, Owner | Satisfied for the current 72-entry registry as of Gate 3 (`packages/assets/scripts/validate-sources.mjs`, 0 errors); re-opens automatically for any newly downloaded asset until it is registered with equivalent evidence |
| Placeholder sprawl | Placeholder assets described as final or left silently in production paths | Visual quality regresses unnoticed | Manifest tracks `currentStatus` explicitly; placeholders must be labelled, not hidden | Codex | Manifest shows no unlabelled placeholder in a shipped path |
| OSRS-expression overreach | New art/UI drifts toward RuneScape's protectable expression (see Section 15) | IP risk, forced rework | Reference sheets are direction only; reject drift at review | Owner, Strategy chat | Reviewed art judged sufficiently distinct |
| Infrastructure/dashboard sprawl | New reporting layers added without closing a demonstrated repeated failure | Token and time cost with no player-facing value | Only add tooling that prevents a proven repeated mistake | Codex | New tooling traces to a specific prevented failure |
| Cloud conflict | Two devices write concurrently with no revision check | Silent data loss or overwrite | Defer cloud expedition sync until local receipts are correct; add revision-aware writes later | Codex | Two-device stale-revision and failed-write recovery tests pass |
| Expanding content burden | New skills/regions/enemies proposed before the platform and core loop are proven | Effort spent on content that may need rework | Hold new content scope until work packages 6–9 accept | Codex, Strategy chat | Core loop and platform gates accepted first |
| Disconnected UI or dead components | A component exists with no runtime caller (e.g. `ExpeditionPanel` today) | False impression of progress | Trace runtime callers before crediting integration | Codex | Component reachable from a real user action in the running app |
| Build success mistaken for runtime proof | "It builds" or "tests pass" cited as proof of playability | False completion claims recur | Separate build/test/typecheck evidence from Gate 0 and browser/device evidence explicitly in every report | Codex | Claim matched to the specific check that proves it, nothing broader |
