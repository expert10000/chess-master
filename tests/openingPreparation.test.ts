import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { buildOpeningPreparationPack } from '../src/lib/openingPreparation';
import { emptyRepertoireMemory, saveRepertoireChoice } from '../src/lib/repertoireMemory';

describe('v1.2.1 opening preparation', () => {
  it('builds an untrained White-against-Sicilian pack from saved repertoire nodes', () => {
    const game = new Chess(); game.move('e4'); game.move('c5');
    const memory = saveRepertoireChoice(emptyRepertoireMemory(), { fen: game.fen(), eco: 'B20', openingName: 'Sicilian Defense', moveUci: 'g1f3', moveSan: 'Nf3', source: 'book' }, 1);
    const pack = buildOpeningPreparationPack(memory, 'sicilian');
    expect(pack.choices).toHaveLength(1);
    expect(pack.untrained).toHaveLength(1);
    expect(pack.exercises[0].bestMoveSan).toBe('Nf3');
  });
});
