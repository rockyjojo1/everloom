# Everloom Visual Production Foundation

## Master Art-Direction Reference

**File:** `everloom-00-master-art-bible.png`

| Property | Value |
|---|---|
| Dimensions | 2172 × 724 px |
| File size | 3,216,844 bytes |
| SHA-256 | `5D47A68E663E39B9236986D874A3F7DD0B49489241787DCE437B6878866E6DAE` |
| Type | Original AI-generated Everloom artwork |
| Authority | Binding visual direction |

### Purpose

This is the canonical visual reference for Everloom's art direction. It establishes:

- Low-poly fantasy aesthetic aligned with OSRS readability standards
- Strong silhouettes and compact character/object designs
- Warm ochre, meadow green, dark timber, and weathered stone color palette
- Loom motifs as distinctive visual signature
- Restrained 117 HD-style lighting and material treatment
- Clear interaction visibility from elevated three-quarter camera angle

### Constraints

**Small text, measurements, and numerical labels on this board are NOT authoritative.** They are compositional elements only and must not be treated as production specifications.

**Individual thumbnails and sections are NOT production assets.** Each approved section (player characters, equipment, architecture, etc.) requires a dedicated reference sheet that passes design review before implementation begins.

**This board must never be used as a texture atlas or direct source for model geometry.** It is a direction guide, not an asset source.

### Approval Process

- Approved **dedicated section reference sheets** override direction from the master board.
- All section sheets must pass visual review before implementation.
- Game assets must still satisfy licensing, scale, performance, and visual QA requirements.

### What Not to Do

- No pixel art.
- No voxel art.
- No glossy mobile-game appearance.
- No high-poly cinematic realism.
- No random primitive scattering for filler.
- No recoloured identical characters.

## Production Pipeline

### Documentation
- **[VISUAL-PRODUCTION.md](./VISUAL-PRODUCTION.md)** — Complete guide to asset status, verification, and tools
- **[production-contracts.json](./production-contracts.json)** — 10 vertical-slice contracts with acceptance criteria
- **[incoming-sheets-queue.json](./incoming-sheets-queue.json)** — Sections 11-20 tracking with team assignments
- **[visual-production-manifest.json](./visual-production-manifest.json)** — 106-entry semantic registry

### Current Status (2026-08-02)
- ✅ **Vertical-slice**: 32 assets approved and production-ready
- ✅ **Reference sheets** (01-10): All approved with checksum verification
- ✅ **Verification**: 0 errors, 0 blockers, ~119 informational warnings
- ⏳ **Phase-two**: 74 assets scoped with team assignments (Sep-Dec 2026)

### Quick Start

**View production workbench** (dev only):
```
http://localhost/?qa=visual-production
```

**Generate a production task**:
```bash
node scripts/generate-asset-task.mjs --asset-id player.base-body --format text
```

**Verify visual foundation**:
```bash
cd apps/game
pnpm run verify:visual-foundation
```

**Register a reference sheet**:
```bash
node scripts/register-reference-sheet.mjs --section 11 --file potions.png
```

### Asset Categories

**Approved-Existing** (64 entries)
- Player character rig and appearances
- Equipment and ground items
- NPCs and enemies
- Vegetation and resource nodes
- Architecture and landmarks
- Terrain and environmental materials

**Procedural** (23 entries)
- Shader-based effects
- Component-composed objects
- Runtime-generated visuals

**Licensed** (5 entries)
- External pack files (Kenney, KayKit)
- Awaiting delivery

**Missing** (13 entries)
- Scoped in contracts/queue
- Assigned to production teams

**Needs-Audit** (1 entry)
- Requires review before tasking

## Production Standards

### Geometry
- Low-poly models (1K-50K polygons typically)
- Strong silhouettes and clear readability
- Optimized for 60 FPS gameplay
- Proper UV layout and no overlapping UVs

### Materials
- sRGB color space
- PBR workflow (base color, normal, roughness)
- 2048×2048 textures typical for main assets
- No oversaturated colors

### Animations
- Smooth looping idle animations
- Action-specific poses for interaction
- Proper bone hierarchy and weight painting
- Frame rates: 24-30 FPS for smooth playback

### Acceptance Criteria
Every asset must satisfy 3-8 specific acceptance criteria defined in its production contract. Examples:
- Loads without errors in THREE.js
- UV mapping is correct with no stretching
- Matches reference sheet style and proportions
- No clipping with character body or environment
- All animations play smoothly and loop correctly

---

For detailed workflows, tool usage, and verification procedures, see **[VISUAL-PRODUCTION.md](./VISUAL-PRODUCTION.md)**.

