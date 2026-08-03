# Everloom Current State

Last reviewed: 2026-08-04

Governs: verified repository facts only — what exists, what runs, what has not
been proven. This file does not govern product decisions (see
[`PRODUCT.md`](PRODUCT.md)) or architecture rationale (see
[`TECHNICAL_ARCHITECTURE.md`](TECHNICAL_ARCHITECTURE.md)).

Source authority: direct repository inspection, plus
[`CODEX_SUPERVISOR_CONTINUATION.md`](CODEX_SUPERVISOR_CONTINUATION.md) §1–2. If
current repository evidence contradicts this file, the repository wins and
this file must be corrected.

Related: [`PRODUCT.md`](PRODUCT.md) · [`TECHNICAL_ARCHITECTURE.md`](TECHNICAL_ARCHITECTURE.md) · [`RISKS.md`](RISKS.md) · [`VERDANT_GROVE.md`](VERDANT_GROVE.md)

## Verified facts

- Repository: `rockyjojo1/everloom`.
- Authoritative application: `apps/game` (React + Three.js browser/PWA client).
- Authoritative domain package: `packages/core`.
- Authoritative content package: `packages/content`.
- Authoritative asset package: `packages/assets`.
- `apps/client3d`, `apps/web`, `packages/engine` and `packages/gamedata` exist,
  build, and may still contain reusable ideas or assets, but they are legacy
  or alternate paths, not implementation authority. Do not merge them
  wholesale.
- Save version: 6 (`packages/core/src/types.ts`, `SAVE_VERSION`).
- Local persistence is IndexedDB via `idb`, through
  `apps/game/src/game/saveDb.ts`, called from the `apps/game` store
  (`apps/game/src/game/store.ts`).
- Optional Supabase cloud code exists (`apps/game/src/cloud/cloud.ts`,
  `apps/game/src/components/CloudAccount.tsx`). Only a root
  `.env.example` with placeholder values is present in this checkout; no live
  cloud configuration was verified here. `uploadCloudSave` performs an
  `upsert` keyed on `user_id,slot` with a stored `revision` field, but there
  is no read-before-write conflict check — cross-device conflict handling and
  stale-revision safety are unverified.

## Verdant Grove reality

- Verdant Grove is a domain prototype. It is **not runtime reachable**.
- `ExpeditionPanel` (`apps/game/src/components/ExpeditionPanel.tsx`) exists
  but is not imported or rendered anywhere in `apps/game/src` — confirmed by
  reading `App.tsx`, which mounts `GameWorld`, `Hud`, `EscapeIntro`,
  `OfflineReport`, `DebugPanel`, `AssetBrowser`, `CloudAccount`,
  `VisualQAGallery` and `VisualProductionWorkbench`, and nothing else.
- The Ironbark world object does not launch an expedition workflow.
- No Verdant Playwright browser flow exists.
- No physical iPhone test exists.
- No Capacitor proof exists.
- Full detail: [`VERDANT_GROVE.md`](VERDANT_GROVE.md).

## Verified commands at `a53e752`

At commit `a53e75201b6d1a60890d3a5adfa50e6f57548945`:

- Root build (`pnpm build`) passed — 8/8 workspace packages.
- `pnpm --filter @everloom/core test`: 79/79 passed.
- `pnpm --filter @everloom/game verify:gate0`: passed all five stages.
- `pnpm --filter @everloom/game verify:visual-foundation`: all 15 core stages
  passed. Visual baselines remained **PENDING, 0/10 captured** — this is a
  fixed status line the verifier reports, not a computed count; treat it as
  "baseline capture has not started," not as partial progress.
- Visual-foundation warnings (asset scale/licence/reference gaps) remain
  unresolved and must not be described as completed production art.
- GitHub commit status for `a53e752` was successful; Vercel reported a
  completed deployment. Deployment success does **not** by itself prove the
  deployed route serves the authoritative `apps/game` build — Vercel
  project root/output settings have not been independently confirmed.

None of the above proves Verdant Grove, or any specific player-facing
feature, is complete or runtime reachable. A passing build or test proves
only what it directly exercises.

## Superseded / non-authoritative for current state

- `docs/VERDANT_GROVE_HANDOFF.md` — detailed historical implementation
  handoff; superseded as the concise status source by this file and
  `VERDANT_GROVE.md`, but retained for implementation history.
- `docs/VERDANT_GROVE_VERTICAL_SLICE.md` — detailed target contract and
  corrected implementation history; still authoritative for engine-level
  requirement detail, not for a one-page status read.
- `docs/VERDANT_GROVE_STATUS.md` — narrow machine-readable Verdant status
  flags; still authoritative for its specific fields, referenced by
  `VERDANT_GROVE.md`.
