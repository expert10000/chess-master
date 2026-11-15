import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import type { PlyRecord } from '../src/components/MoveList';
import type { MoveReview } from '../src/lib/chessCoach';
import {
  captureGameLibraryEntry,
  type GameLibraryEntry,
  type GameLibraryMemory,
} from '../src/lib/gameLibrary';
import {
  buildPersonalCoachRecommendations,
  type PersonalCoachRecommendation,
} from '../src/lib/personalCoachRecommendations';
import {
  emptyRecommendationOutcomeMemory,
  recordCompletedRecommendationIntervention,
  recommendationOutcomeEvaluation,
} from '../src/lib/recommendationOutcomes';

const cycle = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];

function review(beforeFen: string, playedUci: string, loss: number, verdict: MoveReview['verdict']): MoveReview {
  const game = new Chess(beforeFen);
  const legal = game.moves({ verbose: true });
  const best = legal.find((move) => `${move.from}${move.to}${move.promotion ?? ''}` !== playedUci) ?? legal[0];
  const bestUci = `${best.from}${best.to}${best.promotion ?? ''}`;
  return {
    beforeFen,
    playedUci,
    bestMoveUci: bestUci,
    concepts: [],
    verdict,
    centipawnLoss: loss,
    title: verdict,
    summary: 'test review',
    reasons: ['test reason'],
    bestMoveSan: best.san,
    playedLineSan: [],
    bestLineSan: [best.san],
    playedLineUci: [playedUci],
    bestLineUci: [bestUci],
    bestEvaluation: '+0.20',
    playedEvaluation: '-0.80',
    bestScoreCpWhite: 20,
    playedScoreCpWhite: -80,
    bestMateWhite: null,
    playedMateWhite: null,
  };
}

function gameRecords(middlegameLoss = 110, openingLoss = 25): PlyRecord[] {
  const game = new Chess();
  const records: PlyRecord[] = [];
  for (let index = 0; index < 32; index += 1) {
    const uci = cycle[index % cycle.length];
    const beforeFen = game.fen();
    const move = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4) });
    const ply = index + 1;
    const humanMove = move.color === 'w';
    const loss = ply <= 20 ? openingLoss : middlegameLoss;
    const verdict: MoveReview['verdict'] =
      loss >= 150 ? 'Blunder'
        : loss >= 80 ? 'Mistake'
          : loss >= 45 ? 'Inaccuracy'
            : 'Good';
    records.push({
      id: ply,
      ply,
      beforeFen,
      afterFen: game.fen(),
      uci,
      san: move.san,
      color: move.color,
      review: humanMove ? review(beforeFen, uci, loss, verdict) : undefined,
    });
  }
  return records;
}

function entry(id: string, createdAt: number, middlegameLoss = 110, openingLoss = 25): GameLibraryEntry {
  const records = gameRecords(middlegameLoss, openingLoss);
  return {
    ...captureGameLibraryEntry({
      id,
      source: 'played',
      records,
      startFen: new Chess().fen(),
      pgn: '*',
      headers: { White: 'Student', Black: `Opponent ${id}`, Result: '*' },
      humanColor: 'w',
      whiteFallback: 'Student',
      blackFallback: `Opponent ${id}`,
      result: '*',
      now: createdAt,
    }),
    id,
    fingerprint: `fp:${id}`,
    createdAt,
    updatedAt: createdAt,
  };
}

function baselineMemory(): GameLibraryMemory {
  return {
    version: 1,
    entries: Array.from({ length: 10 }, (_, index) =>
      entry(`baseline-${index}`, 1000 + index, 120, 25)
    ),
  };
}

function middlegameRecommendation(memory: GameLibraryMemory): PersonalCoachRecommendation {
  const recommendation = buildPersonalCoachRecommendations(memory, 10, 5)
    .find((item) => item.kind === 'phase-gap');
  if (!recommendation) throw new Error('expected middlegame recommendation');
  return recommendation;
}

describe('v1.0.7 recommendation outcome tracking', () => {
  it('records the baseline only after a recommendation training session is completed', () => {
    const library = baselineMemory();
    const recommendation = middlegameRecommendation(library);
    const memory = recordCompletedRecommendationIntervention(
      emptyRecommendationOutcomeMemory(),
      recommendation,
      library,
      {
        plannedPositions: 7,
        attemptedPositions: 6,
        solvedPositions: 5,
        completedAt: 2000,
      },
    );

    expect(memory.interventions).toHaveLength(1);
    const intervention = memory.interventions[0];
    expect(intervention.plannedPositions).toBe(7);
    expect(intervention.attemptedPositions).toBe(6);
    expect(intervention.solvedPositions).toBe(5);
    expect(intervention.baseline.avgCpl).toBeGreaterThan(100);
    expect(intervention.baselineGameIds).toHaveLength(10);
  });

  it('stays Collecting before ten relevant future reviewed games', () => {
    const baseline = baselineMemory();
    const recommendation = middlegameRecommendation(baseline);
    const outcomeMemory = recordCompletedRecommendationIntervention(
      emptyRecommendationOutcomeMemory(),
      recommendation,
      baseline,
      { plannedPositions: 7, attemptedPositions: 7, solvedPositions: 6, completedAt: 2000 },
    );
    const future = Array.from({ length: 5 }, (_, index) =>
      entry(`future-${index}`, 3000 + index, 45, 25)
    );
    const evaluation = recommendationOutcomeEvaluation(
      outcomeMemory.interventions[0],
      { version: 1, entries: [...future, ...baseline.entries] },
    );

    expect(evaluation.next10.games).toBe(5);
    expect(evaluation.next10.verdict).toBe('collecting');
    expect(evaluation.finalVerdict).toBe('collecting');
  });

  it('detects improvement at the ten-game checkpoint when target CPL drops materially', () => {
    const baseline = baselineMemory();
    const recommendation = middlegameRecommendation(baseline);
    const outcomeMemory = recordCompletedRecommendationIntervention(
      emptyRecommendationOutcomeMemory(),
      recommendation,
      baseline,
      { plannedPositions: 7, attemptedPositions: 7, solvedPositions: 7, completedAt: 2000 },
    );
    const future = Array.from({ length: 10 }, (_, index) =>
      entry(`future-${index}`, 3000 + index, 45, 25)
    );
    const evaluation = recommendationOutcomeEvaluation(
      outcomeMemory.interventions[0],
      { version: 1, entries: [...future, ...baseline.entries] },
    );

    expect(evaluation.next10.games).toBe(10);
    expect(evaluation.next10.verdict).toBe('improved');
    expect(evaluation.next10.cplDelta).toBeLessThan(-8);
    expect(evaluation.finalVerdict).toBe('improved');
  });

  it('produces a 20-game outcome and ignores later games outside the first 20', () => {
    const baseline = baselineMemory();
    const recommendation = middlegameRecommendation(baseline);
    const outcomeMemory = recordCompletedRecommendationIntervention(
      emptyRecommendationOutcomeMemory(),
      recommendation,
      baseline,
      { plannedPositions: 7, attemptedPositions: 7, solvedPositions: 7, completedAt: 2000 },
    );
    const improved20 = Array.from({ length: 20 }, (_, index) =>
      entry(`future-${index}`, 3000 + index, 50, 25)
    );
    const laterBad = Array.from({ length: 5 }, (_, index) =>
      entry(`later-${index}`, 5000 + index, 200, 25)
    );
    const evaluation = recommendationOutcomeEvaluation(
      outcomeMemory.interventions[0],
      { version: 1, entries: [...laterBad, ...improved20, ...baseline.entries] },
    );

    expect(evaluation.next20.games).toBe(20);
    expect(evaluation.next20.verdict).toBe('improved');
    expect(evaluation.newReviewedGames).toHaveLength(20);
    expect(evaluation.newReviewedGames.some((game) => game.id.startsWith('later-'))).toBe(false);
  }, 15000);

  it('does not count a pre-intervention game merely because it is updated later', () => {
    const baseline = baselineMemory();
    const recommendation = middlegameRecommendation(baseline);
    const outcomeMemory = recordCompletedRecommendationIntervention(
      emptyRecommendationOutcomeMemory(),
      recommendation,
      baseline,
      { plannedPositions: 7, attemptedPositions: 7, solvedPositions: 7, completedAt: 2000 },
    );
    const oldUpdated = { ...baseline.entries[0], updatedAt: 9000 };
    const future = Array.from({ length: 2 }, (_, index) =>
      entry(`future-${index}`, 3000 + index, 45, 25)
    );
    const evaluation = recommendationOutcomeEvaluation(
      outcomeMemory.interventions[0],
      { version: 1, entries: [oldUpdated, ...future, ...baseline.entries.slice(1)] },
    );

    expect(evaluation.newReviewedGames.map((game) => game.id)).toEqual(['future-0', 'future-1']);
  });
});
