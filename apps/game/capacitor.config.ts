import type { CapacitorConfig } from "@capacitor/cli";

// Gate 5A: minimal Capacitor iOS foundation for the authoritative apps/game
// Vite build. This config deliberately omits `server.url` / live-reload:
// the native shell always loads the locally bundled `dist` output copied
// into the iOS project by `cap sync`, never a remote or LAN dev server.
// See docs/audits/2026-08-05-capacitor-ios-bakeoff/GATE5A_IMPLEMENTATION_REPORT.md.
const config: CapacitorConfig = {
  appId: "com.rockyjojo1.everloom",
  appName: "Everloom",
  webDir: "dist",
  backgroundColor: "#17241f",
  ios: {
    contentInset: "always",
    backgroundColor: "#17241f",
  },
};

export default config;
