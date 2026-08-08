import { describe, expect, it } from 'vitest';
import { buildTrainingHints, isAcceptedTrainingMove, scoreTrainingAttempt, type TrainingExercise } from '../src/lib/training';
import type { MoveReview } from '../src/lib/chessCoach';

function review(verdict: MoveReview['verdict'], centipawnLoss = 0): MoveReview {
  return {
    beforeFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    playedUci: 'e2e4',
    bestMoveUci: 'e2e4',
    concepts: [],
    verdict,
    centipawnLoss,
    title: `e4 — ${verdict}`,
    summary: 'summary',
    reasons: [],
    bestMoveSan: 'e4',
    playedLineSan: [],
    bestLineSan: ['e4'],
    bestEvaluation: '+0.20',
    playedEvaluation: '+0.20',
  };
}

describe('training scoring', () => {
  it('accepts Best and Excellent as solved', () => {
    expect(isAcceptedTrainingMove(review('Best'))).toBe(true);
    expect(isAcceptedTrainingMove(review('Excellent', 20))).toBe(true);
    expect(isAcceptedTrainingMove(review('Good', 50))).toBe(false);
  });

  it('reduces score after hints', () => {
    const best = review('Best');
    expect(scoreTrainingAttempt(best, 0)).toBe(100);
    expect(scoreTrainingAttempt(best, 2)).toBeLessThan(100);
    expect(scoreTrainingAttempt(best, 4)).toBeLessThan(scoreTrainingAttempt(best, 2));
  });
});

describe('training hints', () => {
  it('progresses from idea to exact answer', () => {
    const moveReview = review('Blunder', 300);
    moveReview.bestMoveUci = 'g1f3';
    moveReview.bestMoveSan = 'Nf3';
    const exercise: TrainingExercise = {
      key: '1:1:1',
      recordId: 1,
      ply: 1,
      beforeFen: moveReview.beforeFen,
      originalMoveSan: 'f3',
      originalVerdict: 'Blunder',
      originalLoss: 300,
      bestMoveUci: 'g1f3',
      bestMoveSan: 'Nf3',
      review: moveReview,
    };
    const hints = buildTrainingHints(exercise);
    expect(hints).toHaveLength(4);
    expect(hints[1]).toContain('g1');
    expect(hints[2]).toContain('f3');
    expect(hints[3]).toContain('Nf3');
  });
});
