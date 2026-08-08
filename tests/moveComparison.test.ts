import { describe, expect, it } from 'vitest';
import { buildMoveComparison } from '../src/lib/moveComparison';
import type { MoveReview } from '../src/lib/chessCoach';

const baseReview: MoveReview = {
  beforeFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  playedUci: 'g1f3',
  bestMoveUci: 'e2e4',
  concepts: [],
  verdict: 'Inaccuracy',
  centipawnLoss: 85,
  title: 'Nf3 — Inaccuracy',
  summary: 'Test review',
  reasons: [],
  bestMoveSan: 'e4',
  playedLineSan: ['Nf3', 'd5'],
  bestLineSan: ['e4', 'e5'],
  playedLineUci: ['g1f3', 'd7d5'],
  bestLineUci: ['e2e4', 'e7e5'],
  bestEvaluation: '+0.55',
  playedEvaluation: '-0.30',
  bestScoreCpWhite: 55,
  playedScoreCpWhite: -30,
  bestMateWhite: null,
  playedMateWhite: null,
};

describe('v0.8.8 move comparison', () => {
  it('builds separate played and best sides from one review', () => {
    const comparison = buildMoveComparison(baseReview);
    expect(comparison.played.moveSan).toBe('Nf3');
    expect(comparison.best.moveSan).toBe('e4');
    expect(comparison.played.lineUci[0]).toBe('g1f3');
    expect(comparison.best.lineUci[0]).toBe('e2e4');
  });

  it('preserves exact centipawn loss and pawn conversion', () => {
    const comparison = buildMoveComparison(baseReview);
    expect(comparison.centipawnLoss).toBe(85);
    expect(comparison.lossPawns).toBeCloseTo(0.85);
    expect(comparison.lossScalePercent).toBeCloseTo(85 / 3);
  });

  it('marks matching best and played moves as effectively the same', () => {
    const comparison = buildMoveComparison({
      ...baseReview,
      playedUci: 'e2e4',
      bestMoveUci: 'e2e4',
      bestMoveSan: 'e4',
      centipawnLoss: 0,
      verdict: 'Best',
      playedEvaluation: '+0.55',
    });
    expect(comparison.sameMove).toBe(true);
    expect(comparison.headline.toLowerCase()).toContain('equivalent');
  });

  it('caps the visual loss bar at 3+ pawns', () => {
    const comparison = buildMoveComparison({
      ...baseReview,
      centipawnLoss: 480,
      verdict: 'Blunder',
    });
    expect(comparison.lossScalePercent).toBe(100);
  });
});
