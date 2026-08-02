# Everloom — full audit and honest creative opinion

Written after: reading `everloom-design.md`, `GRAPHICS_OVERHAUL_PLAN.md`, `EVERLOOM_WORLD_MASTERY_CLOUD_HANDOFF.md`,
`CODEX_TUTORIAL_CONTINUATION_HANDOFF.md`; reading `apps/game/src/world/GameWorld.tsx`,
`packages/core/src/simulation.ts`, `packages/content/src/data/zones.json`; and actually playing the live
`codex/visual-tutorial-integration` build (commit `a7ad0da`) in a browser — creating a fresh character, walking,
picking up items, opening panels, and inspecting live engine state through the dev test hooks, not just reading code.

This is opinion, framed as a prompt you can hand directly to Codex (or to me) to argue with. Push back on any of it.

---

## 0. First, a housekeeping problem nobody has flagged

**The repo root has two "design constitution" documents that describe two different games, and neither describes
the game you're actually playing.**

- `everloom-design.md` — the "tapestry" concept. Satchels, Motes, Couriers, Patterns, the Loomhall Exchange,
  single-screen diorama zones, canvas+Zustand+Supabase server-authoritative architecture. This describes `apps/web`.
- `GRAPHICS_OVERHAUL_PLAN.md` — a *different* v3 plan: LPC sprite sheets, 2D tile canvas, OSRS-mobile side panel.
  Also `apps/web`.
- `apps/web` was last touched **five days before** `apps/game` was last touched. It's dead. Nobody's building it.
  The live game is `apps/game`, a fully 3D Three.js client, built by Codex, that neither root doc mentions once.

So right now there is **no written design constitution for the game that actually exists.** Everything Codex has
built in `apps/game` was steered by a scattered trail of handoff docs (`CODEX_TUTORIAL_CONTINUATION_HANDOFF.md`,
`EVERLOOM_WORLD_MASTERY_CLOUD_HANDOFF.md`, etc.) and direct chat instructions, not by a single document either of
us can point to and say "this is what we're building." That's how you get honest lines like Codex's own handoff
admitting the mastery model is "intentionally simpler" than what was designed, and separate audits (mine)
repeatedly having to reconstruct scope from commit history instead of a spec.

**My opinion: this is the single highest-leverage fix available, and it costs nothing to build.** Before another
line of game code gets written, someone (probably you, with one of us drafting) should write ten pages that say,
in `apps/game` terms specifically: what OSRS gives us, what Melvor gives us, what the camera/character/world
actually look like, and what's explicitly out of scope. Retire or clearly mark the two `apps/web` docs as
historical. Every agent session since Phase Three has effectively been improvising against vibes and the last
handoff doc. That's remarkable given how coherent the actual output has been — and also exactly why a stray
mismatch (see §2) shipped without anyone catching it for what might have been days.

---

## 1. Does it hit your brief? OSRS first / Melvor second / addictive / seamless / easy tutorial / good graphics

Playing it straight, in order of your stated priorities:

**OSRS first — mostly yes, and this is the part Codex has gotten most right.** You walk. You click a real object
in a real 3D world and your character paths to it and does the thing. Tools are found, not given for free (a worn
hatchet sitting by a path, not a menu). There's no minimap-and-tile-grid MMO feel — it's a small, legible island
you can see all of. The character creator → "the Loomskiff cannot sail, go find a hatchet" opening is a genuinely
good OSRS-flavored hook: concrete, physical, low-text. This is the strongest part of the whole project.

**Melvor second — present but thin.** The Skills panel is clean and legible (level, XP, a mastery number per
action) — good bones. But per Codex's own handoff, the *mastery* system is "intentionally simpler than a
spendable mastery pool" right now — it's closer to a per-action counter than Melvor's actual hook, which is that
mastery pool decisions (where do I spend it) are half the strategic layer of the game. Offline simulation exists
and is deterministic, which is the correct Melvor-grade foundation — but nothing in the moment-to-moment play
communicates "idle game" yet. There's no persistent "you'll come back to X" framing, no next-unlock teaser, no
visible AFK-duration number anywhere I found. Right now it plays like an OSRS demo with an offline-safe engine
underneath it, not like a game that wants you to close the tab and come back.

**Addictive — not yet, and this is the biggest gap.** There is currently no glimmer/active-bonus layer, no
next-unlock teaser, no return report, no daily-login shape, no collection log, no pets, nothing that gives a
player a reason to think about the game while they're not playing it. This isn't a criticism of execution — none
of it has been *attempted* yet, per the handoff's own "remaining priorities" list. But if "more addictive" is a
top-three goal, it's currently the least-built layer of the whole stack, not a polish pass away.

**Seamless / easy to play / easy to follow — good instincts, one real bug, one real friction point.**
- The objective beacon + route trail + HUD guidance text is a genuinely well-built "never wonder what to do next"
  system. I watched it work correctly across three different quest steps.
- **I found a real, reproducible bug**: on a completely fresh save, clicking directly on a ground item (the
  starting Worn Hatchet, standing right next to it, multiple careful attempts at different pixel-precise points on
  its visible label and icon) silently fails to trigger pickup. The underlying pickup logic is completely
  correct — calling the exact same interaction through the game's own dev test hook worked instantly, landed the
  player exactly on the tile, added the item, advanced the quest. So this isn't a broken system, it's a **narrow,
  real raycast hit-target problem**: the clickable hitbox for at least this ground item is small/misaligned enough
  that a plausible, careful click near the visible marker misses it. On the literal first interactive action of
  the entire game. I'd treat this as sev-1, not because the system is broken, but because of exactly where it is.
- The World Assistance settings (objective highlighting, path trail, high-contrast, UI scale) are a good, honest,
  opt-in-not-forced implementation of the RuneLite-clarity idea.

**Good graphics — decent low-poly foundation, visibly unfinished, and honestly self-reported as such.** The world
reads as a clean, warm, readable low-poly island — closer to "cute mobile RPG" than "developer placeholder,"
which was explicitly the failure state the old `GRAPHICS_OVERHAUL_PLAN.md` was written to avoid. Character
identity (four tints + a couple of original accessory pieces), one piece of real equipment attachment, and some
terrain variation exist. But per the last two audits (mine, self-reported honestly both times): silhouette
differences are still mostly tint-only, most zones haven't had a real art pass, and a chunk of "final" art is
still primitive placeholder geometry labeled as such. It's a real foundation, not a finished look.

---

## 2. What I think Codex has done *well* — say this part out loud, it's earned

- **Never wrote game logic outside the engine.** I went looking for this specific failure mode (it's the #1 named
  risk in the old design doc) and didn't find it. `packages/core` stays pure; the world/UI layers consume it.
  That discipline is the reason five different agents (Codex, and three of my own branches) could work on this
  codebase in parallel without the kind of drift that kills projects like this.
- **Save migrations that don't lose player state**, tracked honestly (v1→v5, each migration real and tested).
- **Deterministic offline simulation**, including a real optimization pass (batched exact resolution for long
  absences) rather than a naive tick-simulate-everything approach that would have timed out.
- **Honest self-auditing.** Codex's own handoff calls out its own predecessor's mistakes by name (a broken
  opening that pointed at the wrong item, screenshots that overclaimed). That's a genuinely rare property in
  agent-built software and worth explicitly protecting as a norm, not just a nice-to-have.
- **The core interaction loop (walk, click, tool-gated action, objective beacon) is correctly, not just
  superficially, OSRS-flavored.** That was the hardest part of your brief to get right and it's the part that's
  most right.

---

## 3. The biggest creative changes I'd make, ranked by leverage

**1. Write the missing `apps/game` design doc before anything else. (§0)** Everything below is guesswork without
it, including my own suggestions. This is a half-day of writing, not an engineering task, and it's the highest
expected-value thing anyone can do next.

**2. Ship *one* addictive-loop primitive end to end before adding more art or more skills.** Not five idle
systems at once — pick the cheapest one that proves the loop, ship it completely, feel it. My nomination: a
**Return Report** (Codex's own design doc already has the exact spec for this, verbatim, in `everloom-design.md`
§4.7 — it's the single best-value paragraph in either stale doc and nobody's built it in `apps/game`). A prose
summary on login — "you were away 3 hours, your hatchet is worn, a Thornwretch found you" — turns every single
offline period the deterministic engine already computes into a moment of story instead of a number. It's mostly
UI over data you already have. It is also, not coincidentally, the single most "Melvor but better" thing you
could ship, and it's the cheapest addictive-loop primitive available given what's already built underneath it.

**3. Fix the ground-item click hitbox before doing anything else visual.** A player who can't reliably pick up
the tutorial's first item bounces in the first ten seconds. This is a one-file fix (raycast target sizing/shape in
`GameWorld.tsx`), not a redesign, and it's currently sitting upstream of every single other system in the game.

**4. Make mastery a real spendable choice, not a counter.** Right now it's tracked but not *decided*. Even a
minimal version — 3 node-specific perks unlockable at mastery milestones, player picks one — gets you most of why
Melvor's mastery system is sticky (it's a decision, not a number going up) for relatively little engineering.

**5. Silhouette, not tint, for character identity — but only after #1-#4.** This is real, it's on the list, it's
just not urgent relative to the loop and the bug above. A player forms an opinion about "is this addictive and
does it work" in the first two minutes, before they've looked closely enough at their own character to notice the
silhouette is thin.

**6. Consider whether five zones' worth of art direction should wait for a real design doc.** Two zones
(Quarry, Grove) got a lighting/palette pass from my last branch. Before spending more art budget on the rest,
I'd want §0's doc to lock the *actual* target look (not the two abandoned `apps/web` docs' saturated-autumn or
LPC-tile visions) so art direction converges instead of drifting zone by zone under whichever agent touches it
last.

---

## 4. Things I'm *not* confident about — flag these, don't just accept them

- I only played the tutorial's first ~10 minutes personally. I have not verified combat, Forge Trade, the
  Verdant attunement gate, or long-offline-return UX firsthand — only read code and prior audits for those.
- The ground-item click bug: I confirmed it's real and reproducible with careful manual clicks, but I did not
  instrument exact raycast geometry to find the precise fix. Someone should actually measure the hit target
  before assuming it's a one-line size bump.
- My "addictive loop is the biggest gap" read is a judgment call, not a measurement — there's no analytics, no
  playtesters, no data. It's my honest opinion after playing it, not a verified finding the way the click bug is.
- I have not evaluated mobile feel firsthand in this session (previous branches have; I didn't re-verify it here).

---

## 5. Question this back at me

If you disagree with the priority order in §3, or think the addictive-loop gap is actually fine for now because
the OSRS core needs to be bulletproof first, or think the missing design doc is bureaucracy rather than leverage —
say so. This was written to be argued with, not rubber-stamped.
