# Art Direction Agent Guidelines

This document defines durable rules for work in the Everloom visual production foundation.

## Master Authority

- **Master art-direction board** (`everloom-00-master-art-bible.png`): Binding visual reference. Establishes low-poly fantasy aesthetic, color palette, silhouettes, and tone.
- **Approved section reference sheets** (when received and approved): Override master board for specific asset categories.
- Haiku must never invent art direction absent explicit approval from the master or section sheets.

## Asset Production Rules

1. **No primitives for production assets.** Do not substitute Three.js boxes, spheres, cylinders, cones, or other procedural primitives for approved reference-sheet artwork. Primitives are placeholders only.

2. **Distinct silhouettes required.** Every asset must have a clear, recognizable silhouette. Do not call recoloured or slightly-scaled versions of the same mesh "distinct silhouettes."

3. **Reference sheets define scope.** Every visual implementation task must name exact manifest IDs it addresses. If a reference sheet has not been approved for those IDs, the task cannot proceed to implementation.

4. **No false claims of visual completion.** Do not claim visual slice completion or asset acceptance without:
   - Running `verify:visual-foundation` (pass)
   - Running `verify:gate0` (pass)
   - Running `pnpm test` and `pnpm typecheck` (pass, full suite)
   - Comparing or creating baseline screenshots matching the shot-manifest

5. **Never overwrite historical screenshots.** Do not rewrite, delete, or regenerate screenshots already in `artifacts/`. Use the `EVERLOOM_UPDATE_VISUAL_BASELINE=1` flag if updating baselines requires explicit intent.

6. **Temporary paths forbidden.** Do not commit manifest entries containing Windows `\Temp\` paths, `AppData`, or other temporary file locations.

7. **Approved assets only.** Every asset in the production manifest must either:
   - Be currently integrated and passing tests, OR
   - Have an approved dedicated reference sheet (status = `reference-approved`), OR
   - Be listed in the acceptance criteria for an in-progress reference sheet with explicit approval

8. **Reports do not substitute for implementation.** A summary document, checklist, or report is not a substitute for actual runtime asset integration and screenshot verification. Every asset must be testable in the live game.

## Verification Commands

**Before any commit:**

```bash
pnpm --filter @everloom/game verify:visual-foundation
pnpm --filter @everloom/game verify:gate0
```

These must both exit 0. Failure blocks merge.

**Full verification chain:**

```bash
pnpm --filter @everloom/game validate:visual-production
pnpm --filter @everloom/game verify:visual-foundation
pnpm --filter @everloom/game verify:gate0
pnpm test
pnpm typecheck
pnpm build
```

## Reference Sheet Intake

Reference sheets are registered via:

```bash
node art-direction/scripts/register-reference-sheet.mjs <section-number> <source-image-path>
```

**Review before approval:**

1. Does it respect the master art-direction board?
2. Are silhouettes distinct and readable?
3. Are colors within the palette (warm ochre, meadow green, dark timber, weathered stone)?
4. Are proportions consistent with the scale chart?
5. Are no copyrighted assets (Jagex, RuneLite, OSRS) included?

Once approved (status = `reference-approved`), assets can be implemented.

## Haiku-Specific Rules

- Never skip the `verify:visual-foundation` or `verify:gate0` commands.
- If a verification step fails, fix the regression before committing.
- Do not weaken, disable, or skip Gate 0 tests under any circumstance.
- Do not manually edit or delete `artifacts/meadowrest-visual-baseline-gate0/*` screenshots.
- Do not approve reference sheets automatically; always require human review.
- Never claim "visual slice complete" without both visual-foundation and gate0 verification passing.

