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
- Authoritative asset package: `packages/assets`, which now also owns the
  canonical tracked binary model library at `packages/assets/models` (moved
  there from `apps/client3d/public/models` in the Gate 3
  canonical-asset-foundation pass — see
  `docs/audits/2026-08-04-canonical-asset-foundation/GATE3_IMPLEMENTATION_REPORT.md`).
  `apps/game` and `apps/client3d` both consume this root through a shared
  path contract (`packages/assets/paths.mjs`); neither app owns a private
  copy.
- `apps/client3d`, `apps/web`, `packages/engine` and `packages/gamedata` exist,
  build, and may still contain reusable ideas or assets, but they are legacy
  or alternate paths, not implementation authority. Do not merge them
  wholesale. As of Gate 3, `apps/client3d` no longer owns any binary asset
  data of its own — it consumes the authoritative package's model root, the
  same as `apps/game`.
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

## Gate 3: canonical asset foundation (built on top of Gate 2 `8b812f8`)

- `packages/assets/models` is now the sole canonical tracked binary model
  root (569 files, migrated with `git mv` — 100% Git rename detection, every
  file's SHA-256 and byte size verified identical before/after).
- `apps/game/vite.config.ts` and `apps/client3d/vite.config.ts` both import
  `MODEL_ROOT` from `packages/assets/paths.mjs`; neither hardcodes its own
  model path any more.
- `art-direction/visual-production-manifest.json`'s file-backed
  `currentSource`/`currentSourceCanonical` fields no longer point at the
  gitignored `apps/client3d/dist/models` build-output path (previously
  Blocker B1) or the legacy `apps/client3d/public/models` source path
  (previously Blocker B2); they point at the committed
  `packages/assets/models/...` tree. No `currentStatus`, priority, role,
  scale, or acceptance-criteria field was changed.
- `pnpm --filter @everloom/game verify:visual-foundation`'s source-path
  validation stage now passes on a genuinely fresh worktree, before
  `apps/client3d` has ever been built — this was independently proven in a
  disposable worktree; see the Gate 3 report for the exact commands and
  output.
- Durable, committed Node-only validators now exist for GLB/glTF structure,
  geometry/rig/animation metadata, required-animation-clip presence,
  duplicate-vs-semantic-reuse binary detection, and source/licence evidence
  structure (`packages/assets/scripts/validate-models.mjs`,
  `validate-sources.mjs`), with 65 passing unit/integration tests. None of
  this constitutes commercial-release legal approval.
- Full detail, exact commands, and fresh-worktree proof:
  `docs/audits/2026-08-04-canonical-asset-foundation/GATE3_IMPLEMENTATION_REPORT.md`
  and the accompanying `VERIFICATION_LOG.md`.

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
