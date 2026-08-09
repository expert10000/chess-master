import { describe, expect, it } from 'vitest';
import {
  buildPositionProfile,
  buildPositionalBeforeAfter,
} from '../src/lib/positionProfile';
import type { MoveReview } from '../src/lib/chessCoach';

function metric(fen: string, id: string, color: 'w' | 'b' = 'w'): number {
  const profile = buildPositionProfile(fen, color);
  return profile.metrics.find((entry) => entry.id === id)!.value;
}

const reviewBase: MoveReview = {
  beforeFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
  playedUci: 'g1f3',
  bestMoveUci: 'e2e4',
  concepts: [],
  verdict: 'Good',
  centipawnLoss: 25,
  title: 'Nf3 — Good',
  summary: 'Test',
  reasons: [],
  bestMoveSan: 'e4',
  playedLineSan: ['Nf3'],
  bestLineSan: ['e4'],
  playedLineUci: ['g1f3'],
  bestLineUci: ['e2e4'],
  bestEvaluation: '+0.35',
  playedEvaluation: '+0.10',
  bestScoreCpWhite: 35,
  playedScoreCpWhite: 10,
  bestMateWhite: null,
  playedMateWhite: null,
};

describe('v0.9.2 positional before/after profiles', () => {
  it('shows development increasing when a home knight develops', () => {
    const comparison = buildPositionalBeforeAfter(reviewBase, 'played')!;
    const development = comparison.changes.find((change) => change.id === 'development')!;
    expect(development.delta).toBeGreaterThan(0);
    expect(comparison.moveSan).toBe('Nf3');
  });

  it('treats castling as a king-safety improvement in a quiet legal position', () => {
    const before = 'r3k2r/8/8/8/8/8/PPP2PPP/R3K2R w KQkq - 0 1';
    const after = 'r3k2r/8/8/8/8/8/PPP2PPP/R4RK1 b kq - 1 1';
    expect(metric(after, 'kingSafety')).toBeGreaterThan(metric(before, 'kingSafety'));
  });

  it('penalizes doubled and isolated pawn structure', () => {
    const healthy = '4k3/8/8/8/8/8/PPPPPPPP/4K3 w - - 0 1';
    const damaged = '4k3/8/8/8/8/2P5/P1PPPPPP/4K3 w - - 0 1';
    expect(metric(damaged, 'pawnStructure')).toBeLessThan(metric(healthy, 'pawnStructure'));
  });

  it('can compare the played move and Stockfish best move independently', () => {
    const played = buildPositionalBeforeAfter(reviewBase, 'played')!;
    const best = buildPositionalBeforeAfter(reviewBase, 'best')!;
    expect(played.moveUci).toBe('g1f3');
    expect(best.moveUci).toBe('e2e4');
    expect(played.afterFen).not.toBe(best.afterFen);
  });

  it('keeps all teaching metrics within the documented 0-10 range', () => {
    const profile = buildPositionProfile(reviewBase.beforeFen, 'w');
    for (const entry of profile.metrics) {
      expect(entry.value).toBeGreaterThanOrEqual(0);
      expect(entry.value).toBeLessThanOrEqual(10);
    }
    expect(profile.overall).toBeGreaterThanOrEqual(0);
    expect(profile.overall).toBeLessThanOrEqual(10);
  });
});
