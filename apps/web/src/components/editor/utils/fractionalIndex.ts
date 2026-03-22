/**
 * fractionalIndex.ts — Lexicographic fractional indexing for block ordering.
 *
 * Generates position strings that sort lexicographically between two existing
 * positions, avoiding the need to renumber blocks on every reorder.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
const BASE = ALPHABET.length;

/** Generate a position string between `a` and `b` (both optional). */
export function generatePosition(a?: string, b?: string): string {
  if (!a && !b) return 'a0';

  if (!a) {
    // Before the first item — find something less than b
    const bFirst = b!.charCodeAt(0);
    if (bFirst > 65) {
      return String.fromCharCode(Math.floor((65 + bFirst) / 2));
    }
    return 'A';
  }

  if (!b) {
    // After the last item — just append
    return a + 'a';
  }

  // Between a and b
  return midpoint(a, b);
}

function midpoint(a: string, b: string): string {
  // Pad shorter string with 'A' (the minimum character in our alphabet, char 65)
  // to maintain correct lexicographic ordering
  const PAD_CHAR = 'A';
  const maxLen = Math.max(a.length, b.length);
  const pa = a.padEnd(maxLen, PAD_CHAR);
  const pb = b.padEnd(maxLen, PAD_CHAR);

  let result = '';

  for (let i = 0; i < maxLen; i++) {
    const ca = pa.charCodeAt(i);
    const cb = pb.charCodeAt(i);
    const mid = Math.floor((ca + cb) / 2);

    if (mid > ca && mid < cb) {
      return result + String.fromCharCode(mid);
    }
    result += pa[i];
  }

  // If a and b are adjacent, extend with a middle character
  return result + 'a';
}

/** Generate N evenly-spaced positions for initial block layout. */
export function generatePositions(count: number): string[] {
  const positions: string[] = [];
  for (let i = 0; i < count; i++) {
    // Use simple incrementing strings: a0, a1, a2, ..., b0, b1, ...
    const major = Math.floor(i / 10);
    const minor = i % 10;
    positions.push(ALPHABET[major + 26] + minor.toString());
  }
  return positions;
}

/** Get a position after the last position in a list. */
export function getNextPosition(positions: string[]): string {
  if (positions.length === 0) return 'a0';
  const last = positions[positions.length - 1];
  return generatePosition(last, undefined);
}
