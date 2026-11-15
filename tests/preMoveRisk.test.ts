import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { assessPersonalPreMoveRisk } from '../src/lib/preMoveRisk';
import type { GameLibraryEntry, GameLibraryMemory } from '../src/lib/gameLibrary';

function entry(id: string, verdict: 'Good' | 'Mistake'): GameLibraryEntry {
  return { id, fingerprint: id, source: 'played', createdAt: 1, updatedAt: 1, startFen: new Chess().fen(), movesUci: ['f2f4'], pgn: '', white: 'You', black: 'Opponent', result: '*', humanColor: 'w', reviewStatus: 'reviewed', humanMoveCount: 1, reviewedHumanMoves: 1, reviewedPlyCount: 1, issueCount: verdict === 'Mistake' ? 1 : 0, averageCpl: verdict === 'Mistake' ? 130 : 10, weaknesses: [], reviewsByPly: { '1': { verdict, centipawnLoss: verdict === 'Mistake' ? 130 : 10, bestMoveUci: 'e2e4', bestMoveSan: 'e4', title: 'Review', summary: 'Pawn push review', reasons: [], concepts: [], playedEvaluation: '0', bestEvaluation: '0' } } };
}

describe('v1.11.0 pre-move risk coach', () => {
  it('reports personal error rate and identifies a kingside-pawn risk from comparable positions', () => {
    const memory: GameLibraryMemory = { version: 1, entries: [entry('one', 'Mistake'), entry('two', 'Mistake'), entry('three', 'Good')] };
    const risk = assessPersonalPreMoveRisk(memory, new Chess().fen(), 1, 'w');
    expect(risk?.comparablePositions).toBe(3);
    expect(risk?.mistakes).toBe(2);
    expect(risk?.errorRate).toBeCloseTo(2 / 3);
    expect(risk?.mainRisk).toBe('Premature kingside pawn push');
  });
  it('does not create alerts from sparse or issue-free evidence', () => {
    expect(assessPersonalPreMoveRisk({ version: 1, entries: [entry('one', 'Mistake'), entry('two', 'Good')] }, new Chess().fen(), 1, 'w')).toBeNull();
  });
});
