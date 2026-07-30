import { PROBABILITY_SCALE } from "./types";

/**
 * Everloom probabilities are integer parts-per-million.
 * 0 never succeeds; 1_000_000 always succeeds.
 */
export function assertProbabilityPpm(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > PROBABILITY_SCALE) {
    throw new RangeError(`Probability must be an integer from 0 to ${PROBABILITY_SCALE}; received ${value}`);
  }
}

function fnv1a32(text: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function mix32(value: number): number {
  let mixed = value >>> 0;
  mixed ^= mixed >>> 16;
  mixed = Math.imul(mixed, 0x7feb352d);
  mixed ^= mixed >>> 15;
  mixed = Math.imul(mixed, 0x846ca68b);
  mixed ^= mixed >>> 16;
  return mixed >>> 0;
}

export function deterministicUint32(
  saveSeed: string,
  activitySequence: number,
  rollType: string,
  targetId: string,
): number {
  if (!Number.isSafeInteger(activitySequence) || activitySequence < 0) {
    throw new RangeError(`activitySequence must be a non-negative safe integer; received ${activitySequence}`);
  }
  return mix32(fnv1a32(`${saveSeed}|${activitySequence}|${rollType}|${targetId}`));
}

export function deterministicRollPpm(
  saveSeed: string,
  activitySequence: number,
  rollType: string,
  targetId: string,
  chancePpm: number,
): boolean {
  assertProbabilityPpm(chancePpm);
  if (chancePpm === 0) return false;
  if (chancePpm === PROBABILITY_SCALE) return true;
  return deterministicUint32(saveSeed, activitySequence, rollType, targetId) % PROBABILITY_SCALE < chancePpm;
}

export function deterministicRange(
  saveSeed: string,
  activitySequence: number,
  rollType: string,
  targetId: string,
  minimum: number,
  maximum: number,
): number {
  if (!Number.isInteger(minimum) || !Number.isInteger(maximum) || maximum < minimum) {
    throw new RangeError(`Invalid deterministic range ${minimum}..${maximum}`);
  }
  const width = maximum - minimum + 1;
  return minimum + (deterministicUint32(saveSeed, activitySequence, rollType, targetId) % width);
}
