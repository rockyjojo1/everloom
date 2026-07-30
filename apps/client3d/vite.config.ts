import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@everloom/engine": path.resolve(__dirname, "../../packages/engine/src/index.ts"),
      "@everloom/gamedata": path.resolve(__dirname, "../../packages/gamedata/src/index.ts"),
    },
    extensions: [".ts", ".tsx", ".js", ".jsx"],
  }
});
