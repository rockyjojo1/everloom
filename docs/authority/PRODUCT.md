# Everloom Product

Last reviewed: 2026-08-04

Governs: the settled product definition — what Everloom is, who it is for,
and the standing constraints on design. This file does not govern
implementation status (see [`CURRENT_STATE.md`](CURRENT_STATE.md)) or engine
choice (see [`TECHNICAL_ARCHITECTURE.md`](TECHNICAL_ARCHITECTURE.md)).

Source authority: owner strategy, carried forward through
[`CODEX_SUPERVISOR_CONTINUATION.md`](CODEX_SUPERVISOR_CONTINUATION.md) §9
("Decisions already made"). Product strategy is owned by the owner and
strategy chat, not by implementation evidence — but if a claim here
contradicts a settled decision the owner has since changed, the owner's
current word wins and this file must be corrected.

Related: [`DECISIONS.md`](DECISIONS.md) · [`CURRENT_STATE.md`](CURRENT_STATE.md) · [`VERDANT_GROVE.md`](VERDANT_GROVE.md)

## Settled product definition

- Everloom is an **expedition planner first**, a **long-term account builder
  second**, and an **active adventurer third**.
- iPhone is priority one. Browser is mandatory. Internally, the game is
  **AFK-first**: activities are established physically in an authored world,
  then resolved actively or offline through one deterministic domain model.
- Routine active sessions are generally short.
- First six skills: Woodcutting, Mining, Fishing, Cooking, Smithing, Melee.
- Combat is simple point-and-click auto-combat.
- Ordinary retreat preserves equipment, earned XP and earned resources.
- Solo through first public release. No multiplayer architecture now.

## Standing constraints

- No energy system.
- No compulsory streaks.
- No loot boxes.
- No paid progression.
- No paid offline time.
- No advertising-led design.

## Visual and IP direction

- Original Everloom expression, with strong old-school point-and-click
  MMORPG readability as an interaction-grammar target.
- Do not copy Jagex assets, maps, characters, UI art, exact layouts, fonts,
  icons, audio, quests, dialogue, or other protectable expression.
- Section 15 of the visual reference material
  (`art-direction/reference-sheets/everloom-15-interface.png`) is
  **deprecated as an implementation reference**: it is preserved as interface
  inspiration only, `reviewStatus: needs-revision`, because it moved too
  close to RuneScape's complete UI expression (including a Wiki-style
  button). It must be redesigned into an original Everloom interface before
  production use. See `art-direction/reference-sheets/reference-sheet-status.json`.

This is an operating summary, not a legal opinion. Escalate genuine
IP-similarity questions to strategy chat rather than resolving them here.
