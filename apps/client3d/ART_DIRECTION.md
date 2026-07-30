# ART DIRECTION — analysed from the owner's reference screenshot

The owner supplied an Idle Journey screenshot as the visual target. This is the
authority on look-and-feel. Where it contradicts earlier guidance in
PROJECT_REBOOT_3D.md or PLAYBOOK.md, **this file wins**.

---

## What the reference actually shows (observed, not guessed)

**Camera** — much further out and steeper than previously specced:
- Perspective (roof top faces AND side walls both visible), yaw ~45°.
- Pitch ~55-60° down. Distance such that roughly 60-70 world units of ground are
  visible across the frame.
- The player character occupies only about **4-5% of frame height** — small, with
  the world as the subject. My earlier "character should be 1/3 of frame" was
  WRONG. Pull back.

**Terrain — the single biggest gap in our build**
- The world is an **island with real elevation**: cliff faces, stepped rock
  ledges, raised plateaus, a shoreline dropping into deep water.
- Our current terrain is a **flat plane**. Flat will never look like this.
  Elevation is the highest-value visual upgrade available to us.
- Grey **rock formations are used as terrain framing everywhere** — they outline
  the island edge, line the paths, and break up the grass. Very dense.

**Palette — saturated and warm, NOT muted**
- Grass: vivid, slightly yellow-leaning green.
- Trees: **rust / burnt-orange autumn canopies**, clustered in groups.
- Rock: neutral mid-grey, chunky and rounded.
- Water: deep teal, flat surface, lighter where it meets the shore.
- Earlier direction said "muted OSRS earth tones". That was wrong for this
  target. Saturate.

**Shading**
- Smooth-shaded low-poly. Do **not** use `flatShading: true`. Soft, even light,
  minimal harsh shadow. Slight ambient occlusion feel from the dense props.

**Props / density**
- Far denser than our current placement. Trees in clusters of 3-6, rocks in
  runs along edges, wooden decking, plank bridges, stairs/ladders as連 connectors
  between elevation levels.
- Buildings: chunky thatched roofs (roof is visually ~50% of the building mass),
  timber frames, plank platforms, some built out over water on stilts.

**Characters**
- Small, chunky, simple. Bright solid-colour tunics (blue, green) that read
  clearly at that tiny size. Our KayKit adventurers fit fine.

**Interaction feedback**
- Fishing spot shown as **white concentric ripple rings** on the water plus a
  visible fishing line from the player, with a small progress bar floating above.

---

## UI layout (copy this structure — it is well solved)

Everything hugs the **edges**; the world owns the centre. Nothing full-screen.

- **Top-right**: circular minimap showing the island silhouette.
- **Top-right, left of the minimap**: a vertical stack of round skill/status orbs —
  e.g. `Lv.18` with a fish icon, `Lv.6`, and a red `25 HP` orb. Shows the
  currently-relevant skills, not all of them.
- **Bottom-right**: a horizontal row of ~8 framed square icon buttons (bag,
  inventory, map, quests/book, mail, stats, achievements, settings).
- **Bottom-left**: a **chat/event log** with tabs (`All` / `System` / `Chat`),
  timestamped coloured lines. This is important: the **offline-return summary
  appears inline here**, e.g.
  `[16:24:29] Welcome back! 58 kills at Fishing spot Lv. 10 over 17m 10s.`
  and level-ups in orange: `[16:24:33] Fishing leveled up! (16 -> 18)`.
  We should adopt this — an event log is cheaper and more readable than a modal,
  and it doubles as the "while you were away" delivery.
- A small timer/badge cluster bottom-centre-right.

Implication for our plan: keep the bottom sheet for inventory/skills, but ADD a
persistent bottom-left event log. Route toasts, XP milestones, level-ups, offline
summaries and tool warnings through it.

---

## Concrete changes to make (in priority order)

1. **Camera**: pitch 55°, distance ~26, FOV 45. Character small in frame.
2. **Terrain elevation**: replace the flat plane with a heightfield. Add a
   `HEIGHT` painting layer to worlddata (same rect/circle/path primitives,
   painting a height value), sample it for vertex Y, and make the nav grid block
   cells whose slope exceeds a threshold. Cliffs then emerge naturally.
3. **Palette**: saturate the surface colours (see values below).
4. **Autumn trees**: Kenney nature ships `_fall` variants which are exactly the
   rust canopies in the reference. Use them as the dominant tree:
   `tree_oak_fall.glb`, `tree_default_fall.glb`, `tree_detailed_fall.glb`,
   `tree_fat_fall.glb`, `tree_blocks_fall.glb`, `tree_cone_fall.glb`.
   Keep a few green ones for variety.
5. **Rock density**: line the map edge, path sides and elevation changes with
   `rock_large*` / `rock_small*` runs. Aim for 120+ rocks, not 16.
6. **Event log UI** (bottom-left) as described above.
7. Smooth shading; no `flatShading`.

### Revised surface palette (saturated)
```
grass      0x7ab648
darkgrass  0x5c9438
dirt       0x9c7a4a
cobble     0x9a958a
stone      0x8a8680
water      0x1d6b82   (deep, with a lighter shore band)
```

---

## Honest scope note for the reviewer

The reference is a shipped commercial product with bespoke modelled terrain. We
can get **close** in feel — same camera language, same density, same palette,
same UI structure — using CC0 kits plus a heightfield. We will not match its
bespoke island sculpting in v1, and we should not pretend otherwise. Elevation +
density + palette + camera gets us most of the perceived distance.
