// Reusable, fail-fast Gate 0 verification for future agent runs. Does not
// duplicate test logic — it only sequences the real commands and stops at
// the first non-zero exit code.
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));

function run(label, command, args) {
  console.log(`\n=== ${label} ===`);
  const result = spawnSync(command, args, { cwd: appRoot, stdio: "inherit", shell: true });
  if (result.status !== 0) {
    console.error(`\nGate 0 verification FAILED at: ${label} (exit ${result.status})`);
    process.exit(result.status ?? 1);
  }
}

run("1/5 game unit tests", "pnpm", ["run", "test"]);
run("2/5 game typecheck", "pnpm", ["run", "typecheck"]);
run("3/5 focused Worn Hatchet Playwright test", "pnpm", ["exec", "playwright", "test", "--config=playwright.gate0.config.ts"]);
run("4/5 fresh game production build", "pnpm", ["run", "build"]);
run("5/5 production-exclusion assertions", "node", ["scripts/check-gate0-production-exclusions.mjs"]);

console.log("\nGate 0 verification passed: all five checks exited 0.");
