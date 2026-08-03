import { createReadStream, existsSync, statSync, cpSync, readdirSync } from "node:fs";
import { extname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { MODEL_ROOT } from "../../packages/assets/paths.mjs";

const appDirectory = fileURLToPath(new URL(".", import.meta.url));

// packages/assets owns the canonical tracked model-binary root; this app
// only serves/copies from it. See packages/assets/paths.mjs.
const modelRoot = MODEL_ROOT;

function assertCanonicalModelRootPopulated(): void {
  if (!existsSync(modelRoot) || !statSync(modelRoot).isDirectory()) {
    throw new Error(
      `everloom-shared-model-library: canonical model root not found at ${modelRoot}. ` +
      `Expected packages/assets/models to exist (it is a tracked directory in this repository).`,
    );
  }
  if (readdirSync(modelRoot).length === 0) {
    throw new Error(
      `everloom-shared-model-library: canonical model root ${modelRoot} exists but is empty. ` +
      `Refusing to build/serve with zero models — this would silently ship a broken 3D runtime.`,
    );
  }
}

function sharedModelLibrary(): Plugin {
  return {
    name: "everloom-shared-model-library",
    configureServer(server) {
      assertCanonicalModelRootPopulated();
      server.middlewares.use("/models", (request, response, next) => {
        try {
          const relativePath = decodeURIComponent(new URL(request.url ?? "/", "http://localhost").pathname)
            .replace(/^\/+/, "");
          const file = resolve(modelRoot, relativePath);
          if (!file.startsWith(modelRoot) || !existsSync(file) || !statSync(file).isFile()) return next();
          const type = extname(file) === ".glb" ? "model/gltf-binary" : "model/gltf+json";
          response.writeHead(200, { "content-type": type, "cache-control": "public, max-age=3600" });
          createReadStream(file).pipe(response);
        } catch {
          next();
        }
      });
    },
    writeBundle(options) {
      assertCanonicalModelRootPopulated();
      const outputDirectory = typeof options.dir === "string" ? options.dir : resolve(appDirectory, "dist");
      const destination = resolve(outputDirectory, "models");
      cpSync(modelRoot, destination, { recursive: true });
      if (!existsSync(destination) || readdirSync(destination).length === 0) {
        throw new Error(
          `everloom-shared-model-library: copy to ${destination} produced an empty directory. ` +
          `Build copying must not silently succeed with no models.`,
        );
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    sharedModelLibrary(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["icon.svg"],
      manifest: {
        name: "Everloom",
        short_name: "Everloom",
        description: "A persistent low-poly fantasy RPG built for the world first.",
        theme_color: "#17241f",
        background_color: "#17241f",
        display: "standalone",
        orientation: "landscape",
        start_url: "/",
        icons: [
          { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith("/models/"),
            handler: "CacheFirst",
            options: {
              cacheName: "everloom-models-v1",
              expiration: { maxEntries: 96, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  server: {
    host: "127.0.0.1",
    port: 4310,
  },
  preview: {
    host: "127.0.0.1",
    port: 4311,
  },
  build: {
    // Three.js is isolated and deferred behind world entry; the player-shell budget is enforced separately.
    chunkSizeWarningLimit: 550,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalized = id.replaceAll("\\", "/");
          if (normalized.includes("/node_modules/three/examples/")) return "three-addons";
          if (normalized.includes("/node_modules/three/")) return "three-core";
        },
      },
    },
  },
});
