import { Capacitor } from "@capacitor/core";

/** True when running inside the native Capacitor iOS/Android wrapper, false in any browser (including the installed PWA). */
export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}
