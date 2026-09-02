/** Deterministic randomness so identifiers, dates and generated rows are stable run to run. */
export const mulberry32 = (seed: number) => () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
export type Rng = () => number;
const hex = "0123456789abcdef";
/** A v4-shaped uuid from the seeded generator. Uuid-shaped because the backend's ids are, and the app must never render one. */
export const uuid = (rng: Rng) => {
  const s: string[] = [];
  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) s.push("-");
    else if (i === 14) s.push("4");
    else if (i === 19) s.push(hex[8 + Math.floor(rng() * 4)]);
    else s.push(hex[Math.floor(rng() * 16)]);
  }
  return s.join("");
};
export const pick = <T,>(rng: Rng, xs: readonly T[]) => xs[Math.floor(rng() * xs.length)];
export const seedFrom = (s: string) => { let h = 2166136261; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
