import { describe, expect, it } from 'vitest';
import { recognizeOpening, OPENING_BOOK_LINE_COUNT } from '../src/lib/openingBook';

describe('v0.9.0 local opening book', () => {
  it('ships a broad offline opening set', () => {
    expect(OPENING_BOOK_LINE_COUNT).toBeGreaterThanOrEqual(45);
  });

  it('recognizes the Ruy Lopez Morphy Defense', () => {
    const result = recognizeOpening(['e2e4','e7e5','g1f3','b8c6','f1b5','a7a6']);
    expect(result.eco).toBe('C60');
    expect(result.name).toBe('Ruy Lopez');
    expect(result.variation).toBe('Morphy Defense');
    expect(result.theoryEnded).toBe(false);
  });

  it('recognizes the Sicilian Najdorf', () => {
    const result = recognizeOpening(['e2e4','c7c5','g1f3','d7d6','d2d4','c5d4','f3d4','g8f6','b1c3','a7a6']);
    expect(result.eco).toBe('B90');
    expect(result.variation).toBe('Najdorf');
  });

  it('detects the first move that leaves the local book', () => {
    const result = recognizeOpening(['e2e4','e7e5','g1f3','b8c6','f1b5','a7a6','a2a3']);
    expect(result.theoryEnded).toBe(true);
    expect(result.matchedPly).toBe(6);
    expect(result.deviation?.uci).toBe('a2a3');
    expect(result.deviation?.alternatives.length).toBeGreaterThan(0);
  });

  it('offers common alternatives from the starting position', () => {
    const result = recognizeOpening([]);
    const moves = result.alternatives.map((alternative) => alternative.uci);
    expect(moves).toContain('e2e4');
    expect(moves).toContain('d2d4');
    expect(moves).toContain('c2c4');
    expect(moves).toContain('g1f3');
  });
});
