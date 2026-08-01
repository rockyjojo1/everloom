# Everloom Third-Party Assets

Recorded: 30 July 2026

Source files remain intact under `apps/client3d/public/models`. The production game references them through semantic IDs in `packages/assets/src/registry.json`. Runtime material normalisation, scale, orientation, and tint do not overwrite the source files.

## KayKit Character Pack: Adventurers

- Creator: Kay Lousberg
- Source: https://kaylousberg.itch.io/kaykit
- Licence: Creative Commons Zero v1.0 Universal (CC0-1.0)
- Project use: player character and starter NPC; selected Idle, Walking, interaction, attack, hit, and death clips
- Local directory: `kaykit-adventurers`

## KayKit Character Pack: Skeletons

- Creator: Kay Lousberg
- Source: https://kaylousberg.itch.io/kaykit-skeletons
- Licence: Creative Commons Zero v1.0 Universal (CC0-1.0)
- Project use: starter skeleton enemy and selected combat animations
- Local directory: `kaykit-skeletons`

## KayKit Dungeon Pack Remastered

- Creator: Kay Lousberg
- Source: https://kaylousberg.itch.io/kaykit-dungeon-remastered
- Licence: Creative Commons Zero v1.0 Universal (CC0-1.0)
- Project use: crates, barrels, and selected town/quarry scenery
- Local directory: `kaykit-dungeon`

## Kenney Fantasy Town Kit

- Creator: Kenney
- Source: https://kenney.nl/assets/fantasy-town-kit
- Licence: Creative Commons Zero v1.0 Universal (CC0-1.0)
- Project use: modular Meadowrest buildings, market scenery, watermill
- Local directory: `kenney-fantasy`

## Kenney Nature Kit

- Creator: Kenney
- Source: https://kenney.nl/assets/nature-kit
- Licence: Creative Commons Zero v1.0 Universal (CC0-1.0)
- Project use: trees, rocks, foliage, bridge, campfire, and Loomstone base geometry
- Local directory: `kenney-nature`

## Everloom-original geometry

The installed external packs do not contain suitable standalone models for every starter tool. The worn hatchet, worn pickaxe, worn fishing rod, starter sword, destination marker, fishing ripples, resource stump, and interaction highlights are original low-poly geometry constructed by the production client. They are not copied from another game and are identified with `procedural://` registry paths rather than being misrepresented as third-party files.

The Smithing tutorial (Phase Five) adds three more original, code-generated meshes for the same reason: no forge, anvil, or battleaxe model exists in any installed pack. The Meadowrest Smelter (`custom.facility-smelter`) is a compact quarry-stone block with a short chimney and a restrained warm emissive mouth. The Anvil (`custom.facility-anvil`) is a worked-iron block with a tapered horn on a timber stump base, reusing the tool handles' wood material but with a distinct higher-metalness/lower-roughness material for the iron. The Copper Battleaxe (`custom.weapon-battleaxe`) is a deliberately different silhouette from the starter sword — a short haft topped by a broad double-bladed copper head — rather than a reskin of the sword geometry.

The visual-identity pass adds one more original mesh: the Boneguard Vest (`custom.armor-boneguard-vest`) is a layered chest plate with a cross strap and two shoulder pauldrons in bleached bone tones, built from primitive geometry and attached to the character's chest bone. It replaces a prior content bug where this item's `worldAssetId` pointed at `enemy.skeleton-warrior` (a full enemy character model) and rendered nothing when equipped, since the equipment-visual system never read the `body` slot at all. The same pass also gives Mara Threadkeeper, the tutorial guide NPC, an original cloth hood/shawl silhouette (`custom.npc-mara-shawl`) built from cone and torus primitives so she reads as a distinct named character rather than a recolour of the shared player rig.
