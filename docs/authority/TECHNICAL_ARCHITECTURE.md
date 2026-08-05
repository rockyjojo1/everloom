# Everloom Technical Architecture

Last reviewed: 2026-08-04

Governs: the current conditional technology stack and the boundaries between
packages. This file does not govern the Verdant Grove resolver redesign in
detail (see [`VERDANT_GROVE.md`](VERDANT_GROVE.md)) or current implementation
status (see [`CURRENT_STATE.md`](CURRENT_STATE.md)).

Source authority:
[`CODEX_SUPERVISOR_CONTINUATION.md`](CODEX_SUPERVISOR_CONTINUATION.md) §3–4,
§8. If current repository evidence contradicts this file, the repository
wins.

Related: [`CURRENT_STATE.md`](CURRENT_STATE.md) · [`VERDANT_GROVE.md`](VERDANT_GROVE.md) · [`RISKS.md`](RISKS.md)

## Current conditional stack

TypeScript, React, Three.js, Vitest, Playwright, IndexedDB/PWA
(`apps/game`).

This stack is **conditional**, not final. It stays only while it keeps
passing the bake-off gates below.

## Package boundaries

- `packages/core` owns deterministic domain rules and versioned save-domain
  logic. It must stay free of React, Three.js, DOM and browser-storage
  concerns.
- `packages/content` owns authored content definitions and their schema
  validation.
- `packages/assets` owns runtime asset IDs, provenance metadata, the asset
  registry, and (as of Gate 3) the canonical tracked binary model library at
  `packages/assets/models`. Both `apps/game` and the legacy `apps/client3d`
  consume this root through the shared path contract
  `packages/assets/paths.mjs` — neither app owns a private copy.
- `apps/game` owns presentation, input, browser lifecycle and local
  persistence, and consumes the three packages above.

## Deterministic domain requirements

- Active and offline resolution must use the same reducer or command
  semantics — one deterministic domain model, not two parallel
  implementations.
- Ambient time and random calls (`Date.now()`, `Math.random()`) must not
  determine gameplay outcomes.
- Save migrations must be explicit and tested against real old-version
  fixtures.
- Production-safe receipt/idempotency semantics must exist before any
  Verdant runtime integration.
- Cross-device cloud conflict design is deferred until local deterministic
  resolution and receipts are correct (see
  [`RISKS.md`](RISKS.md) — cloud conflict).

## Platform wrapper status

- Capacitor is the **proposed** iPhone wrapper. As of Gate 5A
  (`claude/capacitor-ios-bakeoff`, base SHA
  `26f36e73b15a1c1e782ec3e4b8890c13ad53194a`), a Capacitor 8.5.0 iOS
  project exists, is committed, statically verified, and syncs the exact
  same `apps/game` Vite build the browser/PWA targets use. This is
  foundation-level evidence only: **no physical iPhone build has been
  attempted**, and the iOS Simulator compile itself is CI-dependent (no
  macOS available in the implementing environment). "Capacitor project
  exists" and "physical iPhone build exists" remain two separate, distinct
  claims — see `docs/audits/2026-08-05-capacitor-ios-bakeoff/GATE5A_IMPLEMENTATION_REPORT.md`
  for exactly which is and isn't proven.
- Godot/GDScript is a **strategy-level fallback only**, to be evaluated
  solely if the physical-device bake-off finds a structural blocker in the
  current stack. Do not begin a Godot migration pre-emptively.

## Evidence required before reconsidering the stack

Do not migrate engines based on preference or hypothetical concerns. The
following evidence must exist and point to a structural blocker first:

- a representative browser/mobile room, built with production-representative
  assets — **satisfied at the browser/mobile-emulation level**, see Gate 4 below;
- touch input and app lifecycle proof — **not yet proven on a real device**; Gate 5A only proves the native shell builds and syncs correctly, not that touch/lifecycle behave correctly on iOS;
- a physical iPhone build — **not started**;
- measured performance and memory over a real session — **not started**;
- observed background/resume behaviour — **not started**;
- a demonstrated structural blocker, not a stylistic preference.

## Gate 4 browser bake-off status (branch `claude/meadowrest-production-room-bakeoff`)

The first evidence item above — a representative browser/mobile room built
with production-representative assets — has browser/mobile-emulation
evidence at implementation SHA `64359ce4d146804e28e30b5e5919bba63af9a0c2`:
60 FPS across Balanced/Quality × desktop/iPhone-landscape emulation, 0
asset/instance failures, exact placement-level readiness (Balanced 70/70/0,
Quality 86/86/0), and a contractually-exact shadow-caster policy per
profile. This is **not** the physical-iPhone evidence required above —
that remains not started. See
`docs/audits/2026-08-04-meadowrest-production-room/GATE4_BAKEOFF_REPORT.md`.

## Gate 5A Capacitor iOS foundation status (branch `claude/capacitor-ios-bakeoff`)

Builds directly on the Gate 4 evidence above by adding a native iOS shell
around the same `apps/game` build. See "Platform wrapper status" above
for the precise, narrow claim this gate makes, and
`docs/audits/2026-08-05-capacitor-ios-bakeoff/GATE5A_IMPLEMENTATION_REPORT.md`
for full detail.
