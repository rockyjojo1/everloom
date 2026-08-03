# Everloom Asset Sources

Last reviewed: 2026-08-04

Governs: approved asset-source hierarchy and the provenance fields every
asset record must carry. This file does not govern pipeline steps or
validation coverage (see [`ART_PIPELINE.md`](ART_PIPELINE.md)).

Source authority:
[`CODEX_SUPERVISOR_CONTINUATION.md`](CODEX_SUPERVISOR_CONTINUATION.md) §2,
§4 ("Asset pipeline"), work package 2, plus `packages/assets/src/registry.json`
and `art-direction/visual-production-manifest.json`. If current repository
evidence contradicts this file, the repository wins.

Related: [`ART_PIPELINE.md`](ART_PIPELINE.md) · [`RISKS.md`](RISKS.md) · `packages/assets/src/registry.json` · `art-direction/visual-production-manifest.json`

## Approved source hierarchy

1. Existing approved project assets already in the repository.
2. Official CC0 sources (for example Kenney, KayKit).
3. Recognised humanoid rig/animation sources with verified terms.
4. Individually verified marketplace assets.
5. AI-generated 3D — concepts or prototypes only, unless commercial rights
   and cleanup requirements are explicitly proven for that specific model.
6. Paid assets or specialist commissions — only with owner and strategy
   approval.

Do not skip ahead in this hierarchy because a lower tier is faster.

## Minimum provenance fields

Every asset record (registry entry or manifest entry) should carry:

- source ID;
- asset or pack name;
- creator;
- official source page;
- licence;
- licence evidence;
- retrieval date;
- file/archive hash, where available;
- local path;
- runtime asset ID;
- modification summary;
- intended use;
- production status.

`packages/assets/src/registry.json` currently carries most of these fields
per entry (`id`, `sourceFile`, `pack`, `category`, `licence`, `sourceUrl`,
`notes`); it does not currently carry retrieval date or file hash for every
entry.

## Current truth about existing coverage

- Not every existing asset licence was independently reverified during the
  supervisor handoff.
- The current manifest and registry licence records are **evidence to
  audit**, not automatically final proof.
- The read-only provenance audit (work package 2) and the canonical-asset
  foundation pass (work package 3-equivalent) are both complete — see the
  Gate 2 and Gate 3 findings sections below for what each established.
- No new downloads have occurred since the Gate 2 audit; none are approved
  by this file.
- Raw asset packs must not be blindly committed.

## Verified Gate 2 findings

Audited commit: `22d2ffc002b0b3bbed988e8d698bd00c265f0b98` — Date: 2026-08-04

Detailed audit:
[`docs/audits/2026-08-04-existing-asset-provenance/ASSET_PROVENANCE_AUDIT.md`](../audits/2026-08-04-existing-asset-provenance/ASSET_PROVENANCE_AUDIT.md)
Source registry: [`packages/assets/sources/asset-sources.json`](../../packages/assets/sources/asset-sources.json)

- **8 source-pack records** established: `kaykit-adventurers`,
  `kaykit-dungeon`, `kaykit-skeletons`, `kenney-fantasy`, `kenney-nature`,
  `everloom-original`, `everloom-composite`, `lpc-legacy-sprites`.
- Evidence-status counts: **7 of 8 sources `verified_local_evidence`**
  (covering all 72 authoritative registry entries — markdown-claim evidence
  in `apps/client3d/CREDITS.md`/`ASSET_INVENTORY.md`/`ANIMATION_CLIPS.md`,
  corroborated by independently measured file counts, byte sizes and
  animation-clip counts, not an archive-embedded licence file); **1 source
  `repository_claim_only`** (`lpc-legacy-sprites`, the legacy `apps/web` 2D
  pipeline, 0 registry entries). **0 sources `missing` or `conflicting`.**
- Confirmed canonical source roots: all binary GLB/glTF assets the
  authoritative registry references live under
  `apps/client3d/public/models` — a **legacy app's** `public/` directory.
  `packages/assets` itself holds no binaries; `apps/game/public` holds none
  either. `apps/game`'s runtime depends on `apps/client3d/public/models` via
  a custom Vite plugin (`sharedModelLibrary` in `apps/game/vite.config.ts`).
  This dependency is real, currently working, and **not yet corrected** —
  see the audit's Blocker B2.
- Unresolved evidence categories: no archive-embedded licence file exists
  for any external pack (evidence is corroborated markdown claims, not
  original-download proof); `apps/web`'s legacy sprite licences were
  recorded but not independently verified; 523 installed files in the
  canonical model root have no runtime registry entry at all (available for
  future use at no new download cost).
- **This is not commercial-release legal approval.** It establishes that
  local, internally-consistent evidence exists and matches on-disk reality;
  it does not constitute an independent legal licence audit against the
  original external sources.
- **Correction**: [`ART_PIPELINE.md`](ART_PIPELINE.md)'s claim that current
  validation "substantially covers" naming, scale, origin, material count,
  texture use, rig, animation clips and attachment points is **too strong**
  — the audit's validator coverage matrix found most of these areas are not
  checked by any committed script at all. See the audit report for the full
  matrix; `ART_PIPELINE.md` itself was not edited by this pass.
- **Next gate recommendation**: the minimal asset-access workflow (work
  package 3) may begin, conditional on accounting for the audit's two
  Blocker findings (the gitignored `apps/client3d/dist` manifest-path
  dependency, and the legacy-root runtime dependency above) rather than
  building new tooling on the current inconsistent path assumptions.

This Gate 2 section is preserved as a historical record of what was true at
that audit. It is superseded by the Gate 3 findings below, which record the
current state — do not treat the Blocker findings above as still open; see
Gate 3 status.

## Verified Gate 3 findings (canonical asset foundation)

Detailed report:
[`docs/audits/2026-08-04-canonical-asset-foundation/GATE3_IMPLEMENTATION_REPORT.md`](../audits/2026-08-04-canonical-asset-foundation/GATE3_IMPLEMENTATION_REPORT.md)

- **Blocker B1 (gitignored `apps/client3d/dist` manifest-path dependency):
  CLOSED.** All 107 previously-`dist`/legacy-pointing manifest
  `currentSource`/`currentSourceCanonical` fields now point at the committed
  `packages/assets/models/...` tree. No `currentStatus`, priority, role,
  scale, or acceptance-criteria field changed. See the Gate 3 report for the
  fresh-worktree proof that `verify:visual-foundation`'s source-path stage
  now passes before `apps/client3d` has ever been built in that worktree.
- **Blocker B2 (legacy-root runtime dependency): CLOSED.** The canonical
  tracked binary model library moved from `apps/client3d/public/models` to
  `packages/assets/models` (`git mv`, 569 files, 100% rename detection,
  every file's SHA-256 and byte size verified identical before/after — see
  the Gate 3 report's migration-integrity proof). `apps/game` and
  `apps/client3d` both now resolve the model root through one shared
  contract, `packages/assets/paths.mjs`; neither hardcodes a path to the
  other.
- **Source-evidence schema normalised** (`packages/assets/sources/asset-sources.json`
  `schemaVersion: 2`): `licenceEvidence` is now structured records
  (`{kind, path|commit, detail}`) instead of prose strings mixed with paths;
  a `mirrorSourceUrl` field distinguishes an official source page from a
  separately-documented mirror (used for the three KayKit packs). Evidence
  status classifications are **unchanged from Gate 2** — no source was
  upgraded to a stronger evidence tier by this schema change alone.
- **Durable, committed technical validation added**:
  `packages/assets/scripts/validate-models.mjs` (GLB/glTF structure,
  geometry/texture/rig/animation metadata, required-clip enforcement,
  duplicate-vs-semantic-reuse detection) and `validate-sources.mjs`
  (source-evidence structure, commit resolution, manifest consistency), both
  with real failure-fixture test coverage (65 tests total across
  `packages/assets`). See [`ART_PIPELINE.md`](ART_PIPELINE.md)'s corrected
  coverage description.
- **Asset inspection CLI added**: `pnpm --filter @everloom/assets run
  inspect -- <query>` — one command surfaces registry, source-evidence,
  manifest-status, file, and GLB-metadata detail for a runtime asset ID
  without manually cross-referencing multiple files.
- **This remains not commercial-release legal approval.** Evidence-status
  classifications, the no-wolf finding, and every other Gate 2 provenance
  caveat are preserved unchanged — Gate 3 fixed structural/tooling
  problems, not licence-evidence strength.
- **Next gate recommendation**: with the canonical root settled and durable
  validation in place, the minimal asset-access workflow / production-room
  bake-off (work packages 3–4) may proceed on this foundation.
