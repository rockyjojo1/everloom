# Everloom repository operating rules

Repository authority and continuation context live under `docs/authority/`. Read `docs/authority/CODEX_SUPERVISOR_CONTINUATION.md` before issuing or reviewing major work, then verify its repository facts against the current branch and remote.

- No implementing agent may pass its own major gate. A separate high-reasoning supervisor must inspect the diff, run the relevant checks and verify runtime reachability.
- Completed implementation branches must be committed and pushed for independent audit. Report the local SHA, remote SHA and divergence. Do not merge unless explicitly authorised after audit.
- Distinguish filtered package checks from the root monorepo build. Report which command ran, whether Turbo used cache, and any warnings.
- Report GitHub, Vercel or CI failure explicitly. A successful local build does not override a failed remote status.
- Never modify, stage, delete, move, regenerate or revert user-owned files under `artifacts/phase-*`.
- Reference images under `art-direction/reference-sheets/` are design references, not runtime assets. Do not overwrite them or claim they are implemented art.
- Documentation, schemas, test files, screenshots and clean Git status are not by themselves proof of a playable feature.
