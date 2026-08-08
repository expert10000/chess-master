import { describe, expect, it } from 'vitest';
import { analyzeMoveConcepts, analyzePositionConcepts } from '../src/lib/chessConcepts';

describe('chess concept engine', () => {
  it('detects an absolute pin to the king', () => {
    const concepts = analyzePositionConcepts('4k3/4n3/8/8/8/8/8/4R1K1 w - - 0 1');
    expect(concepts.some((concept) => concept.label === 'Pin' && concept.detail.includes('e7'))).toBe(true);
  });

  it('detects a fork created by a knight move', () => {
    const concepts = analyzeMoveConcepts('k7/3q1r2/8/8/2N5/8/8/K7 w - - 0 1', 'c4e5');
    expect(concepts.some((concept) => concept.label === 'Fork / double attack')).toBe(true);
  });

  it('detects doubled pawns', () => {
    const concepts = analyzePositionConcepts('7k/8/8/8/8/2P5/2P5/K7 w - - 0 1');
    expect(concepts.some((concept) => concept.label === 'Doubled pawns')).toBe(true);
  });

  it('detects a passed pawn', () => {
    const concepts = analyzePositionConcepts('k7/p6p/8/4P3/8/8/8/K7 w - - 0 1');
    expect(concepts.some((concept) => concept.label === 'Passed pawn' && concept.detail.includes('e5'))).toBe(true);
  });

  it('detects a supported knight outpost', () => {
    const concepts = analyzePositionConcepts('7k/8/8/3N4/2P5/8/8/K7 w - - 0 1');
    expect(concepts.some((concept) => concept.label === 'Knight outpost' && concept.detail.includes('d5'))).toBe(true);
  });
});
