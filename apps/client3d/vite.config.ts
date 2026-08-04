import path from "path";
import fs from "fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { MODEL_ROOT, resolvePathWithinRoot } from "../../packages/assets/paths.mjs";

// packages/assets owns the canonical tracked model-binary root. This legacy
// app consumes it — it does not own a second copy under its own public/.
// See packages/assets/paths.mjs.
const modelRoot = MODEL_ROOT;

function assertCanonicalModelRootPopulated(): void {
  if (!fs.existsSync(modelRoot) || !fs.statSync(modelRoot).isDirectory()) {
    throw new Error(
      `everloom-shared-model-library (client3d): canonical model root not found at ${modelRoot}.`,
    );
  }
  if (fs.readdirSync(modelRoot).length === 0) {
    throw new Error(
      `everloom-shared-model-library (client3d): canonical model root ${modelRoot} is empty.`,
    );
  }
}

function sharedModelLibrary(): Plugin {
  return {
    name: "everloom-shared-model-library-client3d",
    configureServer(server) {
      assertCanonicalModelRootPopulated();
      server.middlewares.use("/models", (request, response, next) => {
        try {
          const relativePath = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname)
            .replace(/^\/+/, "");
          let file: string;
          try {
            file = resolvePathWithinRoot(modelRoot, relativePath, { allowRoot: false });
          } catch {
            return next(); // invalid or escaping path: fall through, never serve it
          }
          if (!fs.existsSync(file) || !fs.statSync(file).isFile()) return next();
          const type = path.extname(file) === ".glb" ? "model/gltf-binary" : "model/gltf+json";
          response.writeHead(200, { "content-type": type, "cache-control": "public, max-age=3600" });
          fs.createReadStream(file).pipe(response);
        } catch {
          next();
        }
      });
    },
    writeBundle(options) {
      assertCanonicalModelRootPopulated();
      const outputDirectory = typeof options.dir === "string" ? options.dir : path.resolve(__dirname, "dist");
      const destination = path.resolve(outputDirectory, "models");
      fs.cpSync(modelRoot, destination, { recursive: true });
      if (!fs.existsSync(destination) || fs.readdirSync(destination).length === 0) {
        throw new Error(
          `everloom-shared-model-library (client3d): copy to ${destination} produced an empty directory.`,
        );
      }
    },
  };
}

/**
 * Screenshot sink (DEV ONLY).
 *
 * Proof images cannot be returned through a model's tool output — base64 of any
 * real image exceeds the output limit and arrives truncated, producing JPEGs
 * with a valid SOI and no EOI. Every capture attempt was corrupted in transit.
 *
 * So the browser POSTs the data URL straight to the dev server, which writes the
 * file to disk. The image bytes never pass through a model. Full fidelity, and
 * the reviewer just opens the file.
 *
 * Usage from the page:  await window.__shot('name')
 */
function screenshotSink(): Plugin {
  return {
    name: "everloom-screenshot-sink",
    apply: "serve",
    configureServer(server) {
      const outDir = path.resolve(__dirname, "proof");
      server.middlewares.use("/__shot", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          return res.end("POST only");
        }
        const chunks: Buffer[] = [];
        req.on("data", (c) => chunks.push(c as Buffer));
        req.on("end", () => {
          try {
            const { name, dataUrl } = JSON.parse(Buffer.concat(chunks).toString("utf8"));
            const safe = String(name || "shot").replace(/[^a-z0-9_-]/gi, "");
            const b64 = String(dataUrl).replace(/^data:image\/\w+;base64,/, "");
            fs.mkdirSync(outDir, { recursive: true });
            const file = path.join(outDir, `${safe}.jpg`);
            const buf = Buffer.from(b64, "base64");
            fs.writeFileSync(file, buf);
            // Validate the JPEG actually terminated, so a truncated capture is
            // reported as an error instead of silently written.
            const ok = buf[0] === 0xff && buf[1] === 0xd8 &&
                       buf[buf.length - 2] === 0xff && buf[buf.length - 1] === 0xd9;
            res.setHeader("content-type", "application/json");
            res.end(JSON.stringify({ ok, file: `proof/${safe}.jpg`, bytes: buf.length }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ ok: false, error: String(err) }));
          }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), screenshotSink(), sharedModelLibrary()],
  resolve: {
    alias: {
      "@everloom/engine": path.resolve(__dirname, "../../packages/engine/src/index.ts"),
      "@everloom/gamedata": path.resolve(__dirname, "../../packages/gamedata/src/index.ts"),
    },
    extensions: [".ts", ".tsx", ".js", ".jsx"],
  },
});
