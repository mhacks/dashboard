/*
  Everything on the pass that looks random — the barcode and the pass code — is
  derived from a hash instead. Same seed, same pass, every render: nothing
  re-rolls or flickers while you type.

  In the dashboard the seed is the applicant row's id, so two hackers who share
  a name still get different passes and a pass code stays the same person's
  across a rename. Standalone, the seed is the name itself.
*/

/** FNV-1a, 32-bit. Small, stable, good enough spread for this. */
export function hashSeed(seed: string): number {
  const source = seed.trim().toUpperCase();
  let h = 0x811c9dc5;
  for (let i = 0; i < source.length; i++) {
    h ^= source.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  // Salt so an empty seed still lands on a plausible-looking code.
  return (h ^ 0x9e3779b9) >>> 0;
}

/** Mulberry32 — deterministic stream from a single seed. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Widths, in px, for the stub barcode's bars. */
export function barcodeFor(seed: string, bars = 44): number[] {
  const next = rng(hashSeed(seed));
  return Array.from({ length: bars }, () => 1 + Math.floor(next() * 3));
}

/** The human-readable string printed under the barcode. */
export function passCodeFor(seed: string): string {
  return hashSeed(seed).toString(36).toUpperCase().padStart(7, "0").slice(0, 7);
}
