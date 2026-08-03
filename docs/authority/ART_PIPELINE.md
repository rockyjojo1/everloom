# Everloom Art Pipeline

Last reviewed: 2026-08-04

Governs: the intended production art pipeline and how reference material
relates to runtime assets. This file does not govern asset sourcing rules or
provenance record-keeping (see [`ASSET_SOURCES.md`](ASSET_SOURCES.md)).

Source authority:
[`CODEX_SUPERVISOR_CONTINUATION.md`](CODEX_SUPERVISOR_CONTINUATION.md) §2
("Art state"), §4 ("Asset pipeline"), plus
`art-direction/visual-production-manifest.json` and
`art-direction/reference-sheets/reference-sheet-status.json`. If current
repository evidence contradicts this file, the repository wins.

Related: [`ASSET_SOURCES.md`](ASSET_SOURCES.md) · [`PRODUCT.md`](PRODUCT.md) · `art-direction/visual-production-manifest.json`

## Pipeline direction

- Blender source files, exported to GLB/glTF, are the intended runtime asset
  pipeline.
- Generic environment assets may use approved-existing or verified CC0
  assets (see [`ASSET_SOURCES.md`](ASSET_SOURCES.md) for the source
  hierarchy).
- Signature assets (anything central to Everloom's own identity, not a
  generic environment filler) need custom or substantially transformed work,
  not a reused generic asset presented as final.

## What reference material is, and is not

- Generated reference images are **concepts**, not runtime assets.
- A reference sheet being `received`/`approved` in
  `reference-sheet-status.json` does not prove a model, texture, rig or
  animation exists in the runtime. It proves the *direction* is approved.
- Section 15 (`everloom-15-interface.png`) is **deprecated as an
  implementation reference** — `reviewStatus: needs-revision` — because it
  moved too close to RuneScape's complete UI expression. See
  [`PRODUCT.md`](PRODUCT.md).

## Validation coverage

Asset validation (existing scripts under `art-direction/scripts/` and
`packages/assets/scripts/`) should cover, and does substantially cover today:

- naming;
- scale;
- origin/provenance;
- material count;
- texture use;
- rig;
- animation clips;
- attachment points;
- provenance and licence fields.

`pnpm --filter @everloom/game verify:visual-foundation` runs this validation
alongside build and test stages. Passing it proves the manifest and registry
are internally consistent — it does not by itself prove any asset is
finished production art. See the baseline-pending distinction in
[`CURRENT_STATE.md`](CURRENT_STATE.md).

## Sourcing constraint

Do not introduce paid or unclear-licence production sources without owner
and strategy approval. See [`ASSET_SOURCES.md`](ASSET_SOURCES.md) for the
approved hierarchy and required provenance fields.

## Tooling scope

The asset browser, the visual-production manifest and the validation
scripts exist to **support** production (find an asset, check its status,
catch a broken reference). They do not themselves constitute production
art, and expanding them further is not a substitute for producing assets.
See [`RISKS.md`](RISKS.md) — infrastructure/dashboard sprawl.
