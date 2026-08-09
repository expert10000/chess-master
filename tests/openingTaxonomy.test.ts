import { describe, expect, it } from 'vitest';
import { classifyOpening, recognizeOpening } from '../src/lib/openingBook';

describe('v0.9.2.1 opening taxonomy', () => {
  it("classifies the French as a semi-open King\'s Pawn game", () => {
    const result = recognizeOpening(['e2e4', 'e7e6']);
    expect(result.name).toBe('French Defense');
    expect(result.taxonomy.type).toBe('Semi-open game');
    expect(result.taxonomy.family).toBe("King's Pawn Opening");
  });

  it('classifies Ruy Lopez as an open game', () => {
    const result = recognizeOpening(['e2e4','e7e5','g1f3','b8c6','f1b5']);
    expect(result.taxonomy.type).toBe('Open game');
  });

  it("classifies King\'s Indian as an Indian defense", () => {
    const taxonomy = classifyOpening('E90', "King's Indian Defense");
    expect(taxonomy.type).toBe('Indian defense');
    expect(taxonomy.family).toContain('Indian');
  });

  it('classifies English and Reti as flank openings', () => {
    expect(classifyOpening('A10', 'English Opening').type).toBe('Flank opening');
    expect(classifyOpening('A04', 'Réti Opening').type).toBe('Flank opening');
  });

  it('classifies Queen’s Gambit structures as closed games', () => {
    expect(classifyOpening('D30', "Queen's Gambit Declined").type).toBe('Closed game');
  });
});
