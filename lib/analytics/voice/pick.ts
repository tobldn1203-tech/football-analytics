/**
 * A small deterministic "random" picker — same seed always returns the
 * same index, so a given player/match reads the same way on every visit,
 * but different subjects don't all land on the same phrasing. Not
 * cryptographic, just needs to be stable and reasonably well-distributed.
 */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (h * 31 + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

export function pickOne<T>(options: readonly T[], seed: string): T {
  return options[hashString(seed) % options.length];
}
