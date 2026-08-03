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

The 2026-08-04 Gate 2 audit found the previous wording here — that
validation "substantially covers" naming, scale, origin, material count,
texture use, rig, animation clips and attachment points — **was too
strong**: most of those areas were not checked by any committed script at
all at that time. Gate 3 (`packages/assets/scripts/validate-models.mjs`,
`validate-sources.mjs`) closed the highest-value gaps. As of Gate 3,
committed, durable validation actually covers:

- **fully checked**: registry ID uniqueness; GLB/glTF container and JSON
  structural validity; scene/node/mesh presence; external buffer/texture
  companion existence within the canonical root; path-traversal rejection;
  exact-duplicate binary detection versus intentional semantic reuse;
  required-animation-clip presence for rigged assets with a declared
  requirement (`packages/assets/animation-requirements.json`); licence-field
  presence for every externally-sourced pack; manifest `currentAssetId` ↔
  registry consistency; manifest file-backed `currentSource` ↔ tracked-file
  consistency (including rejecting any path into a `dist` build-output
  directory); source-evidence record structure (evidence kind, commit
  resolution, path existence).
- **partially checked / metadata only, not a quality judgement**: material
  count, texture count, embedded-texture dimensions (decoded where the
  format is PNG/JPEG and the bytes are reachable), exact triangle counts
  (from accessor metadata, not visual inspection), joint counts. None of
  this is a claim about visual quality, art direction fit, or mobile
  performance.
- **still not checked by any committed script**: naming convention/pattern
  for registry IDs; object origin/pivot placement; texture *compression*
  format suitability; source URL reachability (no network calls are made);
  polygon/triangle *budget* enforcement (counts are reported, not capped);
  actual external licence-archive evidence (only local, repository-internal
  evidence is checked — see [`ASSET_SOURCES.md`](ASSET_SOURCES.md)).

`pnpm --filter @everloom/assets run verify` runs the durable technical and
source-evidence validators together with their test suites.
`pnpm --filter @everloom/game verify:visual-foundation` runs the
manifest/registry consistency checks alongside build and test stages.
Passing either proves what it directly checks — it does not by itself prove
any asset is finished production art, and it is not commercial-release
licence approval. See the baseline-pending distinction in
[`CURRENT_STATE.md`](CURRENT_STATE.md) and the full coverage matrix in
`docs/audits/2026-08-04-existing-asset-provenance/ASSET_PROVENANCE_AUDIT.md`
(historical, pre-Gate-3 baseline) and
`docs/audits/2026-08-04-canonical-asset-foundation/GATE3_IMPLEMENTATION_REPORT.md`
(current).

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
