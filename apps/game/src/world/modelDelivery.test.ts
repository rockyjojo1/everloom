// Runtime delivery proof: the authoritative apps/game dev server actually
// serves real model bytes from the canonical packages/assets/models root
// through the shared-model-library Vite plugin. This is delivery proof, not
// visual-quality or production-art approval.
//
// Uses Vite's own Node API in middleware mode — no new server framework.
import { createServer, type ViteDevServer } from "vite";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import http from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MODEL_ROOT } from "../../../../packages/assets/paths.mjs";
import { ASSET_REGISTRY } from "@everloom/assets/runtime";

let vite: ViteDevServer;
let server: http.Server;
let baseUrl: string;

beforeAll(async () => {
  vite = await createServer({
    root: resolve(__dirname, "../../"),
    server: { middlewareMode: true },
    appType: "custom",
    logLevel: "silent",
  });
  server = http.createServer(vite.middlewares);
  await new Promise<void>((resolveReady) => server.listen(0, "127.0.0.1", resolveReady));
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : 0;
  baseUrl = `http://127.0.0.1:${port}`;
}, 20_000);

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  await vite.close();
});

describe("apps/game model delivery from the canonical packages/assets/models root", () => {
  it("returns 200 with GLB content type and non-empty bytes for a registered model", async () => {
    const sourceFile = ASSET_REGISTRY["player.adventurer"]!.sourceFile;
    const response = await fetch(`${baseUrl}/models/${sourceFile}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("model/gltf-binary");
    const buf = Buffer.from(await response.arrayBuffer());
    expect(buf.length).toBeGreaterThan(0);
  });

  it("served bytes match the canonical source file hash exactly", async () => {
    const sourceFile = ASSET_REGISTRY["nature.oak"]!.sourceFile;
    const response = await fetch(`${baseUrl}/models/${sourceFile}`);
    const served = Buffer.from(await response.arrayBuffer());
    const canonical = await readFile(resolve(MODEL_ROOT, sourceFile));
    expect(createHash("sha256").update(served).digest("hex")).toBe(
      createHash("sha256").update(canonical).digest("hex"),
    );
  });

  it("returns a 404-equivalent (falls through, no file served) for a missing asset path", async () => {
    const response = await fetch(`${baseUrl}/models/kenney-nature/definitely-does-not-exist.glb`);
    // The plugin calls next() for a missing file; Vite's own 404 handler then applies.
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it("rejects a path-traversal request instead of serving a file outside the model root", async () => {
    const response = await fetch(`${baseUrl}/models/${encodeURIComponent("../../../../package.json")}`);
    expect(response.status).toBeGreaterThanOrEqual(400);
    const contentType = response.headers.get("content-type") ?? "";
    expect(contentType).not.toBe("application/json");
  });

  it("serves at least one environment (non-character) model with correct content type", async () => {
    const sourceFile = ASSET_REGISTRY["nature.bridge"]!.sourceFile;
    const response = await fetch(`${baseUrl}/models/${sourceFile}`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("model/gltf-binary");
  });
});
