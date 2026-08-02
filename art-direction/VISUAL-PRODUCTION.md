# Everloom Visual Production Foundation

## Overview

The Visual Production Foundation is a comprehensive system for managing visual assets, their production status, and their integration into the game. It provides:

- **Semantic Asset Registry** (`packages/assets/src/registry.json`): Central source of truth for all 72 visual assets
- **Visual Production Manifest** (`art-direction/visual-production-manifest.json`): Production metadata for each asset (106 entries)
- **Automated Validation** (13 passing tests): Ensures semantic consistency and production completeness
- **Reference Sheet Tracking** (`art-direction/reference-sheets/reference-sheet-status.json`): Approval workflow for visual direction

## Asset Inventory

### By Category
- **Characters**: 8 (player, NPC, enemies)
- **Architecture**: 13 (cottages, fortifications, mills)
- **Vegetation**: 14 (trees, bushes, flowers)
- **Landmarks**: 12 (Loomstones, stone formations)
- **Props**: 26 (fences, barrels, carts, lanterns)
- **Interface**: 17 (inventory icons, markers, tooltips)
- **Equipment**: 2 (ground item variants)
- **Materials**: 5 (terrain, water, grass)
- **VFX**: 4 (impacts, pickups, water)

### By Production Priority
- **Vertical-Slice** (32 assets): Core Meadowrest gameplay features
  - Player character and appearances (5)
  - Equipment and tools (6)
  - NPCs and enemies (2)
  - Resource nodes and facilities (5)
  - Architecture and landmarks (8)
  - Interface elements (3)
  - Animations (2)

- **Phase-Two** (74 assets): Secondary content and expansions
  - Advanced player customizations
  - Secondary locations and structures
  - Additional resources and materials
  - Expanded NPC roster

## Validation System

### Running Verification

```bash
# Full foundation verification
pnpm --filter @everloom/game verify:visual-foundation

# Manifest validation only
pnpm --filter @everloom/game validate:visual-production

# Validation tests
pnpm --filter @everloom/game test:visual-production
```

### Test Coverage

**Manifest Validation (8 tests)**
1. Manifest structure (version, entries array)
2. No duplicate IDs
3. Valid semantic asset IDs
4. Required fields present
5. Valid status values
6. Vertical-slice entries have acceptance criteria
7. Approved-existing entries have license
8. No forbidden paths

**Integration Tests (5 tests)**
1. All Meadowrest scenery uses registered assets
2. All Meadowrest interactables use registered assets
3. Vertical-slice assets have production metadata
4. No circular or broken asset references
5. Asset production coverage tracking

## Asset Status Lifecycle

### Current Status (Asset Implementation)
- **approved-existing**: Used from licensed packs (KayKit, Kenney)
- **licensed-placeholder**: Composite from licensed components
- **procedural-placeholder**: Runtime-generated (custom code)
- **missing**: Not yet implemented
- **needs-audit**: Requires technical review

### Production Status (Artistic Development)
- **awaiting-reference**: Needs visual direction (reference sheet)
- **reference-approved**: Reference sheet approved by art director
- **modelling**: In production (concept → 3D model)
- **integrated**: Implemented in game
- **accepted**: Approved by QA and stakeholder

## Key Files

### Core Infrastructure
- `packages/assets/src/registry.json` — Semantic asset definitions (72 entries)
- `art-direction/visual-production-manifest.json` — Production metadata (106 entries)
- `packages/content/src/data/zones.json` — Zone definitions with asset references

### Validation Scripts
- `art-direction/scripts/validate-visual-production-manifest.mjs` — Manifest validator
- `art-direction/scripts/validate-visual-production-manifest.test.mjs` — Validation tests
- `art-direction/scripts/validate-visual-production-integration.test.mjs` — Integration tests
- `apps/game/scripts/verify-visual-foundation.mjs` — Complete foundation verification

### Reference Sheets
- `art-direction/reference-sheets/reference-sheet-status.json` — Approval tracking
- `art-direction/reference-sheets/everloom-0*.png` — Approved visual direction sheets

## Production Workflow

### 1. Asset Registration
- Asset added to `registry.json`
- Entry created in visual-production manifest
- Tests pass: no broken references, proper semantic IDs

### 2. Reference Sheet Submission
- Art direction provided as reference sheet PNG
- Uploaded to `art-direction/reference-sheets/`
- Status updated in `reference-sheet-status.json`

### 3. Art Review
- Reference sheet reviewed for:
  - Consistency with game style
  - Scale and proportions
  - Clarity of silhouette
  - Technical feasibility
- Status: `awaiting-submission` → `reference-approved` or `rejected`

### 4. Production
- Asset modeled/implemented based on reference
- Status: `reference-approved` → `modelling` → `integrated`

### 5. QA/Acceptance
- Asset tested in-game context
- Visual acceptance criteria verified
- Status: `integrated` → `accepted`

## Common Tasks

### Add a New Asset
1. Create entry in `registry.json` with ID, source file, category, license
2. Create manifest entry with production metadata
3. Add to zones.json if used in current gameplay
4. Run validation: `pnpm test:visual-production`

### Update Asset Status
1. Edit visual-production-manifest.json
2. Update `currentStatus`, `status`, or `productionPriority`
3. Run validation: `pnpm validate:visual-production`

### Submit Reference Sheet
1. Save approved PNG to `art-direction/reference-sheets/`
2. Update `reference-sheet-status.json` with metadata
3. Link manifest entries via `boardSection` field

### Review Production Progress
- Run `verify:visual-foundation` to see overall status
- Check manifest entries for incomplete metadata
- Review reference-sheet-status.json for pending approvals

## Expected Warnings

The system currently reports ~123 warnings, which are expected and not errors:

- **Unconfirmed scales** (80+): Will be confirmed during production phases
- **Missing reference sheets** (35+): Awaiting art director submissions
- **Placeholder assets** (8+): Procedural assets awaiting reference direction

**Zero critical errors** — Foundation is stable and production-ready.

## Next Phases

### Phase 6: Baseline Screenshots
- Capture deterministic game state screenshots
- Establish pixel-perfect baseline for regression detection

### Phase 7: Pixel Comparison Tool
- Build visual diff system
- Enable automated regression detection

### Phase 8: Visual Workbench
- Create in-game visual editing tools
- Real-time asset parameter adjustment

### Phase 9-11: Production Tools
- Asset production contracts generator
- Review queue and task tracker
- Task scheduling and assignment

### Phase 12+: Polish & Documentation
- Complete AGENTS.md integration
- Full command verification
- Production readiness checklist

## Architecture

The visual production system is built on:

1. **Semantic Registry**: Human-readable asset IDs (e.g., `player.adventurer`, `nature.oak`)
2. **Catalog Registry**: Technical asset paths (e.g., `catalog.kaykit.adventurers.character`)
3. **Manifest**: Production metadata layer binding semantic IDs to production status
4. **Zone Integration**: Assets linked to actual game content (zones, items, enemies)
5. **Automated Validation**: Semantic correctness checks and integration testing

This layered approach enables:
- Decoupling visual production from code
- Clear separation of concerns (semantics, technicality, production status)
- Comprehensive automated validation
- Reference sheet workflow integration
