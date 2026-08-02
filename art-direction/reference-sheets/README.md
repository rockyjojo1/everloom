# Reference Sheet Intake System

## Filename Convention

Approved reference sheets must follow this exact naming format:

```
everloom-NN-section-name.png
```

Where `NN` is the section number (01–18) and the filename matches the table below.

| # | Filename | Purpose | Coverage |
|---|---|---|---|
| 01 | `everloom-01-core-gameplay-target.png` | Target visual for core gameplay loop | Player, NPCs, ground items, village center, Loom Hall |
| 02 | `everloom-02-player-characters.png` | Character body, hair, skin customization | Player body variations, head types, faces |
| 03 | `everloom-03-npcs.png` | Named NPCs and dialogue contacts | Mara, quest givers, merchants |
| 04 | `everloom-04-creatures.png` | Hostile and neutral creatures | Enemies, wildlife |
| 05 | `everloom-05-tools-weapons.png` | Handheld equipment and weapons | Worn Hatchet, Flint Axe, pickaxe, other tools |
| 06 | `everloom-06-equipment-clothing.png` | Wearable equipment and armor | Clothing, armor pieces, jewelry |
| 07 | `everloom-07-resource-nodes.png` | Harvestable resource nodes | Trees (all states), ore rocks, herbs |
| 08 | `everloom-08-architecture.png` | Buildings and structures | Loom Hall, cottages, storage sheds, walls, gates |
| 09 | `everloom-09-landmarks.png` | World landmarks and named locations | Ruins, monuments, signposts, bridges |
| 10 | `everloom-10-terrain-materials.png` | Ground materials and surface textures | Grass, dirt, stone, sand, water |
| 11 | `everloom-11-props.png` | Small interactable and decorative objects | Barrels, crates, baskets, furniture |
| 12 | `everloom-12-vegetation.png` | Plants, flowers, foliage | Bushes, flowers, vines, falling leaves |
| 13 | `everloom-13-animation-contact-sheet.png` | Animation cycles and states | Walk, run, swing, gather, idle, emotes |
| 14 | `everloom-14-vfx.png` | Visual effects and particles | Woodcutting impact, item pickup, effects |
| 15 | `everloom-15-interface.png` | UI elements and widgets | Icons, buttons, panels, tooltips |
| 16 | `everloom-16-inventory-icons.png` | Inventory and equipment icons | Item icons at game scale |
| 17 | `everloom-17-scale-chart.png` | Size relationships and scale reference | Character height, object scales relative to player |
| 18 | `everloom-18-do-dont-comparison.png` | Visual do/don't guidance | Approved vs. rejected directions |

## Intake Process

See `reference-sheet-status.json` for the current status of all expected sheets.

Use the `register-reference-sheet.mjs` script to intake and validate incoming sheets:

```bash
node art-direction/scripts/register-reference-sheet.mjs <section-number> <source-image-path>
```

**Important:** A reference sheet must pass **visual review** before it is marked as approved. Received ≠ approved.

## Image Format Requirements

- **Format:** PNG, WebP, or JPEG
- **No modifications or re-encoding** during intake
- **Checksum verification** prevents accidental duplicates or corruption
- **Dimensions** are captured for consistency tracking

## Review Checklist

Before approving a reference sheet:

1. Does it match the section's intended coverage?
2. Does it respect the master art-direction board?
3. Are silhouettes clear and distinct?
4. Are colors within the established palette?
5. Is scale consistent with the scale chart?
6. Are no copyrighted assets included?
7. Are file sizes reasonable?
8. Can approved assets be produced from this reference?

