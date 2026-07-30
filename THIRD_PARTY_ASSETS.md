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
