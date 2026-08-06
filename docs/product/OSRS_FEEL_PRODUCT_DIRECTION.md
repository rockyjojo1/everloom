# Everloom — OSRS-Feel Product Direction

Binding direction for `apps/game`. Everloom is an original RPG; OSRS is a
behavioural/pacing/interface-structure reference only — no Jagex assets,
maps, text, audio, or code.

## Camera
- Elevated three-quarter, near-fixed offset from the player (no orbiting).
- Minimal follow smoothing (imperceptible lag only) — no cinematic drift,
  no bob, no dramatic zoom, no aggressive depth of field.
- Tuned by screenshot at 852×393 and 1440×900, not by reading constants.

## Movement
- Click/tap-to-move on the existing deterministic grid pathfinder.
- Constant speed, no acceleration/deceleration/inertia, no post-arrival
  sliding. Turning is instant/near-instant toward the next path segment.
- A new tap immediately cancels and replaces the active route and any
  pending arrival callback — never finishes the old route first.

## Interaction grammar
- Default action per target type: ground → Walk here, tree → Chop,
  rock → Mine, fishing spot → Fish, ground item → Take, NPC → Talk-to,
  storage → Open, enemy → Attack.
- Every target has a legal, reachable interaction cell; the player routes
  there, stops, faces the target, and only then does the action begin.
  No remote/instant interaction.
- Long-press (~450ms, with movement tolerance) opens a compact original
  context menu with real target/item names, positioned near the press and
  clamped inside the viewport.

## Action timing
- Gathering (woodcutting/mining/fishing) and pickup share one lifecycle:
  route → arrive → face → wind-up/animation → reward at the intended
  action event → chat + XP feedback → recover → repeat while valid.
- Rewards are never granted on tap, during travel, before facing, or after
  cancellation. Ground items stay visible through travel and disappear
  together with the inventory update at the pickup event (~350–650ms after
  arrival), not at initial tap.

## Animation
- Restrained, slightly mechanical: fast start/stop, little blending, no
  exaggerated secondary motion.

## World scale
- Compact opening Meadowrest slice: most useful interactions 2–8 seconds'
  walk apart. Concentrate value near spawn rather than expanding emptiness.

## UI structure
- Compact classic-fantasy client: opaque stone/timber/parchment panels —
  no glass blur, no semi-transparent floating cards, no oversized touch
  controls, no permanent joystick.
- Minimap (top corner), side tabs (inventory/skills/quests/settings),
  bottom chat/activity log, world overlay (XP drops, restrained
  destination marker, no giant guidance beam).

## Feedback
- Concise chat messages for gathering, pickup, missing tool, full
  inventory, dialogue, and levels. XP drops appear only at real reward
  time, tied to actual XP-gained events — never fabricated.

## Mobile
- 852×393 primary viewport: world stays dominant, safe-area aware, no
  page scroll, touch-first controls, context menu stays on-screen.

## Prohibited generic mobile-RPG patterns
- Giant objective beams/guidance lasers, glowing route trails, oversized
  floating labels, huge reward particle bursts, glassmorphism panels,
  pill-shaped mobile controls, mandatory joysticks.

## Acceptance
See task section 31 for the full matrix; the short version: an OSRS
player should recognise the click-to-move, walk-to-interact, cadence-based
gathering, and physical pickup grammar within five seconds of ordinary play.
