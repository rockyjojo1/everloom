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
- The next gate after this authority spine (work package 2 in
  [`CODEX_SUPERVISOR_CONTINUATION.md`](CODEX_SUPERVISOR_CONTINUATION.md) §4)
  is a **read-only audit** of existing assets and provenance.
- No new downloads should occur before that audit is accepted.
- Raw asset packs must not be blindly committed.
