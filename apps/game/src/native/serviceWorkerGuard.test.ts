import { describe, expect, it, vi } from "vitest";
import {
  applyServiceWorkerPlatformPolicy,
  disableServiceWorkerRegistration,
  type ServiceWorkerContainerLike,
} from "./serviceWorkerGuard";

function makeContainer(overrides: Partial<ServiceWorkerContainerLike> = {}): ServiceWorkerContainerLike {
  return {
    register: vi.fn(async () => ({ scope: "/" })),
    ...overrides,
  };
}

describe("disableServiceWorkerRegistration", () => {
  it("replaces register with a no-op that resolves without throwing", async () => {
    const container = makeContainer();
    const originalRegister = container.register;

    disableServiceWorkerRegistration(container);

    expect(container.register).not.toBe(originalRegister);
    await expect(container.register("/sw.js", { scope: "/" })).resolves.toBeUndefined();
  });

  it("unregisters every existing registration when getRegistrations is available", async () => {
    const unregisterA = vi.fn(async () => true);
    const unregisterB = vi.fn(async () => true);
    const container = makeContainer({
      getRegistrations: vi.fn(async () => [{ unregister: unregisterA }, { unregister: unregisterB }]),
    });

    disableServiceWorkerRegistration(container);
    // getRegistrations().then(...) is fire-and-forget; flush microtasks.
    await Promise.resolve();
    await Promise.resolve();

    expect(unregisterA).toHaveBeenCalledTimes(1);
    expect(unregisterB).toHaveBeenCalledTimes(1);
  });

  it("does not throw when getRegistrations is absent", () => {
    const container = makeContainer({ getRegistrations: undefined });
    expect(() => disableServiceWorkerRegistration(container)).not.toThrow();
  });
});

describe("applyServiceWorkerPlatformPolicy", () => {
  it("disables registration and returns 'disabled-native' when isNative is true", () => {
    const container = makeContainer();
    const originalRegister = container.register;

    const result = applyServiceWorkerPlatformPolicy({ isNative: true, serviceWorkerContainer: container });

    expect(result).toBe("disabled-native");
    expect(container.register).not.toBe(originalRegister);
  });

  it("leaves register untouched and returns 'enabled-web' when isNative is false", () => {
    const container = makeContainer();
    const originalRegister = container.register;

    const result = applyServiceWorkerPlatformPolicy({ isNative: false, serviceWorkerContainer: container });

    expect(result).toBe("enabled-web");
    expect(container.register).toBe(originalRegister);
  });

  it("returns 'unavailable' and does nothing when there is no service worker container", () => {
    const result = applyServiceWorkerPlatformPolicy({ isNative: true, serviceWorkerContainer: undefined });
    expect(result).toBe("unavailable");
  });

  it("returns 'unavailable' on web too when there is no service worker container", () => {
    const result = applyServiceWorkerPlatformPolicy({ isNative: false, serviceWorkerContainer: undefined });
    expect(result).toBe("unavailable");
  });
});
