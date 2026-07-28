// Deterministic PRNG — splitmix32
// All inputs are integers. Same seed + inputs = same outputs forever.

export function splitmix32(seed: number): () => number {
  let s = seed | 0;
  return function () {
    s = (s + 0x9e3779b9) | 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) | 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) | 0;
    return ((z ^ (z >>> 16)) >>> 0) / 0x100000000;
  };
}

// Derive a per-action seed so identical actions in different contexts differ.
// Inputs must all be integers or strings. Result is a 32-bit seed.
export function deriveSeed(playerSeed: bigint, actionId: string, tickIndex: number): number {
  let h = Number(playerSeed & 0xffffffffn);
  for (let i = 0; i < actionId.length; i++) {
    h = Math.imul(h ^ actionId.charCodeAt(i), 0x9e3779b9) | 0;
  }
  h = Math.imul(h ^ tickIndex, 0xdeadbeef) | 0;
  return h >>> 0;
}

// Roll a 1-in-N chance. Returns true if the roll succeeds.
export function oneIn(rng: () => number, n: number): boolean {
  if (n <= 0) return false;
  if (n === 1) return true;
  return rng() < 1 / n;
}

// Roll a percentage chance (0-100_000 fixed-point, i.e. 1000 = 1%).
export function rollChanceFP(rng: () => number, chancePerMille: number): boolean {
  if (chancePerMille <= 0) return false;
  if (chancePerMille >= 100_000) return true;
  return rng() * 100_000 < chancePerMille;
}
