import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import type { PlyRecord } from '../src/components/MoveList';
import type { MoveReview } from '../src/lib/chessCoach';
import { captureGameLibraryEntry, type GameLibraryMemory } from '../src/lib/gameLibrary';
import {
  buildPersonalCoachRecommendations,
  recommendationTrainingExercises,
} from '../src/lib/personalCoachRecommendations';

const cycle = [
  'g1f3', 'g8f6', 'f3g1', 'f6g8',
];

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
    const verdict: MoveReview['verdict'] = loss >= 150 ? 'Blunder' : loss >= 80 ? 'Mistake' : loss >= 45 ? 'Inaccuracy' : 'Good';
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

function entry(id: string, updatedAt: number, middlegameLoss = 110, openingLoss = 25) {
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
      now: updatedAt,
    }),
    id,
    fingerprint: `fp:${id}`,
    updatedAt,
  };
}

describe('v1.0.6 Personal Coach recommendations', () => {
  it('detects a repeated middlegame CPL gap and ranks an actionable phase recommendation', () => {
    const memory: GameLibraryMemory = {
      version: 1,
      entries: Array.from({ length: 10 }, (_, index) => entry(`g${index}`, 1000 - index, 115, 25)),
    };
    const recommendations = buildPersonalCoachRecommendations(memory, 10, 5);
    const phase = recommendations.find((item) => item.kind === 'phase-gap');
    expect(phase).toBeTruthy();
    expect(phase?.title).toContain('middlegame');
    expect(phase?.summary).toContain('worse than opening');
    expect(phase?.trainingCount).toBeGreaterThan(0);
  });

  it('creates at most seven exact Stockfish-grounded exercises for Train now', () => {
    const memory: GameLibraryMemory = {
      version: 1,
      entries: Array.from({ length: 10 }, (_, index) => entry(`g${index}`, 1000 - index, 120, 25)),
    };
    const recommendation = buildPersonalCoachRecommendations(memory, 10, 5).find((item) => item.kind === 'phase-gap');
    expect(recommendation).toBeTruthy();
    const exercises = recommendationTrainingExercises(memory, recommendation!, 7);
    expect(exercises.length).toBeGreaterThan(0);
    expect(exercises.length).toBeLessThanOrEqual(7);
    expect(exercises.every((exercise) => Boolean(exercise.bestMoveUci && exercise.bestMoveSan))).toBe(true);
    expect(exercises.every((exercise) => exercise.coachRecommendationId === recommendation?.id)).toBe(true);
  });

  it('does not manufacture recommendations from a single reviewed game', () => {
    const memory: GameLibraryMemory = { version: 1, entries: [entry('one', 1000, 150, 20)] };
    expect(buildPersonalCoachRecommendations(memory, 20, 5)).toEqual([]);
  });

  it('can rank outright blunder reduction when repeated blunders dominate the window', () => {
    const memory: GameLibraryMemory = {
      version: 1,
      entries: Array.from({ length: 10 }, (_, index) => entry(`b${index}`, 1000 - index, 180, 35)),
    };
    const recommendations = buildPersonalCoachRecommendations(memory, 10, 5);
    expect(recommendations.some((item) => item.kind === 'blunders')).toBe(true);
    expect(recommendations[0].rank).toBe(1);
  });
});
