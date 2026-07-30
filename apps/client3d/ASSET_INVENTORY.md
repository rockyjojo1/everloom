# Asset Inventory — VERIFIED PRESENT ON DISK

Installed by the supervisor (not the implementing model) after asset downloads
blocked P0/P1 twice. **All present and counted — do not re-download.** All CC0.

| Folder | Size | Files | Contents |
|---|---|---|---|
| `kaykit-adventurers/` | 3.5 MB | 1 | `Character.glb` — rigged Knight, **76 animation clips** (see ANIMATION_CLIPS.md) |
| `kaykit-skeletons/` | 19 MB | 31 | 4 rigged enemies + `props/` weapon attachments |
| `kaykit-dungeon/` | 2.4 MB | 40 | curated mine/dungeon props (walls, floors, torches, barrels, crates, chests, doors, stairs, pillars) |
| `kenney-nature/` | 3.7 MB | 329 | trees, rocks, plants, bridges, terrain pieces + `Textures/` |
| `kenney-fantasy/` | 2.9 MB | 168 | modular town: walls, roofs, doors, windows, market stalls + `Textures/` |
| **TOTAL** | **32 MB** | **569** | |

## Enemy models (Training Grounds — 4 of the 5 planned)
- `kaykit-skeletons/Skeleton_Minion.glb` → **Skeleton** (lv2)
- `kaykit-skeletons/Skeleton_Rogue.glb` → **Skeleton Archer** (lv5)
- `kaykit-skeletons/Skeleton_Warrior.glb` → **Armoured Skeleton** (lv9)
- `kaykit-skeletons/Skeleton_Mage.glb` → **Skeleton Mage** (lv14)
- **Boss (the Unravelled King, lv20)**: reuse `Skeleton_Warrior.glb` scaled ~1.4×
  with a dark-tinted material + a KayKit dungeon banner behind him. No 5th model
  needed for v1.

## Notes for the implementing model
- Prefer `.glb` (self-contained). Kenney nature ships `.glb` in the same folder;
  textures are alongside in `Textures/` if a model references them externally.
- Kenney town kit is **modular** — buildings are assembled from wall/roof/door
  pieces, not single-file houses. Compose 4-6 cottages in `worlddata.ts` as
  groups of piece placements; do not look for a `house.glb`, it doesn't exist.
- Trees for Loomwood: `tree_blocks*`, `tree_cone*`, `tree_default*`,
  `tree_oak*`, `tree_pineDefault*`, `tree_tall*` variants in kenney-nature.
- Rocks for Burrow Mine: `rock_*`, `stone_*` in kenney-nature; ore-coloured
  material tint distinguishes copper/tin/iron rather than separate models.
- Licences: recorded in CREDITS.md. All CC0 (KayKit = Kay Lousberg,
  Kenney = Kenney.nl). Nothing here needs attribution legally, but keep it.
