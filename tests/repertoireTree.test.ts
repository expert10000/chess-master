import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { buildRepertoireTree, repertoireBranchExercises } from '../src/lib/repertoireTree';
import { emptyRepertoireMemory, saveRepertoireChoice } from '../src/lib/repertoireMemory';

describe('v1.2.0 repertoire builder tree', () => {
  it('builds a White root and marks an unpractised node forgotten', () => {
    const memory = saveRepertoireChoice(emptyRepertoireMemory(), {
      fen: new Chess().fen(), eco: 'C20', openingName: 'King Pawn Game', moveUci: 'e2e4', moveSan: 'e4', source: 'book',
    }, 1);
    const roots = buildRepertoireTree(memory, 'w');
    expect(roots).toHaveLength(1);
    expect(roots[0].choice.moveSan).toBe('e4');
    expect(roots[0].forgotten).toBe(true);
  });

  it('creates ordered opening-recall exercises for a branch', () => {
    const memory = saveRepertoireChoice(emptyRepertoireMemory(), {
      fen: new Chess().fen(), eco: 'C20', openingName: 'King Pawn Game', moveUci: 'e2e4', moveSan: 'e4', source: 'book',
    }, 1);
    const rootKey = Object.keys(memory.choices)[0];
    const exercises = repertoireBranchExercises(memory, rootKey);
    expect(exercises).toHaveLength(1);
    expect(exercises[0].repertoirePositionKey).toBe(rootKey);
    expect(exercises[0].expectedMoves).toEqual(['e2e4']);
  });
});
