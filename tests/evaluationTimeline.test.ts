import { describe, expect, it } from 'vitest';
import type { PlyRecord } from '../src/components/MoveList';
import type { MoveReview, Verdict } from '../src/lib/chessCoach';
import { buildEvaluationTimeline, timelineRange } from '../src/lib/evaluationTimeline';

function review(verdict: Verdict, playedCp: number, bestCp = playedCp): MoveReview {
  return {
    beforeFen: 'start',
    playedUci: 'e2e4',
    bestMoveUci: 'e2e4',
    concepts: [],
    verdict,
    centipawnLoss: Math.max(0, bestCp - playedCp),
    title: `e4 — ${verdict}`,
    summary: '',
    reasons: [],
    bestMoveSan: 'e4',
    playedLineSan: [],
    bestLineSan: [],
    bestEvaluation: `${bestCp / 100}`,
    playedEvaluation: `${playedCp / 100}`,
    bestScoreCpWhite: bestCp,
    playedScoreCpWhite: playedCp,
    bestMateWhite: null,
    playedMateWhite: null,
  };
}

function record(ply: number, color: 'w' | 'b', verdict: Verdict, cp: number): PlyRecord {
  return {
    id: ply,
    ply,
    beforeFen: 'start',
    afterFen: 'after',
    uci: color === 'w' ? 'e2e4' : 'e7e5',
    san: color === 'w' ? 'e4' : 'e5',
    color,
    review: review(verdict, cp, cp + (verdict === 'Blunder' ? 300 : 0)),
  };
}

describe('evaluation timeline', () => {
  it('keeps engine scores in White point of view', () => {
    const points = buildEvaluationTimeline([
      record(1, 'w', 'Best', 35),
      record(2, 'b', 'Good', -20),
    ], 'w');
    expect(points.map((point) => point.evaluation)).toEqual([0.35, 0.35, -0.2]);
  });

  it('marks only the reviewed player issues', () => {
    const points = buildEvaluationTimeline([
      record(1, 'w', 'Blunder', -250),
      record(2, 'b', 'Blunder', 300),
    ], 'w');
    expect(points.find((point) => point.ply === 1)?.isIssue).toBe(true);
    expect(points.find((point) => point.ply === 2)?.isIssue).toBe(false);
  });

  it('caps the displayed range at ten pawns', () => {
    expect(timelineRange([{ ply: 1, evaluation: 25, display: '+25', san: 'Qh5', verdict: 'Best', color: 'w', isIssue: false }])).toBe(10);
  });
});
