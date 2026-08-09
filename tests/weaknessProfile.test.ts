import { describe, expect, it } from 'vitest';
import type { MoveReview } from '../src/lib/chessCoach';
import { recognizeOpening } from '../src/lib/openingBook';
import {
  deriveWeaknessCategories,
  emptyWeaknessMemory,
  loadWeaknessMemory,
  recordOpeningDeviationWeakness,
  recordReviewedMoveWeakness,
  serializeWeaknessMemory,
  weakestCategory,
  weaknessProfileRows,
  weaknessTrainingExamples,
} from '../src/lib/weaknessProfile';

function review(overrides: Partial<MoveReview> = {}): MoveReview {
  return {
    beforeFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    playedUci: 'a2a3',
    bestMoveUci: 'g1f3',
    concepts: [],
    verdict: 'Inaccuracy',
    centipawnLoss: 85,
    title: 'a3 — Inaccuracy',
    summary: 'A developing move was stronger.',
    reasons: ['You fall behind in development.'],
    bestMoveSan: 'Nf3',
    playedLineSan: ['a3'],
    bestLineSan: ['Nf3'],
    playedLineUci: ['a2a3'],
    bestLineUci: ['g1f3'],
    bestEvaluation: '+0.40',
    playedEvaluation: '-0.45',
    bestScoreCpWhite: 40,
    playedScoreCpWhite: -45,
    bestMateWhite: null,
    playedMateWhite: null,
    ...overrides,
  };
}

describe('v0.9.3 weakness profile', () => {
  it('detects poor development when the review explicitly identifies it', () => {
    expect(deriveWeaknessCategories(review())).toContain('development');
  });

  it('detects hanging pieces and missed tactics from grounded review evidence', () => {
    const categories = deriveWeaknessCategories(review({
      verdict: 'Mistake',
      centipawnLoss: 170,
      summary: 'The knight is hanging and you missed a fork.',
      reasons: ['The knight is undefended.', 'Nf7+ creates a fork.'],
    }));
    expect(categories).toContain('hanging-pieces');
    expect(categories).toContain('missed-tactics');
  });

  it('accumulates reviewed positions and produces targeted examples', () => {
    let memory = emptyWeaknessMemory();
    memory = recordReviewedMoveWeakness(memory, {
      observationId: 'game-1-move-1',
      ply: 1,
      san: 'a3',
      review: review(),
    }, 100);

    const development = weaknessProfileRows(memory).find((row) => row.id === 'development')!;
    expect(memory.reviewedMoves).toBe(1);
    expect(development.occurrences).toBe(1);
    expect(weaknessTrainingExamples(memory, 'development')).toHaveLength(1);
    expect(weaknessTrainingExamples(memory, 'development')[0].bestMoveSan).toBe('Nf3');
  });

  it('adds opening deviations as a persistent weakness category', () => {
    const recognition = recognizeOpening(['e2e4','e7e5','g1f3','b8c6','f1b5','a7a6','a2a3']);
    const memory = recordOpeningDeviationWeakness(
      emptyWeaknessMemory(),
      recognition,
      undefined,
      'opening-1',
      100,
    );

    const opening = weaknessProfileRows(memory).find((row) => row.id === 'opening-deviations')!;
    expect(opening.occurrences).toBe(1);
    expect(opening.examples).toBeGreaterThan(0);
  });

  it('persists the profile and identifies the highest-priority trainable category', () => {
    let memory = emptyWeaknessMemory();
    for (let index = 0; index < 3; index += 1) {
      memory = recordReviewedMoveWeakness(memory, {
        observationId: `g:${index}`,
        ply: 1,
        san: 'a3',
        review: review({ centipawnLoss: 120 }),
      }, 100 + index);
    }

    const restored = loadWeaknessMemory(serializeWeaknessMemory(memory));
    expect(restored.reviewedMoves).toBe(3);
    expect(weakestCategory(restored)?.id).toBe('development');
  });
});
