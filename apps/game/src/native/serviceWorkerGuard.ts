/**
 * The browser/PWA build registers a Workbox service worker via a script
 * (`registerSW.js`) that vite-plugin-pwa injects into every build, native
 * included -- there is no build-time flag to omit it. That script only
 * calls `navigator.serviceWorker.register(...)` inside a `window.load`
 * listener, which fires after this module's synchronous setup has already
 * run. That ordering is what makes disabling registration here reliable.
 *
 * Capacitor's iOS WebView already serves the bundled `dist` output directly
 * from the app package with its own asset pipeline; layering Workbox's
 * cache-first service worker on top of that is a second, independent
 * caching system with no proven benefit and a real risk of serving stale
 * bundled assets after an app update. Native execution disables
 * registration and unregisters anything already registered; browser/PWA
 * execution is untouched.
 */

export interface ServiceWorkerRegistrationLike {
  unregister: () => Promise<boolean>;
}

export interface ServiceWorkerContainerLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- must accept the real lib.dom.d.ts ServiceWorkerContainer['register'] signature
  register: (...args: any[]) => Promise<unknown>;
  getRegistrations?: (() => Promise<readonly ServiceWorkerRegistrationLike[]>) | undefined;
}

export type ServiceWorkerPlatformPolicyResult = "disabled-native" | "enabled-web" | "unavailable";

/** Replaces `register` with a silent no-op and unregisters any existing registrations. Pure side-effecting mutation on the passed-in container -- no globals touched directly, so it is testable without a DOM. */
export function disableServiceWorkerRegistration(container: ServiceWorkerContainerLike): void {
  container.register = async () => undefined;

  if (container.getRegistrations) {
    void container.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        void registration.unregister();
      }
    });
  }
}

/**
 * Applies the native-vs-web service worker policy. Returns which branch
 * was taken so callers/tests can assert on the decision without inspecting
 * the container's internals.
 */
export function applyServiceWorkerPlatformPolicy(options: {
  isNative: boolean;
  serviceWorkerContainer: ServiceWorkerContainerLike | undefined;
}): ServiceWorkerPlatformPolicyResult {
  if (!options.serviceWorkerContainer) return "unavailable";
  if (options.isNative) {
    disableServiceWorkerRegistration(options.serviceWorkerContainer);
    return "disabled-native";
  }
  return "enabled-web";
}
