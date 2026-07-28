import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "Everloom",
        short_name: "Everloom",
        description: "A cloud-saved idle RPG. The world is a tapestry.",
        theme_color: "#4A3728",
        background_color: "#E8DCC4",
        display: "standalone",
        orientation: "portrait",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any maskable" }
        ]
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"]
      }
    })
  ],
  resolve: {
    alias: {
      // Resolve workspace packages directly from source in dev — no pre-build needed.
      "@everloom/engine": path.resolve(__dirname, "../../packages/engine/src/index.ts"),
      "@everloom/gamedata": path.resolve(__dirname, "../../packages/gamedata/src/index.ts"),
    },
    // Vite strips .js extensions and resolves .ts automatically.
    extensions: [".ts", ".tsx", ".js", ".jsx"],
  }
});
