# Gate 0 Repair Report

**Branch:** `claude/gate-zero-stabilise`  
**Phase status:** Gate 0 repaired and verified. Stage B not started.

---

## 1. Hitbox implementation (`apps/game/src/world/assets.ts`)

`addInteractionHitbox(object, kind, targetId?)`:

- Non-`"ground_item"` kinds and repeat calls are no-ops (idempotent).
- **Coordinate-space fix:** `addAsset` in `GameWorld.tsx` applies position/rotation/scale to `object` *before* calling this helper. `Box3.setFromObject(object)` measures world-space bounds, so using that centre directly as a child's local position double-applied the transform. Fix: the object's own position/quaternion/scale are temporarily zeroed, `updateMatrixWorld(true)` is called, the box is measured (now in local space), and the original transform is restored. The hitbox therefore inherits the parent's translate/rotate/scale exactly once, like any other child mesh, regardless of call order.
- Radius: `clamp(maxLocalDimension / 2, 0.3, 1.2)`. Minimum 0.3 keeps small tools clickable; maximum 1.2 stops large props swallowing distant clicks.
- `userData.interactionHitArea = true` and `userData.targetId` are set directly on the hitbox mesh (passed in explicitly by the caller), not left to an outer `object.traverse()` to backfill.
- Call site (`GameWorld.tsx`) updated: `addInteractionHitbox(object, kind, id)`.

## 2. Unit tests (`apps/game/src/world/assets.test.ts`) — 10 tests, all new/rewritten

| Test | Real behaviour proven |
|---|---|
| ground item receives exactly one hitbox | mesh + sphere geometry present |
| npc/resource/scenery receive no hitbox | zero hitboxes for 3 non-ground kinds |
| repeated calls remain idempotent | 3 calls → still 1 hitbox |
| small/medium/large sizing | radii 0.3 / 0.5 / 1.2 — proves both clamps and derivation |
| local centre correct for offset geometry | hitbox local position matches mesh offset |
| centre correct under translate+rotate+scale | mimics real `addAsset` order; asserts local position **and** computed world position via `getWorldPosition` |
| material invisible but raycastable | transparent/opacity 0/depthWrite false/colorWrite false, `visible === true` |
| real ray through hitbox intersects + carries targetId | actual `Raycaster.intersectObjects`, asserts `userData.targetId` on the hit object |
| real ray outside does not intersect | second raycaster origin/direction, asserts no hit |
| production disposal utility disposes geometry+material once | spies on `dispose`, calls the real `disposeObject()` from `threeDisposal.ts` (not manual `.dispose()`) |

`pnpm --filter @everloom/game test` → **17/17 passed, exit 0** (10 in `assets.test.ts`, 7 pre-existing in `pathfinding.test.ts`, untouched).

## 3. Development QA gallery

- `VisualQAGallery.module.css` (dev-only, tree-shaken from prod) restores full-screen layout/canvas/controls.
- **Fixed the selected-state bug:** CSS Modules scope every class selector in the file, including the `.selected` compound in `.items button.selected`, but the component was applying a raw, unscoped `"selected"` string. Buttons now use `styles.selected`, matching the generated class. Verified live in the browser (`javascript_tool`, dev server): selected item button computed `background-color` is `rgb(214, 169, 78)` (gold) vs. `rgb(54, 82, 71)` (unselected); clicking a different item button and the pose toggle updates the selected class and pose text correctly.

## 4. Read-only test bridge

New `window.__EVERLOOM_READONLY_TEST__` in `GameWorld.tsx`, compiled only when `import.meta.env.MODE === "test"` (a dedicated Vite mode, distinct from `DEV`). Exposes only: `worldReady()`, `selectedTargetId()`, `inventoryQuantity(itemId)`, `target(targetId)` (existence, availability, visibility, live projected hitbox centre, and a deterministic outside point derived from the hitbox's own projected radius). No method mutates state, dispatches gameplay events, or bypasses raycasting.

The pre-existing `window.__EVERLOOM_TEST__` (gated by `DEV`, contains mutating debug methods such as `activateTarget`/`equip`/`giveItem`) is left untouched — it is depended on by other existing specs (`player-flow.spec.ts`, `foundation.spec.ts`, etc.) that are out of this repair's scope. It is architecturally separate from the new read-only bridge.

**Known residual issue:** the string `__EVERLOOM_TEST__` (legacy bridge) still appears in the production bundle as an inert `delete window.__EVERLOOM_TEST__` cleanup statement (the assignment itself is correctly eliminated by the `DEV` guard; only the harmless no-op delete call remains). This is pre-existing and was not introduced or fixed by this repair. `__EVERLOOM_READONLY_TEST__` has no such leak — its cleanup `delete` is itself guarded by `MODE === "test"`, so the string is fully absent from production (verified below).

## 5. Worn Hatchet Playwright tests (`apps/game/tests/worn-hatchet-interaction.spec.ts`)

- Correct IDs used throughout: world target `ground_worn_hatchet`, item `worn_hatchet`.
- Inventory read via `save.inventory.find((s) => s.itemId === itemId)?.quantity` (array of stacks), not object indexing.
- Fresh state: relies on Playwright's default per-test browser context isolation (new context ⇒ empty cookies/storage/IndexedDB) — no manual clearing code, so there is nothing to get wrong or leave unawaited.
- Uses the repo's existing `?e2e=1` convention (see `EscapeIntro.tsx`) to skip the one-time locked conversation modal that would otherwise intercept the very first pointer click. (This was the actual reason the first run of this repair's tests failed 2/2 collection scenarios — clicks were landing on the intro modal backdrop, not the canvas.)
- Desktop scenarios (`test.skip` unless `testInfo.project.name === "desktop"`) and the mobile scenario (`test.skip` unless `landscape-mobile`) run only in their intended project; skips are explicit, not silent.
- `page: Page` typed via `@playwright/test`; bridge typed via a local `ReadonlyTestBridge` interface declared on `Window` — no `any`.
- Runs against a dedicated `playwright.gate0.config.ts`, whose `webServer` starts `vite --mode test` on port 4312 so the read-only bridge compiles in without touching the main dev config.

**Result:** `pnpm --filter @everloom/game exec playwright test --config=playwright.gate0.config.ts` → **3 passed, 3 skipped (explicit, correct project), exit 0**, ~46–50s.

## 6. Production exclusions (fresh `dist/`, verified by `scripts/check-gate0-production-exclusions.mjs`)

| Check | Result |
|---|---|
| `VisualQAGallery` string in any `dist/assets/*.js` | **Absent** |
| `qa-gallery` string in any `dist/assets/*.css` | **Absent** |
| `__EVERLOOM_READONLY_TEST__` string in any `dist/assets/*.js` | **Absent** |
| `?qa=gallery` can render the gallery | Cannot — no JS chunk exists for the component to lazy-load (verified by chunk absence above; `App.tsx`'s `import.meta.env.DEV` guard around the `lazy()` import is also statically eliminated in a production build) |
| Legacy `__EVERLOOM_TEST__` string | **Present** (inert `delete` cleanup call only; pre-existing, out of scope — see §4) |

## 7. Reusable verification gate

`pnpm --filter @everloom/game verify:gate0` (`apps/game/scripts/verify-gate0.mjs`) runs, in order, and stops at the first failure: game unit tests → game typecheck → focused Worn Hatchet Playwright test → fresh game production build → production-exclusion assertions. **Ran end-to-end: exit 0.**

---

## Full verification (this repair session)

| # | Command | Exit code |
|---|---|---|
| 1 | `pnpm --filter @everloom/game verify:gate0` | 0 |
| 2 | `pnpm --filter @everloom/game test` | 0 (17/17) |
| 3 | focused Worn Hatchet Playwright test (standalone) | 0 (3 passed, 3 skipped) |
| 4 | `pnpm --filter @everloom/game typecheck` | 0 |
| 5 | `pnpm --filter @everloom/game build` | 0 (327.6 KiB / 400 KiB) |
| 6 | `pnpm test` (root, turbo) | 0 (10/10 tasks) |
| 7 | `pnpm typecheck` (root, turbo) | 0 (13/13 tasks) |
| 8 | `pnpm build` (root, turbo) | 0 (8/8 tasks) |
| 9 | `git diff --check` | 0 |
| 10 | `git status --short` | clean except pre-existing untouched `artifacts/*.png` (not staged, not committed) |

---

## Stage B

Not started. No landmark, particle, animation-event, or progression code exists on this branch.

---

**Gate 0 repaired and verified. Stage B not started.**
