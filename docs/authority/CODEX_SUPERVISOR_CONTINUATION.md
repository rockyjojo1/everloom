# Everloom Codex Supervisor Continuation

Last reviewed: 2026-08-03 (Australia/Brisbane)

Authority: This is the durable implementation-supervision handoff. It governs how the next high-reasoning supervisor should inspect, sequence, delegate, audit and verify work. Product strategy remains governed by the separate strategy authority supplied by the owner. If this document conflicts with current repository evidence, repository evidence wins and the discrepancy must be recorded.

## 1. Repository truth

### Verified facts

- Repository: `rockyjojo1/everloom`
- Implementation checkout inspected: `D:\Downloads\Everloom-codex-tutorial-continuation`
- Authoritative implementation branch at handoff: `claude/verdant-grove-vertical-slice`
- Last unaudited Verdant base: `aa91ef4`
- First Sonnet stabilisation commit: `bf1640186b6586a0cfaf49cd68020b0ff10000fa`
- Audited correction ending SHA: `a53e75201b6d1a60890d3a5adfa50e6f57548945`
- At the end of inspection, local `claude/verdant-grove-vertical-slice` and `origin/claude/verdant-grove-vertical-slice` both pointed to `a53e752`, with divergence `0 0` and a clean working tree.
- This continuation is published on the dedicated `docs/codex-supervisor-continuation` branch based on `a53e752`. The branch tip containing this document is the durable handoff commit and should be read directly from GitHub.
- Current authoritative application: `apps/game`, a React and Three.js browser/PWA client.
- Authoritative domain package: `packages/core`.
- Authoritative content package: `packages/content`.
- Authoritative asset registry/package: `packages/assets`.
- `apps/client3d`, `apps/web`, `packages/engine` and `packages/gamedata` still build, but they are legacy or alternate paths and are not the product implementation authority. They may contain reusable assets or ideas. Do not merge them wholesale.
- Save version: 6.
- Local persistence: IndexedDB through the `apps/game` store/save path.
- Cloud code: an optional Supabase client and account UI exist under `apps/game/src/cloud` and `apps/game/src/components/CloudAccount.tsx`. Only `.env.example` was present during inspection. No live cloud configuration or cross-device conflict safety was verified.
- The latest inspected GitHub commit status for `a53e752` was successful. Vercel reported `Deployment has completed` on 2026-08-03. There were no GitHub Actions workflow runs for the branch; Vercel was the only reported status/check provider.
- The previous commit `bf16401` had a failed Vercel deployment. Sonnet's follow-up commit `a53e752` corrected the remaining audit/document/manifest issues and deployed successfully.
- Protected user files: all existing files under `artifacts/phase-*`. Never overwrite, regenerate in place, delete, move, stage or revert them.
- Approved art references under `art-direction/reference-sheets/` are also not runtime assets and should not be rewritten casually.
- Visual baselines remain `PENDING, 0/10 captured`. The visual-foundation core verifier passes, but the full visual foundation is not complete.

### Verified commands at `a53e752`

- `pnpm --filter @everloom/core test`: 79 tests passed across three Vitest files.
- `pnpm --filter @everloom/game verify:gate0`: passed all five stages. It included 25 game unit tests, typecheck, three passing and three deliberately skipped focused Worn Hatchet Playwright variants, production build, bundle check and production exclusions.
- `pnpm --filter @everloom/game verify:visual-foundation`: all 15 core stages passed. It still reported 121 asset/scale/licence/reference warnings. The verifier explicitly reported `BASELINE STATUS: PENDING, 0/10 captured` and `FULL VISUAL FOUNDATION NOT YET COMPLETE`.
- `pnpm build`: eight workspace package builds succeeded. This command used Turbo cache for the inspected run. The legacy `apps/client3d` build emitted a chunk-size warning at roughly 713 KiB; the authoritative `apps/game` player entry bundle reported 329.0 KiB against its 400 KiB budget.
- The latest correction included valid underscore content identifiers, content validation coverage, truthful prototype documentation and explicit placeholder/provenance entries for Ironbark, Grove Wolf and Ironbark logs.

### Assumptions or unverified areas

- The deployed Vercel target appears to be named `everloom-web`, but deployment success does not prove the deployed route is the authoritative `apps/game` build. Confirm Vercel project root/output settings before treating deployment as product evidence.
- No physical iPhone build or run was verified.
- No Capacitor project was verified.
- No cloud-save race, stale revision or two-device resolution was verified.
- Asset licence claims in the manifest were not independently traced back to every original archive during this handoff.

## 2. Current product state

### What a player can currently do

Within the authoritative `apps/game` runtime, prior verified browser coverage supports the Meadowrest tutorial and existing interactions, including character creation, movement, Worn Hatchet pickup, gathering, progression, combat, facilities, the First Thread/Verdant Loomstone progression and existing offline gathering behavior. Gate 0's narrow browser proof currently protects only the Worn Hatchet interaction, not the whole product.

### Verdant Grove reality

Verdant Grove is a domain prototype, not a playable vertical slice.

- Domain code exists in `packages/core/src/expedition.ts` and `forecast.ts`.
- Save v6 contains `activeExpedition` and `claimedExpeditions` fields.
- Content records exist for `ironbark_tree`, `grove_wolf` and `log_ironbark`.
- A React `ExpeditionPanel` exists.
- `ExpeditionPanel` is not rendered by the runtime panel manager or HUD.
- The Ironbark world object is currently a normal resource interactable and does not launch the expedition workflow.
- The current 12 tests named `expedition-e2e.test.ts` are Vitest domain workflow tests, not browser end-to-end tests.
- No Playwright scenario covers starting, resuming, resolving or claiming a Verdant expedition.
- No physical iPhone test exists.
- No active-versus-batched deterministic differential test exists.
- No production-safe two-tab, crash-recovery or stale-device idempotency proof exists.
- No integrated return report exists.
- The current resolver still requires high-reasoning redesign before runtime wiring.

### Known resolver defects that remain after stabilisation

- `startExpedition` uses `Date.now()` and `Math.random()` to create an expedition ID.
- `resolveExpedition` uses `Date.now()` to create a claim ID.
- Reward idempotency is currently inferred from clearing `activeExpedition`; it is not protected by a stable receipt checked before application.
- The current tests do not prove duplicate safety from two copies of the same pre-resolution save.
- Food, stack limits, carrying capacity and retreat behavior need to use validated content and shared simulation semantics.
- Forecast configuration is duplicated from resolver constants and can drift.
- Event ordering is not represented by a bounded persisted event sequence.
- Current wolf combat is an aggregate approximation rather than reuse of the ordinary shared combat system.
- The panel's completion calculation was previously observed resolving remaining time rather than elapsed time. Do not wire it until the domain contract is corrected.

### Art state

- Most runtime art remains existing licensed low-poly material, procedural composition or explicit placeholder art.
- Generated reference sheets are visual direction, not deployable models, textures, rigs or animations.
- The current Ironbark tree reuses `nature.tree-detailed` as an explicit placeholder.
- Grove Wolf has no production quadruped asset. The manifest records a deliberately mismatched placeholder rather than pretending a wolf exists.
- Section 15 of the image reference set is deprecated as an implementation reference because it became too close to RuneScape's complete UI expression.

## 3. Intended supervision workflow

### Roles

**Codex high-reasoning supervisor**

- Establish repository truth before issuing work.
- Own task boundaries, deterministic-core contracts, save migrations, idempotency, conflict logic and final integration judgements.
- Inspect actual diffs and meaningful changed files.
- Run tests independently after Claude finishes.
- Verify runtime reachability, browser behavior and physical-device evidence separately.
- Pass or reject gates. The implementing model never passes its own major gate.

**Claude Sonnet 5 or stronger Claude implementation agent**

- Preferred over Haiku for any task with cross-file reasoning, repository archaeology or ambiguous integration.
- Implement bounded work packages with explicit files, behaviors, tests, non-goals and commit boundaries.
- May perform mechanical UI, content, metadata, fixtures, scripts and focused integration after the high-risk contract is settled.
- Must commit and push completed branches, report the exact remote SHA and never merge.

**Claude Haiku**

- Use only for low-ambiguity mechanical work after interfaces and acceptance tests are fixed.
- Do not ask Haiku to invent architecture, repair deterministic state machines, decide save semantics or declare a broad feature complete.
- The prior cost-saving strategy failed because repeated weak-model mistakes consumed more tokens through rework than a stronger first pass would have used.

**Owner**

- Owns taste, enjoyment, high-level balance choices, major visual approval and physical playtesting.
- Should not be expected to resolve engine architecture, migration or low-level save semantics.

**Strategy chat**

- Escalate engine migration, save-breaking architecture, multiplayer, monetisation, economy/combat redesign, new skills, art-pipeline replacement, paid services, platform changes or substantial active/AFK changes.

### Working principles

- Playable evidence outranks documentation.
- A build proves compilation, not runtime wiring.
- A unit test proves only the behavior actually exercised.
- Browser evidence and physical-device evidence are separate gates.
- Use one coherent work package at a time. Do not fill a prompt with unrelated future phases just to occupy a model.
- Fix root causes rather than weakening validators.
- Keep repository authority files short enough for cheap agents to read repeatedly.
- Use GitHub branches and exact SHAs as shared memory and audit evidence.
- Preserve player-facing momentum, but never trade away deterministic save correctness for a visually impressive disconnected prototype.
- Do not let infrastructure expand unless it prevents a demonstrated repeated failure.
- Every major branch must be committed and pushed before audit. Report local SHA, remote SHA and divergence.
- Merge only after an independent audit, required checks, runtime evidence and documentation-truth review.
- If a model says "complete", translate that into a list of independently provable claims and test each one.

## 4. Development sequence from here

### Work package 1: Repository authority spine

- Objective: Create the focused authority files required by the approved sequence and reconcile superseded documents.
- Why now: Cheap agents need short, stable source documents; the current strategy exists mainly in chat attachments and this continuation brief.
- Player-visible result: None, intentionally. This is a small governance gate and must not become a long documentation project.
- Prerequisites: `a53e752` verified and the continuation branch readable.
- Likely files: `AGENTS.md`, `docs/authority/CURRENT_STATE.md`, `PRODUCT.md`, `TECHNICAL_ARCHITECTURE.md`, `ART_PIPELINE.md`, `ASSET_SOURCES.md`, `VERDANT_GROVE.md`, `DECISIONS.md`, `RISKS.md`.
- Codex responsibility: Approve structure, eliminate contradictions and ensure current-state claims are evidence-based.
- Claude responsibility: Produce concise first drafts from existing authority and verified repository evidence.
- Acceptance: Each file states authority, last-reviewed date and superseded sources; no document claims a gameplay feature is complete; duplication is low.
- Tests: Markdown/link checks if available, `git diff --check`, root build only if code/config changes unexpectedly.
- Non-goals: No production code, asset download, new dashboard or design expansion.
- Escalate if: Authority sources contain a genuine product-strategy contradiction.

### Work package 2: Existing asset and provenance audit

- Objective: Inventory existing packs, canonical sources, licences, duplicates, rigs and animations before downloading anything.
- Why now: The platform bake-off needs representative real assets and the project repeatedly loses tokens rediscovering them.
- Player-visible result: None yet; it prevents another generic-placeholder pass.
- Prerequisites: Work package 1 accepted.
- Likely files: `packages/assets`, legacy `apps/client3d` assets, licence files, visual manifest, `docs/authority/ASSET_SOURCES.md`.
- Codex responsibility: Approve provenance categories and reject unsupported licence claims.
- Claude responsibility: Read-only audit plus a minimal source registry using existing evidence.
- Acceptance: Every candidate used in the bake-off has a source, licence evidence, local path and status; no pack is redownloaded or declared production-ready without proof.
- Tests: Existing asset validation and catalogue commands; no missing canonical paths.
- Non-goals: No scraping, mass downloads, AI 3D production or bulk branch merge.
- Escalate if: Licence is unclear or a paid source appears necessary.

### Work package 3: Minimal asset-access tooling

- Objective: Make approved existing assets easy to list, validate and inspect without expanding the workbench into a product.
- Why now: It turns the provenance audit into a repeatable workflow.
- Player-visible result: Faster production asset replacement later.
- Prerequisites: Work package 2 accepted.
- Likely files: asset scripts, source registry, existing dev Asset Browser/workbench.
- Codex responsibility: Decide whether existing tools already suffice and block redundant infrastructure.
- Claude responsibility: Add only missing commands/filters and behavioral tests.
- Acceptance: A new agent can identify an asset, licence, source and runtime ID with one documented path.
- Tests: asset catalogue build/validation, focused script tests, production exclusion check.
- Non-goals: No asset downloads or visual redesign.
- Escalate if: Tooling would require a new service or major dependency.

### Work package 4: Browser/mobile production-room bake-off

- Objective: Build one reusable Meadowrest room using representative production assets, touch input, pathfinding, player, Mara, one wolf placeholder/asset, Worn Hatchet, water, shadows and low-spec mode.
- Why now: Prove the rendering and content pipeline before investing further in Verdant gameplay.
- Player-visible result: A cohesive representative area that remains part of the game.
- Prerequisites: Asset access accepted; representative assets selected with provenance.
- Likely files: `apps/game/src/world`, asset mappings, touch UI, performance instrumentation, Playwright fixtures.
- Codex responsibility: Set performance measurement contract and audit lifecycle.
- Claude responsibility: Mechanical room composition, touch integration, tests and capture paths.
- Acceptance: Desktop and mobile-emulated browser flow works; no continuous memory growth in a measured browser session; all assets have provenance.
- Tests: focused Playwright desktop/mobile, lifecycle checks, bundle, Gate 0, root build.
- Non-goals: No complete region, engine migration or custom art campaign.
- Escalate if: Current stack shows a structural performance or input blocker.

### Work package 5: Capacitor and physical-iPhone bake-off

- Objective: Wrap the authoritative game for iPhone and measure a representative 20-minute physical-device session.
- Why now: iPhone is the primary platform and the current engine decision is conditional on this evidence.
- Player-visible result: A real installable iPhone build with correct safe areas, touch and background/resume.
- Prerequisites: Work package 4 passes browser gates; owner has the device and signing/build access.
- Likely files: Capacitor config, iOS shell, build documentation, device evidence record.
- Codex responsibility: Define measurements and interpret structural failures.
- Claude responsibility: Bounded Capacitor configuration and build documentation.
- Acceptance: Sustained provisional 30 FPS, stable memory, reliable touch, correct background/resume and no duplicate/lost activity.
- Tests: Browser regression plus actual device record. Emulation cannot substitute for physical evidence.
- Non-goals: App Store submission, Android or engine migration.
- Escalate if: Structural failure suggests Godot fallback evaluation.

### Work package 6: Deterministic expedition contract and pure resolver redesign

- Objective: Replace the current expedition prototype with an injected-input, event-driven deterministic resolver.
- Why now: Only after the platform survives the bake-off should the product-thesis loop be integrated.
- Player-visible result: Reliable preparation-driven expedition outcomes.
- Prerequisites: Current stack locked by bake-off; authoritative Verdant contract accepted.
- Likely files: `packages/core/src/expedition*`, RNG, ordinary combat/gathering primitives, content definitions.
- Codex responsibility: Implement or directly supervise the high-risk core, including identity, time, versioning and ordering.
- Claude responsibility: Fixtures and mechanical tests only after interfaces are fixed.
- Acceptance: No ambient time/random reads; explicit event priority; one-shot and chunked results match; active and offline commands use the same reducer.
- Tests: Golden determinism, differential chunking, boundary timestamps, corrupted inputs, long elapsed bounds.
- Non-goals: UI, cloud, durability or new enemies.
- Escalate if: A save-breaking state representation is required beyond the approved architecture.

### Work package 7: Receipt-based idempotency and save migration

- Objective: Persist stable expedition identity, resolved-through state, outcome hash and immutable application receipt.
- Why now: Runtime wiring without this would risk duplicated or lost progress.
- Player-visible result: Refresh, crash and repeated acknowledgement cannot change rewards.
- Prerequisites: Work package 6 deterministic result format accepted.
- Likely files: core save types/migration, local store/checkpoint logic, expedition receipt tests.
- Codex responsibility: Own migration and race semantics.
- Claude responsibility: Fixtures and bounded UI-free tests.
- Acceptance: Two copies of one checkpoint cannot both apply rewards; acknowledgement is separate from reward application; old saves migrate losslessly.
- Tests: duplicate apply, crash windows, two-tab simulation, stale revision, corrupted receipt, version conflict.
- Non-goals: Full Supabase conflict resolution.
- Escalate if: Existing save architecture cannot support safe receipts without a breaking redesign.

### Work package 8: World-to-panel integration and return report

- Objective: Make the corrected Ironbark expedition physically discoverable and runtime reachable.
- Why now: Domain and save guarantees must exist before UI wiring.
- Player-visible result: Walk to Ironbark, configure, start, leave/return and understand the outcome.
- Prerequisites: Work packages 6 and 7 accepted.
- Likely files: world interaction dispatch, store, HUD/panel manager, `ExpeditionPanel`, return report, styles.
- Codex responsibility: Audit wiring and save boundaries.
- Claude responsibility: React UI and mechanical integration against fixed APIs.
- Acceptance: No remote undiscovered start; settings are the approved bounded choices; every stop reason is readable; keyboard and touch work.
- Tests: component behavior and real Playwright world flow.
- Non-goals: UI imitation of RuneScape, broad HUD redesign or additional expedition types.
- Escalate if: A major UI composition change is proposed.

### Work package 9: Active/offline browser differential and owner playtest

- Objective: Prove active and resumed resolution agree, then test whether the loop is enjoyable.
- Why now: This is the actual product-thesis gate.
- Player-visible result: Trustworthy offline continuity and actionable reports.
- Prerequisites: Work package 8 runtime reachable.
- Likely files: Playwright fixtures, IndexedDB helpers, lifecycle/checkpoint logic, tuning content.
- Codex responsibility: Independently run browser tests and separate technical success from enjoyment.
- Claude responsibility: Test implementation and narrow defect fixes.
- Acceptance: Desktop and landscape-mobile browser paths pass; refresh cannot reroll or duplicate; owner can explain stop reason and wants to adjust preparation and repeat.
- Tests: active/batched differential, close during gathering/combat, duration boundary, inventory fill, food reserve, clock anomalies, repeated report acknowledgement.
- Non-goals: Cloud sync, more skills, more regions or rare variants.
- Escalate if: Playtesting indicates the encounter/preparation thesis is not compelling.

## 5. Immediate next task

The next task is the brief repository authority spine described in work package 1.

It is next because the strategy authority currently lives largely in chat attachments and this continuation branch. Stronger Claude use reduces reasoning errors, but every agent still needs concise repository-local authority to avoid repeated context and false completion. This task should be delegated to Sonnet, then audited by Codex. It must remain small and must not delay the asset audit.

Do not begin the platform room, deterministic resolver redesign, Supabase work or Verdant runtime integration until this gate is accepted.

Evidence required before moving on:

- all focused authority files exist and do not contradict one another;
- current-state claims cite repository commands or exact source paths;
- superseded documents are identified;
- no production code changed;
- branch is committed, pushed and remote SHA verified;
- Codex independently reviews the diff.

## 6. Exact next Claude prompt

```text
You are completing Everloom Gate 1 only: the concise repository authority spine.

REPOSITORY

D:\Downloads\Everloom-codex-tutorial-continuation

REMOTE

rockyjojo1/everloom

BASE BRANCH AND SHA

Base from the latest remote `claude/verdant-grove-vertical-slice` only after verifying that it contains:

a53e75201b6d1a60890d3a5adfa50e6f57548945

Create and work on:

claude/authority-spine

Do not work on a stale local branch. Fetch first, verify the remote SHA and report divergence. If the remote implementation branch has advanced, inspect the additional commits and stop if they materially change the authority facts below.

OBJECTIVE

Create the small set of focused, repository-local authority files required for later low-token implementation prompts. This is a documentation and repository-governance task only.

Do not implement gameplay, assets, platform wrappers, cloud behavior or visual changes.

READ BEFORE EDITING

- AGENTS.md
- docs/authority/CODEX_SUPERVISOR_CONTINUATION.md from the remote `docs/codex-supervisor-continuation` branch
- docs/VERDANT_GROVE_STATUS.md
- docs/VERDANT_GROVE_VERTICAL_SLICE.md
- docs/VERDANT_GROVE_HANDOFF.md
- apps/game/package.json
- root package.json
- apps/game/src/App.tsx
- apps/game/src/game/store.ts
- apps/game/src/cloud/cloud.ts
- packages/core/src/types.ts
- packages/core/src/save.ts
- packages/core/src/expedition.ts
- packages/core/src/forecast.ts
- packages/content/src/index.ts
- packages/assets/package.json
- art-direction/visual-production-manifest.json
- art-direction/reference-sheets/reference-sheet-status.json or its actual status file

REQUIRED FILES

Create or update:

- docs/authority/CURRENT_STATE.md
- docs/authority/PRODUCT.md
- docs/authority/TECHNICAL_ARCHITECTURE.md
- docs/authority/ART_PIPELINE.md
- docs/authority/ASSET_SOURCES.md
- docs/authority/VERDANT_GROVE.md
- docs/authority/DECISIONS.md
- docs/authority/RISKS.md

Keep each file focused. Do not paste the entire continuation brief into them.

EVERY FILE MUST

- contain `Last reviewed: 2026-08-03` or the actual current date;
- state what it governs;
- identify its source authority;
- link to related authority files instead of duplicating them;
- identify superseded or non-authoritative historical documents where relevant;
- distinguish verified facts, settled decisions, provisional decisions and unresolved evidence;
- avoid claiming implementation completion from plans, tests or file existence.

CONTENT CONTRACT

CURRENT_STATE.md

- Verified repository facts only.
- `apps/game` is authoritative.
- `packages/core`, `packages/content` and `packages/assets` are authoritative packages.
- Save version is 6.
- Verdant Grove is a domain prototype and is not runtime reachable.
- Gate 0, visual-foundation core checks and root build passed at `a53e752`.
- Visual baselines remain pending 0/10.
- Latest Vercel deployment at `a53e752` succeeded, but this does not prove the deployed root is `apps/game`.
- No physical iPhone test or Capacitor proof exists.
- Cloud code exists but production cloud safety is unverified.

PRODUCT.md

- Expedition planner first, account builder second, active adventurer third.
- iPhone-first, browser mandatory, AFK-first internally.
- Activities begin physically in an authored world.
- Six fixed initial skills: Woodcutting, Mining, Fishing, Cooking, Smithing, Melee.
- Solo through first public release.
- Respectful retention, no energy, streaks, loot boxes or paid offline time.
- Original Everloom expression with strong old-school point-and-click MMORPG readability, without copying Jagex assets or complete UI expression.

TECHNICAL_ARCHITECTURE.md

- Current conditional stack: TypeScript, React, Three.js, Vitest, Playwright, IndexedDB/PWA.
- Deterministic domain separate from rendering.
- Capacitor is proposed for iPhone but unproven.
- Godot/GDScript is only a strategy-chat fallback if the physical bake-off finds a structural blocker.
- State and test evidence required before any engine migration.

ART_PIPELINE.md

- Blender, GLB/glTF, shared material atlases where practical, automated validation and provenance.
- Generated reference images are concepts, not production assets.
- Section 15 is deprecated as an implementation reference.
- Existing approved/CC0 assets are preferred for generic environment pieces.
- Signature assets require custom or substantially transformed work.
- No paid or unclear-licence source without owner and strategy approval.

ASSET_SOURCES.md

- Define the approved source hierarchy and provenance fields.
- Do not claim every existing asset licence has been reverified.
- Point to the current manifest and licence evidence.
- State that the next gate is a read-only existing-asset/provenance audit before any downloads.

VERDANT_GROVE.md

- Summarise the approved target contract, not the broken prototype implementation.
- Link to the detailed vertical-slice contract.
- State the current blocker list: deterministic identity/time, receipt idempotency, food/inventory semantics, event ordering, shared combat/gathering rules, world/panel integration, browser tests, physical iPhone evidence and owner enjoyment.
- Preserve the approved first-slice configuration and explicitly deferred scope.

DECISIONS.md

- Separate Settled, Provisional, Unresolved and Deferred.
- Include triggers for revisiting provisional decisions.
- Do not reopen settled product choices.

RISKS.md

- Record current risks: weak-agent false completion, duplicate rewards, save corruption, platform failure, asset provenance, placeholder sprawl, OSRS-expression overreach, infrastructure sprawl, cloud conflict and content burden.
- Include warning sign, mitigation and escalation owner.

AGENTS.MD

Review the existing root AGENTS.md. Make only minimal changes needed to link the new authority files. Do not duplicate their content.

PROHIBITED

- No production source changes.
- No package or lockfile changes.
- No build configuration changes.
- No asset downloads.
- No asset movement.
- No generated art.
- No Verdant engine repair.
- No Capacitor setup.
- No Supabase change.
- No new dashboards or status frameworks.
- No changes under `artifacts/phase-*`.
- No changes to reference PNGs.
- No merging.

VALIDATION

Run:

- git diff --check
- git status --short
- verify every Markdown link you add resolves to a tracked repository path
- pnpm build only if any non-Markdown/config file changes unexpectedly; otherwise state that no production build was needed because the diff is documentation-only

Before committing, prove the diff contains only:

- the eight authority files
- a minimal AGENTS.md link update, if required

COMMIT AND PUSH

Commit subject:

Establish Everloom authority spine

Push `claude/authority-spine` to origin.

Do not merge and do not open a ready-for-review PR.

After pushing, verify:

- local HEAD
- `origin/claude/authority-spine` SHA
- divergence is `0 0`
- final working tree is clean

FINAL RESPONSE

Report:

- starting branch and SHA
- ending branch and SHA
- verified remote SHA
- changed files
- link-validation evidence
- exact commands and exit codes
- any unresolved authority contradiction
- protected files untouched
- explicit statement: `NO PRODUCTION CODE CHANGED`

Claude does not pass Gate 1. Codex will independently inspect and accept or reject it.
```

## 7. Following two task prompts

### Draft task after Gate 1: Existing asset and provenance audit

Gate required: Codex accepts `claude/authority-spine` and confirms no product-code changes.

Contract: On a new branch from the accepted authority base, inventory existing asset directories, licences, manifests, rigs, animation clips and duplicates across authoritative and legacy paths. Create the minimal source registry using only evidence already present. Do not download, move or reclassify assets as production-ready. Run current asset catalogue and validation commands. Commit and push an audit branch for independent review.

### Draft task after asset audit: Minimal asset-access workflow

Gate required: Codex accepts provenance audit and every representative bake-off asset has a known source/licence status.

Contract: Reuse existing asset catalog, Asset Browser and visual workbench. Add only the smallest missing list/validate/filter path required for an agent or human to find a runtime ID, source, licence and status. No large UI, scraping, downloads or automatic production approval. Add behavioral script tests, verify production exclusion, commit and push for audit.

## 8. Technical concerns requiring high-reasoning review

### Deterministic active/offline resolver

- Current defect: Aggregate resolver reads ambient time/random for identity and lacks differential active/offline proof.
- Why it matters: The core product promise depends on stable results across absence, refresh and device lifecycle.
- Likely direction: Inject time, identity and seed; use one explicit event reducer for active and batched resolution.
- Do not delegate blindly: State-machine design, event priority, versioning and chunk equivalence.
- Evidence to close: Golden results plus one-shot/chunked and active/offline differential tests.

### Stable expedition identity and receipt idempotency

- Current defect: Time-based claim IDs and cleared-state checks do not protect two copies of the same checkpoint.
- Why it matters: Duplicate rewards destroy trust and later cloud safety.
- Likely direction: Stable expedition ID, deterministic outcome/receipt ID, atomic local application marker and separate report acknowledgement.
- Do not delegate blindly: Crash windows, two-tab semantics and stale revisions.
- Evidence to close: Duplicate application, retry, crash and stale-copy tests.

### Save migration

- Current uncertainty: v6 migration exists, but future resolver state likely needs additional versioned fields.
- Why it matters: Existing progress must survive.
- Likely direction: Additive explicit migration with real legacy fixtures and corruption rejection.
- Do not delegate blindly: Breaking field replacement or silent defaults.
- Evidence: Lossless fixtures across supported versions and round-trip invariants.

### Food and inventory semantics

- Current defect: Prototype behavior does not yet reliably reuse validated food categories, stack limits and carrying rules.
- Why it matters: Preparation-driven endurance is the main game thesis.
- Likely direction: Shared content-driven inventory operations and deterministic smallest-safe-food auto-eat above reserve.
- Do not delegate blindly: Stack overflow, reserve rules, final-slot boundary and reward application.
- Evidence: Multiple food types, stack boundaries, reserve and inventory-full tests.

### Event ordering

- Current defect: No bounded persisted event sequence or authoritative same-timestamp reducer exists.
- Why it matters: Chunking and resume can diverge at boundaries.
- Likely direction: Explicit priority queue/reducer using the approved ordering.
- Do not delegate blindly: Timestamp boundary rules.
- Evidence: Same-time combat/gather/duration fixtures with identical batched outcomes.

### World-to-panel integration

- Current defect: Panel exists but has no runtime caller; world resource interaction does not start expedition.
- Why it matters: The physical world must remain causally important.
- Likely direction: Typed world command opens bounded configuration panel only when physically eligible.
- Do not delegate blindly: Store ownership and save checkpoints.
- Evidence: Real Playwright path from world discovery to persisted start.

### Return-report architecture

- Current defect: No integrated immutable report or separation between reward application and acknowledgement.
- Why it matters: Players must understand why a run stopped without creating duplicate claim paths.
- Likely direction: Persist outcome receipt, apply once, display/acknowledge separately.
- Evidence: Reload before/after acknowledgement produces identical inventory and XP.

### Browser lifecycle

- Current uncertainty: Existing background/offline gathering is useful precedent, but expedition close-during-combat behavior is unproven.
- Why it matters: iPhone will suspend the app routinely.
- Likely direction: Checkpoint on lifecycle events and resolve elapsed time from persisted bounds.
- Evidence: Playwright/browser lifecycle plus physical-device background/resume.

### Asset pipeline

- Current uncertainty: Many assets exist, but provenance and production readiness are uneven; signature assets are missing.
- Why it matters: Visual quality requests cannot be solved by reference sheets alone.
- Likely direction: Blender/GLB pipeline, minimal registry, existing CC0 generic assets and custom signature assets.
- Do not delegate blindly: Licence approval and signature visual acceptance.
- Evidence: Source/licence record plus validated GLB and gameplay capture.

### Physical iPhone bake-off

- Current uncertainty: No real device evidence.
- Why it matters: iPhone is priority one and engine retention is conditional.
- Likely direction: Representative reusable room, Capacitor wrapper and measured 20-minute session.
- Evidence: Device/iOS/build/scene/settings, sustained FPS, frame behavior, memory, startup, background/resume and touch results.

### Cloud conflicts

- Current defect: Optional Supabase upload/download exists, but revision conflict and receipt safety are unverified.
- Why it matters: Cross-device continuity is a public-release requirement.
- Likely direction: Defer until local resolver/receipt model is correct, then add revision-aware writes and explicit conflict UI.
- Do not delegate blindly: Last-write-wins and silent overwrite behavior.
- Evidence: Two-device stale-revision and failed-write recovery tests.

## 9. Decisions already made

### Settled

- Expedition planner is the primary fantasy; account builder second; active adventurer third.
- AFK-first is the internal framing, with activities physically established in the world.
- iPhone is priority one; browser remains mandatory; desktop remains strong.
- Active and offline play share one deterministic domain model.
- Combat remains simple point-and-click auto-combat.
- First six skills are Woodcutting, Mining, Fishing, Cooking, Smithing and Melee.
- Ordinary retreat preserves equipment, earned XP and earned resources.
- Single-player through first public release.
- Current TypeScript/React/Three.js stack stays pending the physical bake-off.
- Capacitor is the proposed iPhone wrapper.
- Godot/GDScript is only the fallback prototype after strategy escalation.
- Original Everloom expression may strongly target OSRS-like readability and interaction grammar, but must not copy protectable Jagex expression.
- Blender and GLB/glTF are the target art pipeline.
- Generated images are references, not production assets.
- Stronger Claude models are preferred when their better reasoning avoids repeated rework. Haiku is restricted to low-ambiguity work.

### Provisional

- Landscape is the primary iPhone gameplay orientation.
- Physical-device pass floor is sustained 30 FPS for a representative 20-minute session.
- Skill cap may be 99.
- One familiarity value per region initially.
- Verdant numerical tuning bands and encounter schedule.
- Eventual cloud provider and conflict protocol.
- Three or four regions and possibly one boss/delve for first public release.

### Unresolved

- Whether the Vercel project actually deploys `apps/game` rather than a legacy app.
- Whether the current stack passes the physical iPhone bake-off.
- Exact asset provenance coverage and signature-asset production route.
- Final deterministic expedition state/receipt representation.
- Final public monetisation.
- Whether Verdant preparation/encounter behavior is genuinely enjoyable.

### Deferred

- Additional skills, pets, prestige, durability, ordinary equipment/resource loss, offline dungeons, free-form camps, regional talent trees, procedural world generation, more Grove enemy types, elaborate combat abilities, social features, multiplayer, trading, player economy, guilds, housing, seasons, localisation, mod support, live events and extensive bespoke animation.

### Forbidden before private alpha unless strategy explicitly reopens

- MMO architecture, server-authoritative shared-world combat, player trading/economy, loot boxes, paid progression, paid offline time, energy systems, compulsory streaks, destructive routine failure, engine migration without bake-off evidence and unclear-licence production assets.

## 10. Audit checklist for the next supervisor

1. Fetch origin and record local branch, local SHA, remote SHA, divergence, status, worktrees and stashes.
2. Read this continuation from `docs/codex-supervisor-continuation` and inspect implementation branch commits after `a53e752`.
3. Compare every delegated branch against its stated base, not against an arbitrary local checkout.
4. Inspect every changed file containing logic, schemas, save fields or asset metadata.
5. Run the exact package tests claimed by the implementer.
6. Run `pnpm --filter @everloom/game verify:gate0` for product foundation changes.
7. Run `pnpm --filter @everloom/game verify:visual-foundation` for visual/asset changes and preserve the baseline-pending distinction.
8. Run `pnpm build` when workspace-wide compatibility matters; distinguish it from a filtered package build and note Turbo cache use.
9. List Playwright scenarios before accepting an “E2E” claim; confirm a real browser process and production path are exercised.
10. Trace runtime callers. A component or function with no caller is not integrated.
11. Check save migrations with real old-version fixtures and verify no silent data loss.
12. Search deterministic core for `Date.now`, `new Date`, `Math.random` and ambient mutable state.
13. Test duplicate reward application from two copies of the same checkpoint.
14. Verify asset source, licence evidence, local path and runtime mapping. Generated concept art is not provenance.
15. Confirm no `artifacts/phase-*` or approved reference PNG was altered.
16. Compare documentation claims against code and test evidence.
17. Check GitHub commit status, Vercel/CI failures and remote SHA before approval.
18. Reject scope additions that leapfrog the mandatory gate sequence.
19. Do not merge. Recommend merge only after independent acceptance and owner approval where required.

## 11. Known disagreements or judgement calls

### Haiku versus stronger Claude

The owner originally chose Haiku to reduce token cost. Repeated false completion, disconnected UI, invalid content IDs, weak tests and fabricated confidence created more total work. The supervision judgement is that Sonnet 5 or a comparable reasoning model is cheaper for cross-file or ambiguous implementation, even at a higher per-turn cost. Haiku remains useful only when the contract is mechanical and narrow.

### Claude completion claims versus repository evidence

Claude originally called Verdant Grove feature-complete. Codex found Gate 0 failure, visual integration failure, no runtime caller, no browser tests, nondeterministic identity, weak idempotency, invalid food semantics and incorrect capacity/retreat behavior. That completion claim was rejected.

Sonnet's `bf16401` stabilisation was materially better: it repaired identifiers, content validation and truthful status. A final post-audit correction `a53e752` added explicit visual placeholders/provenance and corrected remaining test/document claims. That work is accepted as stabilisation only, not as a Verdant gameplay gate.

### Build success versus runtime validity

The game package build passed even when content validation previously failed through another import path. Therefore build success alone is insufficient. Gate 0 and validated-content construction remain required.

### Unit “E2E” versus browser E2E

The file named `expedition-e2e.test.ts` runs under Vitest without a browser. It is useful domain workflow coverage but must never be cited as browser proof.

### Immediate Verdant repair versus platform bake-off

Two plausible paths existed: immediately redesign and integrate Verdant, or first prove the iPhone/rendering/asset pipeline. The approved strategy chooses the authority and asset gates, then the physical bake-off, before full Verdant integration. The current prototype is preserved but paused. This avoids polishing a product thesis on a stack that has never run on the primary device.

### Visual infrastructure versus production art

The manifest/workbench/verifier now protects truth, but continued dashboard and pipeline expansion has diminishing value. The next visual work must improve asset accessibility and deliver representative production assets, not create more reporting layers.

### Supabase now versus later

Cloud code exists, but adding expedition cloud sync now would amplify duplicate/revision risks. Local deterministic receipts and lifecycle behavior must be correct first.
