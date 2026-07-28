# EVERLOOM

**A cloud-saved idle RPG. Design document and agent build plan, v3.**

Working title: **Everloom**. Trading hub: **the Loomhall Exchange** ("the Exchange"). All naming lives in `config/branding.ts` so it can be swapped in one place.

This document is the constitution. Any agent that wants to deviate from it must raise the conflict, not silently resolve it.

---

# PART 0 — LOCKED DECISIONS

## 0.1 Platform: PWA now, Capacitor later

Build target is a **Vite + React + TypeScript web app**, installable as a PWA on iOS via Add to Home Screen.

Do **not** build in React Native. When an App Store listing is wanted later, **Capacitor** wraps this exact codebase into a native iOS shell with near-zero rewrite. React Native would mean discarding the web build.

- Hosting: Vercel hobby tier. Data, auth, functions: Supabase free tier. Cost today: $0.
- Later cost, only for an App Store icon: $99/yr Apple Developer. Nothing else changes.
- iOS 16.4+ supports web push for PWAs **only once installed to the home screen**. The "your satchel is full" notification is a core retention loop, so the install prompt is a first-session onboarding beat, not a settings toggle.

## 0.2 Architecture: server-authoritative, delta-computed, deterministic

There is no game loop running on a server. The game is a **pure function**:

```
state_now = resolve(state_at_checkpoint, action, elapsedSeconds, seed)
```

- The client runs `resolve()` locally each frame for instant, smooth feedback.
- The server runs the **identical** `resolve()` in a Supabase Edge Function whenever the player commits (action change, sell, bank, login, every 60s heartbeat).
- Server output is truth. Client reconciles silently. Divergence beyond tolerance is logged.
- `resolve()` lives in a **shared package** (`packages/engine`) imported by both the web client and the Deno edge functions. Written once, zero drift. **This is the most important rule in the project.**
- Randomness: deterministic PRNG (splitmix32) seeded by `hash(player_seed, action_id, tick_index)`. Same inputs, same outputs, forever. Offline progress is therefore not estimated, it is exact, and any player's entire history can be replayed server-side for verification.
- **All game maths uses integers.** XP, damage, quantities are ints; rates are fixed-point. A float summed in a different order on Deno versus Safari's V8 will silently desync client and server. Non-negotiable.

## 0.3 Anti-cheat

- Supabase RLS. Players read only their own row.
- **The client has no write permission on `player_state`.** All mutations go through edge functions using the service role.
- Server recomputes from `checkpoint_at` and clamps `elapsed` against wall clock.
- Optimistic locking via a `version` column. Idempotency keys on every commit so a flaky mobile connection cannot double-apply.
- Divergences log to `cheat_events`. No auto-ban in v1, just observation.

## 0.4 Death modes

| Mode | Penalty | Availability |
|---|---|---|
| **Cozy** | Lose unbanked gathering yield only. Gear and bank untouched. | Character creation |
| **Standard** | Lose unbanked yield **plus one random inventory item**, weighted toward low value, single highest-value item protected. | Default |
| **Ironbound** | Permanent. Character locks and becomes a read-only trophy with final stats displayed on your account. | Character creation, irreversible, P4+ |

The `mode` enum ships in the schema from day one even though Ironbound arrives later.

## 0.5 Offline cap: none

Progress is capped by inventory fill and by death, nothing else. Late game this genuinely means weeks. Two guardrails:

- **Death is resolved across the entire offline window.** If your armour and Larder would have failed at hour 6 of a 300-hour absence, you died at hour 6 and the remainder is forfeit. This is the tension that makes Smithing and Cooking matter.
- The **Return Report** (see 4.7) turns any absence into a story rather than a diff.

## 0.6 Food: the Larder

Food does **not** occupy the inventory grid. It lives in a dedicated Larder outside it.

- Larder capacity is a function of Cooking level: 20 portions at level 1, thousands at 99.
- Cooked food auto-routes to the Larder. **Raw fish takes normal inventory slots**, so Fishing is still inventory-capped and Cooking is the release valve.
- Foods have distinct heal values and a **freshness** decay over very long AFK windows. Higher Cooking levels slow decay. This gives Cooking a permanent late-game purpose instead of being solved at level 40.

## 0.7 Zones and Danger

Every gathering node lives in a zone. Every zone carries:

```
danger: 0-100        // ambient threat pressure
richness: multiplier // yield and xp bonus
```

**Meadowrest is danger 0.** New players cannot die, cannot be attacked, and are never punished in the first session. Every zone after trades danger for richness. Choosing to mine in a danger 40 zone is a real decision about whether your armour and Larder cover the AFK window you want.

Ambient threat is **pressure, not a fight**: periodic chip damage on a timer, scaled by `danger`, mitigated by Defence rating, healed automatically from the Larder. Slayer is the opt-in version where you hunt the things deliberately.

**Every zone displays estimated survival time with your current gear and Larder before you commit.** Never let a player die to a number they could not see.

## 0.8 Monetisation: none, built clean

No IAP. But every item carries `tradeable` and `base_value`, every currency sink is designed as though inflation matters, and item creation and destruction is audited in `item_ledger`. If the game ever opens up, the economy is not already broken.

## 0.9 Multiplayer: solo v1, wired for one world

v1 is solo. The schema and engine assume a shared world:

- The Exchange is built as a full **offer book** (place an offer at a price, partial fills, collection box). In v1 it is filled by a **synthetic market maker** with algorithmic prices that drift on supply. Real player offers slot into the identical interface later with no client changes.
- Global chat is a Supabase Realtime channel, built and disabled behind a feature flag.
- **Do not build real player-to-player trading in v1.** A live economy is a full-time balance job. The market maker gives 90% of the feel for 5% of the work.

---

# PART 1 — ART DIRECTION

## 1.1 The concept: the world is a tapestry

Everloom is not "Stardew but OSRS". The visual identity is **a world woven on a loom**.

The land is a tapestry. Zones are panels of it. Unexplored zones are **unwoven**: blank undyed linen with faint chalk stitch-guides showing the shape of what will be there. Unlocking a zone plays a **weave-in**: the panel stitches itself into existence, row by row, over about two seconds. Death frays and unravels threads at the edge of the frame. The final zone, the Loomheart, is where the tapestry is being woven from.

This single idea does four jobs at once: it gives a visual identity nobody else has, it justifies a deliberately small world (one panel per zone), it makes zone unlocks a genuinely memorable moment, and it ties the Loom, Patterns and Weaving mechanics into the fiction rather than bolting them on.

## 1.2 Palette: natural dyes

Historical natural-dye colours. Muted, warm, earthy, unmistakably not candy-coloured.

| Name | Hex | Use |
|---|---|---|
| Undyed Linen | `#E8DCC4` | canvas, panels, unwoven zones |
| Walnut | `#4A3728` | UI chrome, outlines, text on light |
| Madder | `#A63A32` | danger, health, primary accent |
| Woad | `#3C5A73` | water, cold zones, secondary accent |
| Weld | `#D9A441` | gold, XP, highlights, rewards |
| Lichen | `#5E7350` | foliage, nature, safe states |
| Iron Gall | `#1E2430` | night, deep zones, modal scrim |

**Explicitly avoid** the current AI-design default of cream background plus high-contrast serif plus `#D97757` terracotta. Avoid pure black and pure white anywhere. Everything sits on linen or on iron gall, never on `#FFF` or `#000`.

## 1.3 Texture: the stitch

Every sprite and every panel carries a subtle woven texture.

- Base grid: **32x32 sprites**, nearest-neighbour scaling, integer scale factors only (2x, 3x, 4x). Never fractional, it destroys pixel art.
- A repeating 4x4 linen-weave texture overlays the entire canvas at 6 to 10% opacity.
- Sprite edges use a 1px darker outline in a colour sampled from the sprite, not black.
- Dithering for gradients, never smooth blends.

## 1.4 Typography

| Role | Face | Notes |
|---|---|---|
| Display | **Jacquard 24** (Google Fonts) | Named after the Jacquard loom, reads as woven grid characters. Zone names, level-up banners, boss names. Never below 24px, never for body. |
| UI / numerals | **Silkscreen** (Google Fonts) | Tight and crisp, for stats, counters, buttons. |
| Body | **Pixelify Sans** (Google Fonts) | 16px minimum. Item descriptions, Return Report prose, dialogue. |

All three are free and open-licensed. Type sits on the pixel grid: font sizes are multiples of the base unit so glyphs never land on half-pixels.

## 1.5 UI chrome: canvas and thread, not wood panels

Deliberately **not** OSRS's brown wooden interface, because that is the RSPS tell.

- Panels are linen-textured with a **stitched border**: a dashed running-stitch line in walnut, with a slightly frayed corner detail.
- Buttons look like **wooden toggle buttons on a coat**, chunky, with a 2px offset shadow that reduces to 1px on press.
- Progress bars are **threads filling a channel**, with a visible needle-head at the leading edge.
- Inventory slots are **pockets in a satchel**, not a grid of squares. The satchel is drawn, and its sprite visibly changes as you upgrade it.
- Skill icons are embroidered patches.
- Gain numbers stitch into the air and fade by unravelling.

## 1.6 Character and world sprites

- Character: roughly 3 heads tall, chunky readable silhouette, 4-direction walk cycle, 8 frames. Equipment visibly layered: helm, body, legs, weapon, **and satchel**.
- Nodes have ambient idle animation always (trees sway, water ripples, ore glints on a slow timer). A static world reads as broken in a game where the player stares at one screen for minutes.
- Ambient enemies wander in from the frame edge with a distinct silhouette per zone.

## 1.7 Asset pipeline

- **All game logic references `sprite_id`, never a file path.** A single `assets/sprites.json` manifest maps `sprite_id -> {atlas, x, y, w, h}`.
- Phase 1 ships a **generated placeholder atlas**: flat palette-coloured 32x32 tiles with item initials. Ugly, functional, zero blockers. Built by `tools/sprite-gen` directly from the items JSON.
- Phase 2 drops in **Kenney.nl CC0** packs (Roguelike/RPG, Tiny Dungeon) and **LPC** (CC-BY-SA) characters, recoloured to the dye palette. Keep a `CREDITS.md`.
- **Never block on art.** Missing sprite renders the placeholder and logs to `missing_sprites.json`.

## 1.8 Motion

Motion appears in exactly four places and nowhere else:

1. **Zone weave-in** on unlock (the signature moment, two seconds, worth polishing hard).
2. **Progress and XP bars** easing, with a small overshoot on level up.
3. **Gain pop-ups** rising and unravelling.
4. **Screen shake** on level up and on taking a hit, 3 frames, very small amplitude.

Respect `prefers-reduced-motion`: disable shake and weave-in, keep bar fills.

---

# PART 2 — HOW IT PLAYS

## 2.1 The diorama, not a map

The thing worth keeping from OSRS is: **you tap a thing in a world and your character walks over and does it.** The thing worth discarding is the giant scrolling tile world with a minimap, because that is what makes something feel like a private server.

So: **each zone is a single hand-composed screen.** A diorama. Three-quarter view, no camera, no scrolling, no minimap, no tile grid exposed to the player. You see the entire zone at once, like a pop-up book page or a shadowbox.

- Meadowrest, the starting zone, is **one screen with six nodes.** That is the whole game on day one. Small, legible, cozy, zero overwhelm.
- Tap a node. Your character pathfinds across the diorama on foot, takes two or three seconds, arrives, and starts the action with a proper animation. The OSRS feel preserved exactly, with none of the RSPS baggage.
- You never walk between zones. Zone travel happens in the **Atlas**.

Eight zones eventually means eight beautiful screens, not one enormous map. Far cheaper to build and far more distinctive to look at.

## 2.2 The action strip and the panels

The world stays visible at all times. Everything else slides up over it.

```
┌─────────────────────────────┐
│                             │
│      THE DIORAMA            │  <- zone art, character, nodes,
│      (zone screen)          │     wandering enemies
│                             │
│                             │
├─────────────────────────────┤
│ ⛏ Copper Vein    ●●●○○ 4.2s │  <- ACTION STRIP: what you're doing,
│ Mining 34 ▓▓▓▓░░ Mastery ▓░ │     both bars, always visible
├─────────────────────────────┤
│  🎒    🔨    🗺    📖    ⚙  │  <- BOTTOM NAV, thumb height
└─────────────────────────────┘
```

- **Mobile-first, one-handed, thumb-reachable.** Nothing interactive in the top third of the screen, ever.
- Panels (Satchel, Bench, Atlas, Ledger, Settings) slide up from the bottom and cover 70% of the screen, dimming the diorama behind rather than hiding it.
- The **action strip** never disappears. Skill XP and node Mastery are both always on screen.

## 2.3 The Atlas

Travel is a panel, not a walk. The Atlas is the tapestry viewed whole: woven panels for zones you have opened, blank linen with chalk guides for zones you have not.

Tapping a woven zone starts **travel**, which takes real time (30s to several minutes by distance, reduced by Wayfaring). Travel is itself an idle action, and you can be attacked on the road in high-danger regions. This makes Wayfaring genuinely useful rather than filler.

## 2.4 Active play: the Glimmer

Active play must feel *busy*. That is the whole Idle Slayer lesson.

- At a random point during each action a **Glimmer** appears on the node: a small shimmer with a roughly 1.2 second tap window.
- Tapping it grants bonus yield and drops **Motes**.
- Missing it costs nothing. No punishment for idling, only a bonus for attending.
- Glimmer frequency scales with action speed, so as actions get faster with progression, active play gets **more** frantic. Cozy at the start, hectic later.
- Active play (tab visible, app foregrounded) also grants a flat **+20% XP**.

**Critical design rule: Glimmers and active bonuses reward materials, Motes and yield, never XP progression gates.** A pure idler reaches every level and every zone. They just upgrade slower. Nobody is ever locked out for having a job.

## 2.5 Combat happens in the diorama

Ambient danger is not a separate screen and not a menu. In a danger zone, an enemy **wanders in from the edge of the diorama** while you are chopping and starts chipping at you. Your character auto-fights back between swings of the axe. You watch a Thornwretch shuffle over, you watch your health tick down, you watch your character eat a trout from the Larder.

This is the whole reason the diorama exists. Combat is ambient, visible, and readable without ever leaving the skilling screen.

- **Slayer** is the opt-in inversion: you tap the *monster* deliberately instead of the node, and it becomes your action.
- **Bosses** are the single exception to the one-screen rule: a full-screen encounter where the tapestry frays at the edges.

## 2.6 What this is explicitly not

No minimap. No click-to-walk-anywhere. No exposed tile grid. No chatbox occupying the bottom third. No tabbed inventory interface jammed in the corner. No XP drops in the top right. If a screenshot could be mistaken for a private server, the direction has failed.

---

# PART 3 — THE CORE MATH

## 3.1 Two bars, always

Every action advances **skill XP** and **node Mastery** simultaneously, and both are always visible on the action strip.

**Mastery** (the single best mechanic in Melvor and the reason people play it for thousands of hours) is per-node progress. Chopping Oak 10,000 times builds Oak Mastery, which grants, for that node specifically:

- reduced action time
- a double-yield chance
- a raised **stack cap** for that item
- at Mastery 99, a permanent passive (Oak: 5% chance not to consume the node cooldown at all)

Content never dies. There is always a second bar filling under the first one.

**The always-three-bars rule:** at any moment a player can see skill XP, node Mastery, and a Ledger contract all advancing. There is never a second where nothing is progressing.

## 3.2 AFK duration: three multiplying levers

The naive design (one action takes 10 minutes, ten slots, 100 minutes AFK) breaks active play: a player watching sees one event every ten minutes, which is a screensaver, not a game.

Instead, split it:

```
AFK_seconds = slots × stack_size × action_time
```

| Lever | Start | Late | Driven by |
|---|---|---|---|
| `slots` | 10 | 40 | **Crafting** (satchel tiers) |
| `stack_size` | 1 | 10,000+ | **Crafting** (sacks per material class) + **Mastery** |
| `action_time` | ~25s | ~4s | **Skill level + tool tier** (gets faster) |

Worked progression:

- **Hour 1:** 10 × 1 × 25s = **250 seconds AFK.** Deliberately tiny. You are meant to be playing.
- **Day 3:** 16 × 25 × 15s = **~1.7 hours.**
- **Week 2:** 24 × 500 × 8s = **~26 hours.**
- **Month 3:** 34 × 8,000 × 5s = **~157 days.** Death is now the only real limit.

AFK time grows super-exponentially while action time shrinks. Every Crafting upgrade visibly multiplies your freedom, and the game explicitly celebrates the new number every time it changes.

## 3.3 Couriers: the fourth lever

A full satchel stops your AFK. So craft a **Courier**: a small NPC who runs one bank trip for you while you are offline, empties the satchel, and returns.

- Courier slots cost Motes plus crafted materials.
- Three couriers means four satchel-loads of AFK instead of one.
- The courier walking across your Homestead is a cozy visual reward in its own right.

## 3.4 XP curve

Clone the OSRS curve exactly: `floor(sum over L of (L + 300 × 2^(L/7)) / 4)`, levels 1 to 99, 13,034,431 total XP. Genuinely well tuned, players already understand its shape, costs nothing to adopt.

Mastery uses a shallower curve, reaching Mastery 99 in roughly 15% of the time of a skill 99, so it feels attainable per node.

---

# PART 4 — PROGRESSION AND RETENTION

## 4.1 The flywheel (state this to every agent)

> Gather → craft bigger satchels → longer AFK → the good materials are in dangerous zones → so you need Smithing for armour and Cooking for the Larder → survive the danger → get better materials → craft even bigger satchels.

Tools sit in the middle of that loop and are what makes it bind. Every tool is three components from three different skills (Part 4B), so there is no path through the game that lets you ignore a skill without feeling it.

**The endgame chase item in this game is not a sword, it is a backpack.** Lean all the way into that. The best-in-slot item after 500 hours is a bag.

Slayer closes the loop: **Slayer monsters drop crafting components that exist nowhere else** (Beast Sinew, Wyrmhide, Gloamsilk). The top-tier satchel is uncraftable without killing things.

Bosses close it again: bosses drop **global multipliers**, not gear. The item that raises stack cap on every material at once. The item that grants a third Pattern slot. The item that adds a fourth Courier. **Bossing is an AFK upgrade.** Everything in the game points back at idling harder.

## 4.2 Zones and the material ladder

Eight zones. Each opens a tier of every gathering skill at once, so progression is regional rather than per-skill, which keeps the player in one place and makes the world feel real.

| # | Zone | Danger | Ore | Wood | Fish | Signature |
|---|---|---|---|---|---|---|
| 1 | **Meadowrest** | 0 | Copper, Tin | Willow, Pine | Minnow, Trout | Safe forever. Tutorial and permanent bulk farm. |
| 2 | **Bramblewood** | 10 | Iron | Oak | Perch | First ambient enemy. Thornwretches. |
| 3 | **Ashen Delve** | 25 | Coal, Iron | Charwood | Cave Eel | Underground. Bank unlockable via the Ledger. |
| 4 | **Saltmarsh Reach** | 40 | Silver | Mangrove | Salmon, Crab | Tides change node availability on a real 6h cycle. |
| 5 | **The Gloamfen** | 55 | Duskiron | Gloamwood | Lantern Carp | Permanent dusk. Vision-limited, higher miss rate without light. |
| 6 | **Emberpeak** | 70 | Flamesteel | Ashbark | Magma Bass | Heat damage over time, resisted by specific gear. |
| 7 | **The Frayed Reach** | 85 | Nullstone | Thread-Oak | Voidfin | The tapestry is coming apart. Reality-glitch visuals. |
| 8 | **The Loomheart** | 100 | — | — | — | Bosses only. Where the world is woven. |

**Crucially, and unlike OSRS, low tiers never become landfill.** Higher-tier recipes require lower-tier components in bulk: a Flamesteel plate needs 40 iron rivets, the largest satchel needs 200 pine boards. Copper does not become worthless, it becomes **bulk**. This makes safe low-danger zones permanently useful as places to bank a week of guaranteed progress without dying, which is exactly what a player wants before a holiday.

## 4.3 Skills and how they cross over

**Tier 1 (v1 launch):**
- **Woodcutting** → Fletching (bows, shafts) and **Crafting** (boards for satchels)
- **Mining** → **Smithing** (armour, tools) and **Crafting** (rivets, clasps)
- **Fishing** → **Cooking** (the Larder)
- **Crafting** ← consumes all three. The spine of the game.

**Tier 2:**
- **Combat** (Attack, Strength, Defence, Hitpoints), gated by Smithing output
- **Foraging** → **Alchemy** (potions: AFK-duration buffs, damage resist, yield boosts)

**Tier 3:**
- **Farming** — the one skill that runs **in parallel** to your main action. Plant before a long AFK, harvest on return. Enormous for the AFK feel, and the engine must support parallel timers from day one even though Farming ships in P4.
- **Slayer** — contract-based hunting. Sole source of top-tier Crafting components.

**Tier 4:**
- **Weaving** — the Runecrafting analogue. Produces **Patterns**.
- **Homestead** — the Construction analogue. A Stardew-flavoured base where placed furniture grants passive buffs, houses your Couriers, and displays your Collection Log.
- **Wayfaring** — the Agility analogue. Cuts Atlas travel time and grants passive dodge against ambient damage.

## 4.4 Patterns and the daily check-in

The Loom weaves **one Pattern per day**: a slotted passive buff (+8% mining yield, -12% ambient damage, +1 courier speed) that decays over real time.

- **No streaks.** Streaks punish real life and breed resentment.
- Up to three unclaimed Patterns bank up. Miss two days, lose nothing. Come back after a week, three are waiting.
- Reward for showing up, zero punishment for not.

## 4.5 Motes

Motes drop only from Glimmers, so they are the pure active-play currency. They buy permanent structural upgrades that cannot be gathered:

- Courier slots
- Pattern slots
- Mastery acceleration
- Larder freshness upgrades

An idler progresses every level and every zone at full speed. They just build structural multipliers slower. This is the Idle Slayer split with no feel-bad.

## 4.6 The Ledger of Deeds

Stardew's Community Center is the best "what do I do next" system ever designed, and it is exactly what a new player in a grindy idle game needs.

The Ledger is a book of **bundles**: sets of items to hand in. Completing a bundle grants a **permanent world upgrade**, never a consumable:

- *The Prospector's Bundle* (10 copper, 5 tin, 1 iron) → opens Bramblewood
- *The Deep Larder* (20 cooked trout, 5 salmon) → a bank appears in Ashen Delve
- *The Long Road* (rope, 40 pine boards, 2 lanterns) → permanent shortcut, halves Saltmarsh travel

This converts an overwhelming skill list into a legible checklist, which is the single biggest thing you can do for new-player retention in a game this deep.

## 4.7 The Return Report

The highest-value screen in the game. Do not let any agent ship a list of numbers.

On login after an absence, generate a **prose timeline**:

> **You were away 18 hours.**
>
> *Hour 1.* You settled into the copper vein. The Glimmers went untapped.
> *Hour 3.* A Thornwretch found you. You ate six trout and kept swinging.
> *Hour 7.* Satchel full. Wren the courier ran it to the bank and came back.
> *Hour 11.* Your bronze helm cracked. Defence dropped.
> *Hour 14.* Something larger took an interest in the noise. You left the vein.
>
> **+41,200 Mining XP. +3 Oak Mastery. 1,840 copper ore banked. 2 near-deaths.**

People screenshot this. It makes an absence feel like an adventure instead of a spreadsheet update, and it is free marketing.

## 4.8 Long-tail retention

- **Pets.** Roughly 1/50,000 per action while skilling, one per skill. Costs almost nothing to implement. People chase these for years.
- **Collection Log.** Every item ever obtained, displayed in the Homestead. Permanent completionist retention requiring zero new content.
- **Satchels as status.** Each satchel tier has a distinct visible sprite on your character. Pure gear-flex psychology, free.

---

# PART 4B — TOOLS AND THE THREE-PART BUILD

## 4B.1 The principle: soft weighted gating, never hard walls

A tool is not one item. It is **three components assembled at the Bench**, each from a different skill:

| Component | Skill | Material | Drives |
|---|---|---|---|
| **Head** | Smithing | ore / bars | **Yield.** Double-drop chance, rare-drop rate, ore quality. |
| **Haft** | Fletching | wood | **Speed.** Action time reduction. |
| **Binding** | Crafting | fibre, hide, sinew | **Endurance.** Wear rate, Glimmer window size. |

This gives the game the web the flywheel needs: neglect Smithing and your yield is poor, neglect Fletching and you are slow, neglect Crafting and your tools wear out mid-AFK.

**The critical design rule: tool power is a weighted blend of the three components, never `min()` of them.** A tier-3 head on a tier-1 haft works fine, it is just slow. Progress is weighted, never blocked.

This matters enormously. Hard multi-skill gates ("you need Smithing 30 AND Fletching 30 AND Crafting 30 for the iron pickaxe") create walls, and a wall is the exact moment an idle player quits. In OSRS you sidestep this by buying the pickaxe. Here there is no shop worth using early, so the gate must be soft. Components are independently craftable, bankable, tradeable and upgradeable **one at a time**, so a player always has a next step that is one skill away rather than three.

## 4B.2 Component tiers

Eight tiers, one per zone, named off the material ladder:

`Copper → Bronze → Iron → Steel → Silverwrought → Duskiron → Flamesteel → Nullstone`

Recipe level requirement is roughly `10 × tier` **in that component's own skill only**:

- Iron head (tier 3): Smithing 30
- Iron haft (tier 3): Fletching 30
- Iron binding (tier 3): Crafting 30

So a fully matched tier-3 pickaxe naturally lands a player at roughly 30 in all three, which is exactly the intended shape, but they arrive there by choice and in any order rather than by being stopped.

**The first tool is given, not crafted.** Minute one, the player is handed a chipped copper hatchet. Onboarding must never require the Bench.

## 4B.3 Node hardness: why a bad tool in a good zone is miserable

Every node carries a `hardness` value, 1 to 8. Compare it against **head tier**:

| Gap | Result |
|---|---|
| head tier >= hardness | normal action time |
| 1 tier under | 3x action time |
| 2 tiers under | 12x action time |
| 3+ tiers under | **blocked**: "This vein is too hard for your tool." |

Soft scaling for small gaps means a player can push into the next zone early and *feel* the grind rather than being told no. That feeling is the teacher. The hard block at 3+ preserves the sense of achievement on the top tiers and stops absurd 400x calculations from breaking the balance sim.

## 4B.4 Wear: the fourth AFK stop

Tools degrade with use. Not a threat, a **soft stop**.

- Wear reduces effectiveness down to a **floor of 60%**. Tools never break, never vanish, and are never lost on death.
- Uses-before-worn is driven almost entirely by **binding tier**, which makes Crafting the endurance skill.
- Repair at the Bench costs materials **of the original tier**. This is a permanent sink for low-tier ore and reinforces the rule that copper never becomes landfill, it becomes bulk.

This gives the game a fourth natural AFK terminator alongside satchel-full, courier-exhausted and death, and it is the one the player can push out purely by investing in Crafting. The Return Report handles it gracefully: *"Hour 22. Your binding frayed. You kept working, slower."*

## 4B.5 Tool Mastery and the Heirloom

Tools accumulate their own **wear-mastery** through use, granting a small permanent bonus. This creates an obvious problem: it punishes upgrading, and a mechanic that punishes upgrading is a broken mechanic.

The fix is the **Heirloom bench action**: feed an old tool into a new one and carry across a fraction of its accumulated mastery. Higher Crafting transfers a higher fraction, and Motes can top it up. This turns your first hatchet from junk into a thing you deliberately keep and pass forward, which is a genuinely lovely feeling and costs almost nothing to build.

## 4B.6 Sockets: where Slayer plugs in

From tier 5, bindings have **sockets** that accept Slayer-only drops:

- *Beast Sinew* → +12% wear resistance
- *Gloamsilk* → +0.4s Glimmer window
- *Wyrmhide* → tool ignores one tier of hardness gap

This is the Slayer to Crafting loop closing again. The best tools in the game are uncraftable without killing things, and the reward for killing things is a longer AFK.

## 4B.7 The Kit

A late Crafting milestone. The **Kit** lets you carry hatchet, pickaxe and rod simultaneously instead of one at a time, so you can switch skills without a bank trip. This is one of the largest quality-of-life unlocks in the game and should be positioned as a genuine celebration moment.

## 4B.8 Blueprints

Recipes above tier 4 are **not** shown by default. Blueprints are found: rare node drops, Ledger of Deeds rewards, boss drops. Turning "grind to level 50" into "I found something" is free excitement, and it gives the Ledger something meaningful to hand out at every tier.

---

# PART 5 — REPOSITORY STRUCTURE

pnpm workspaces + Turborepo. Both free.

```
everloom/
├── packages/
│   ├── engine/              # THE CRITICAL PACKAGE. Pure TS, zero deps, zero I/O.
│   │   ├── src/
│   │   │   ├── resolve.ts        # state + elapsed -> state
│   │   │   ├── rng.ts            # deterministic splitmix32
│   │   │   ├── combat.ts         # analytic ambient pressure resolution
│   │   │   ├── mastery.ts
│   │   │   ├── xp.ts             # OSRS curve
│   │   │   ├── inventory.ts      # slots, stacks, larder, couriers
│   │   │   ├── parallel.ts       # farming-style parallel timers
│   │   │   └── types.ts
│   │   └── test/                 # property-based tests (fast-check)
│   ├── gamedata/            # versioned JSON. Balance lives here, not in the DB.
│   │   ├── skills/ items/ zones/ recipes/ nodes/ ledger/
│   │   └── schema/*.ts           # zod, validated in CI
│   └── ui/                  # shared React components, the pixel design system
├── apps/
│   ├── web/                 # Vite + React + TS. The game.
│   └── admin/               # game data editor + balance simulator, auth-gated
├── supabase/
│   ├── migrations/
│   └── functions/
│       ├── commit-action/ resolve-offline/ exchange-offer/ ledger-submit/
│       └── _shared/              # imports packages/engine
├── tools/
│   ├── balance-sim/         # headless: "play" 10,000 hours in 2 seconds
│   └── sprite-gen/          # placeholder atlas from items JSON
└── docs/
    ├── DESIGN.md            # this file
    ├── ENGINE_CONTRACT.md   # the resolve() spec, sacred
    ├── ART_BIBLE.md
    └── ADR/
```

---

# PART 6 — DATA MODEL

```sql
players
  id uuid pk (= auth.users.id)
  display_name text unique
  mode enum('cozy','standard','ironbound')
  rng_seed bigint
  created_at, last_seen_at
  is_dead bool                  -- ironbound

player_state
  player_id uuid pk fk
  checkpoint_at timestamptz     -- THE critical column
  current_action jsonb          -- {skill, node_id, zone_id, started_at}
  parallel_actions jsonb        -- farming plots etc
  skills jsonb                  -- {mining: {xp}, ...}
  mastery jsonb                 -- {node_id: xp}
  inventory jsonb               -- [{item_id, qty}], length <= slots
  larder jsonb                  -- {item_id: {qty, freshness_at}}
  equipment jsonb
  bank jsonb
  slots int default 10
  stack_caps jsonb              -- {ore: 1, log: 1, ...} raised by crafting + mastery
  couriers jsonb                -- [{id, state, eta}]
  patterns jsonb                -- [{id, buff, expires_at}]
  motes int
  hp int, max_hp int
  zone_id text
  version int                   -- optimistic lock

ledger_progress   (player_id, bundle_id, items_submitted jsonb, completed_at)
item_ledger       (id, player_id, item_id, delta, reason, at)   -- append only
exchange_offers   (id, player_id, item_id, side, qty, qty_filled, price_per, status, created_at)
collection_log    (player_id, item_id, first_obtained_at)
cheat_events      (id, player_id, kind, client_claim jsonb, server_truth jsonb, at)
```

`checkpoint_at` is the heart of the game. Every read computes `now() - checkpoint_at`, feeds it to `resolve()`, and that is offline progress. Everything else is bookkeeping.

RLS: players read only their own rows. **`player_state` has no client write policy at all.** Only the service role writes it.

---

# PART 7 — AGENT ROSTER

Agents 1 to 3 are sequential and blocking. 4 to 8 parallelise.

### Agent 1 — ARCHITECT (blocking, alone, first)
Produce `docs/ENGINE_CONTRACT.md` and the full type system. **No implementation.**
- Every state shape, action shape, the exact `resolve()` signature, determinism guarantees, reconciliation tolerances, integer-maths rules, and the parallel-timer contract (for Farming, even though it ships later).
- `packages/engine/src/types.ts`, `packages/gamedata/schema/*.ts` (zod).
- Monorepo scaffold with working `pnpm typecheck`, `test`, `build`.
- `docs/ADR/0001-pure-engine.md`.

**Hard rule:** the engine package may not import anything touching the network, filesystem, `Date.now()`, or `Math.random()`. Time and randomness are always injected parameters. If they are not, the architecture has failed.

**Done when:** typecheck passes on an empty implementation and a human has read and approved the contract.

### Agent 2 — ENGINE (blocking, depends on 1)
Implement `packages/engine`. Pure functions only.

**Critical performance requirement:** resolving a 300-hour offline window must complete in **under 50ms**. Do not tick-simulate. Solve combat analytically: compute damage-per-hour and healing-per-hour, find the crossover in closed form, then fine-simulate only the ~10 minutes around a predicted death. Same approach for satchel fill and courier round trips. Specify it in the contract.

**Property tests (fast-check), the invariants that matter:**
- `resolve(s, t1+t2) === resolve(resolve(s,t1), t2)` — composability, non-negotiable
- no item created or destroyed outside `item_ledger`
- inventory length never exceeds slots
- identical seed always yields identical result
- no float appears in any state value

**Done when:** 90%+ coverage and all invariants hold across 10,000 generated cases.

### Agent 3 — GAMEDATA + BALANCE SIM (depends on 2)
Author all Tier 1 game data, and build `tools/balance-sim`.
- ~140 items, 4 skills curved 1 to 99, zones 1 to 3, ~70 recipes, 12 Ledger bundles, all zod-validated in CI.
- **Tool components (Part 4B): 3 tools x 3 components x 8 tiers = 72 component recipes.** Tiers 1 to 3 authored fully for v1, tiers 4 to 8 stubbed with correct level requirements so the balance sim can project the full curve.
- Node `hardness` values and the hardness penalty curve, tuned so that pushing one zone early is painful but viable and two zones early is clearly a mistake.
- Headless simulator that plays a defined strategy for N simulated hours and outputs a progression report in under 5 seconds.

**This agent's real job is balance, not data entry.** Tune the JSON until the sim produces:
- First 10 minutes: level 5 in something, zero deaths possible, one crafting upgrade earned, one Ledger bundle completed
- Day 1 (60 min active): ~4 hours of AFK unlocked
- Week 1: ~24 hours of AFK, Bramblewood survivable
- Month 1: multi-week AFK, Tier 2 skills open

### Agent 4 — SUPABASE (parallel)
Migrations, RLS, all edge functions, auth.
- **Anonymous play first, account linking later.** Forcing signup before the cozy first ten minutes is a conversion killer.
- Edge functions import `packages/engine` directly. If you find yourself reimplementing game logic in an edge function, stop, the architecture has broken.
- Optimistic locking, idempotency keys, elapsed-time clamping.

### Agent 5 — CLIENT CORE (parallel, depends on 2)
Vite + React + TS. Zustand state. Runs `resolve()` locally at 30fps for display; commits on action change, every 60s, on `visibilitychange`, and on `beforeunload`.
- Offline play: queue commits, reconcile on reconnect.
- Reconciliation UX: snap silently, never show an error unless the delta is large.
- PWA: service worker, manifest, iOS install prompt, iOS 16.4+ web push for "satchel full", "courier returned", "you died".
- Owns the **Return Report** generator.

### Agent 6 — ART AND UI (parallel)
Owns `docs/ART_BIBLE.md`, the design system in `packages/ui`, `tools/sprite-gen`, the sprite manifest layer, and every screen.

**Read `/mnt/skills/public/frontend-design/SKILL.md` before writing any styling.**

Build to Part 1 and Part 2 of this document exactly: the tapestry concept, the dye palette, the stitched chrome, the diorama interaction model, the bottom-nav one-handed layout. The **zone weave-in animation is the signature element**; spend the boldness there and keep everything else disciplined.

Screens: Diorama (main), Satchel, Larder, Equipment, Bench (crafting), Atlas, Ledger of Deeds, Exchange, Return Report, Collection Log, Settings.

### Agent 7 — ONBOARDING AND FEEL (depends on 5, 6)
Owns the first ten minutes. Worth a dedicated agent because it decides everything.

**Spec:** no signup wall, no text walls. Player taps a tree, something happens in 8 seconds, a log appears with a satisfying sound and a small particle. Three taps later they have a fletching knife. Minute 4, the first Glimmer appears and teaches itself with no tutorial text. Minute 6, they craft their first satchel upgrade and the game **explicitly celebrates the AFK number going up**. Minute 8, the first Ledger bundle completes and Bramblewood weaves itself onto the Atlas. Minute 10, they are told they can close the app and come back.

Also owns juice: level-up shake, gain pop-ups, bar easing, sound (freesound.org CC0), haptics via the Vibration API, and the install-to-home-screen prompt placed at the moment of the first weave-in, when delight is highest.

### Agent 8 — ADVERSARY / QA (last, continuous)
Not unit tests. Exploits.

Attack list: device clock manipulation, replayed commit payloads, concurrent commits from two tabs, inventory overflow races, negative quantities, crafting with insufficient materials via race, 10-year offline windows, courier duplication, exchange offer manipulation, Ledger double-submission.

Deliverable: an exploit report plus a regression test for every one found.

---

# PART 8 — PHASING

| Phase | Scope | Sessions |
|---|---|---|
| **P0** | Agents 1 to 3. Contract, engine, balanced Tier 1 data. No UI at all. | 3-4 |
| **P1** | Agents 4 to 6. Playable: 4 skills, Mastery, crafting, satchel growth, Meadowrest only, no combat. | 5-7 |
| **P2** | Agent 7. Onboarding, Glimmers, juice, PWA install, push. **First genuinely fun build.** | 2-3 |
| **P3** | Combat, zones 2-3, danger, death, Larder, Couriers, Return Report. Agent 8 begins. | 4-5 |
| **P4** | Ledger of Deeds, Patterns, Farming, Slayer, Homestead, zones 4-6, Exchange with market maker. | 5+ |
| **P5** | Zones 7-8, bosses, Collection Log, pets, Capacitor wrap, TestFlight, multiplayer flag. | 3+ |

**Do not build combat before P3.** The cozy loop must be provably fun on its own, or combat is just papering over a boring core.

---

# PART 9 — KICKOFF PROMPT

Save this document as `docs/DESIGN.md` in an empty repo, then paste the following into a fresh Claude Code session.

---

> I am building **Everloom**, a cloud-saved idle RPG blending Old School RuneScape, Melvor Idle, Stardew Valley and Idle Slayer. The complete design document is at `docs/DESIGN.md`. **Read it in full before doing anything.**
>
> Stack: pnpm workspaces + Turborepo, Vite + React + TypeScript, Supabase (Postgres, auth, Deno edge functions), Vercel, PWA now and Capacitor for iOS later.
>
> **The single most important architectural rule:** all game logic lives in `packages/engine` as a pure function `resolve(state, action, elapsedSeconds, seed) -> newState`. Zero dependencies, zero I/O, never calls `Date.now()` or `Math.random()`, and uses integer maths only. Both the React client and the Supabase edge functions import this identical package. If you ever find yourself writing game logic anywhere else, stop and tell me, because that means the architecture has failed.
>
> **Your first task is Agent 1 (ARCHITECT) only. Do not implement game logic.** Produce:
> 1. `docs/ENGINE_CONTRACT.md`: the complete spec of `resolve()`, its state shapes, determinism guarantees, reconciliation tolerance rules, integer-maths rules, the parallel-timer contract for Farming, and its performance requirement (a 300-hour offline resolution in under 50ms, which means combat, satchel fill and courier trips must be solved analytically rather than tick-simulated; specify exactly how).
> 2. `packages/engine/src/types.ts`: the full TypeScript type system, implementation-free.
> 3. `packages/gamedata/schema/*.ts`: zod schemas for all game data JSON.
> 4. The monorepo scaffold with working `pnpm typecheck`, `pnpm test`, `pnpm build`.
> 5. `docs/ADR/0001-pure-engine.md` recording this decision and its tradeoffs.
>
> Before writing, list every assumption you are making and every place where `docs/DESIGN.md` is ambiguous or internally contradictory. Ask me about the contradictions rather than guessing.
>
> When Agent 1's deliverables are complete, **stop and wait for my review.** Do not proceed to Agent 2.

---

# PART 10 — KNOWN FAILURE MODES

1. **Logic leaking out of the engine.** The most likely failure by far. An agent adds "just a small check" inside a React component. Every session, ask: is there any game logic outside `packages/engine`?
2. **Tick-simulating long offline windows.** Works fine in testing at 2 hours, times out in production at 300. Force the analytic solution in P0, not later.
3. **Balance tuned by vibes.** Why `tools/balance-sim` is a P0 deliverable, not a nice-to-have. Re-simulate on every JSON change.
4. **The first ten minutes as an afterthought.** Why Agent 7 exists with its own phase.
5. **Scope creep into real player trading.** Resist. The market maker is the answer until there are actual players.
6. **Float drift.** Integers only, everywhere, always.
7. **Tool gates hardening into walls.** If any agent implements tool power as `min(head, haft, binding)` instead of a weighted blend, or gates a component recipe behind more than one skill, the soft-gating design has broken and players will hit a wall and quit. Weighted, always.
8. **The art drifting into RSPS.** If a screenshot could pass for a private server, Agent 6 has failed. The test: linen and stitching, not brown wood panels. Dioramas, not a scrolling tile map.
