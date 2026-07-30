import path from "path";
import fs from "fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

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
  plugins: [react(), screenshotSink()],
  resolve: {
    alias: {
      "@everloom/engine": path.resolve(__dirname, "../../packages/engine/src/index.ts"),
      "@everloom/gamedata": path.resolve(__dirname, "../../packages/gamedata/src/index.ts"),
    },
    extensions: [".ts", ".tsx", ".js", ".jsx"],
  },
});
