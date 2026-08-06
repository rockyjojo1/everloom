// Pure sanitiser for the dev-only test-delay override seams (see
// pickupPresentationMsOverride / longPressMsOverride in GameWorld.tsx).
// These seams exist so an E2E test can WIDEN a real production timer to get
// a non-racy margin for a real pointer event — they must never be able to
// shorten it, since that would let a test pass by making the guard easier
// to hit than it is in real play, not by proving the guard actually works.
export const MAX_TEST_DELAY_MS = 15_000;

// Requested value clamps to [baseMs, MAX_TEST_DELAY_MS]. NaN, Infinity, and
// negative/sub-base requests all fall back to baseMs (i.e. no override) or
// the maximum, never below the real production delay.
export function sanitiseTestDelayOverride(baseMs: number, requestedMs: number): number {
  if (!Number.isFinite(requestedMs)) return baseMs;
  const capped = Math.min(MAX_TEST_DELAY_MS, requestedMs);
  return Math.max(baseMs, capped);
}
