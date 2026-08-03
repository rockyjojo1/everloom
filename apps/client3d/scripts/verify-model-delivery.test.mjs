// Runtime delivery proof for the legacy apps/client3d app: it consumes the
// authoritative packages/assets/models root (it does not own a second copy)
// and can still serve real model bytes through its own dev server. Node's
// built-in test runner + Vite's own Node API — no new dependency, no new
// server framework.
import { test, before, after } from "node:test";
import { strict as assert } from "node:assert";
import { createServer } from "vite";
import http from "node:http";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { MODEL_ROOT } from "../../../packages/assets/paths.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

let vite;
let server;
let baseUrl;

before(async () => {
  vite = await createServer({
    root: appRoot,
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  server = http.createServer(vite.middlewares);
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const address = server.address();
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  await new Promise((r) => server.close(() => r()));
  await vite.close();
});

test("apps/client3d dev server serves a known model from the canonical packages/assets/models root", async () => {
  const response = await fetch(`${baseUrl}/models/kaykit-adventurers/Character.glb`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "model/gltf-binary");
  const served = Buffer.from(await response.arrayBuffer());
  assert.ok(served.length > 0);
  const canonical = await readFile(resolve(MODEL_ROOT, "kaykit-adventurers/Character.glb"));
  assert.equal(
    createHash("sha256").update(served).digest("hex"),
    createHash("sha256").update(canonical).digest("hex"),
  );
});

test("apps/client3d has no private duplicate model tree of its own", async () => {
  const { existsSync } = await import("node:fs");
  assert.equal(existsSync(resolve(appRoot, "public/models")), false,
    "apps/client3d/public/models must not exist — the canonical root is packages/assets/models only");
});
