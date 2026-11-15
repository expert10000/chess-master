import { describe, expect, it } from 'vitest';
import { endgameCurriculum } from '../src/lib/endgameCurriculum';
import { emptyGameLibraryMemory } from '../src/lib/gameLibrary';
import { tablebaseEligible } from '../src/lib/tablebase';

describe('v1.3.0 endgame curriculum and Syzygy gate', () => {
  it('provides the four curriculum modules even with no history', () => {
    expect(endgameCurriculum(emptyGameLibraryMemory()).map((item) => item.id)).toEqual(['king-pawn', 'rook', 'queen', 'minor-piece']);
  });
  it('only sends 3–7 piece positions to Syzygy', () => {
    expect(tablebaseEligible('8/8/8/8/8/8/4K3/6k1 w - - 0 1')).toBe(false);
    expect(tablebaseEligible('8/8/8/8/8/8/4K3/6kP w - - 0 1')).toBe(true);
  });
});
