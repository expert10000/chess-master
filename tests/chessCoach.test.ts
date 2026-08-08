import { describe, expect, it } from 'vitest';
import {
  classifyLoss,
  createMoveReview,
  parseCoachPrompt,
  uciLineToSan,
  uciToSan,
} from '../src/lib/chessCoach';
import type { AnalyseResult } from '../src/types/engine';

const startFen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function result(input: {
  bestMove: string;
  scoreCp: number;
  pv: string[];
}): AnalyseResult {
  return {
    bestMove: input.bestMove,
    ponder: null,
    elapsedMs: 100,
    engineName: 'Stockfish test',
    lines: [{
      multipv: 1,
      depth: 15,
      scoreCp: input.scoreCp,
      mate: null,
      pv: input.pv,
    }],
  };
}

describe('classifyLoss', () => {
  it('maps centipawn loss to useful verdicts', () => {
    expect(classifyLoss(0)).toBe('Best');
    expect(classifyLoss(25)).toBe('Excellent');
    expect(classifyLoss(60)).toBe('Good');
    expect(classifyLoss(100)).toBe('Inaccuracy');
    expect(classifyLoss(200)).toBe('Mistake');
    expect(classifyLoss(400)).toBe('Blunder');
  });
});

describe('UCI conversion', () => {
  it('converts a move to SAN', () => {
    expect(uciToSan(startFen, 'e2e4')).toBe('e4');
  });

  it('converts a principal variation to SAN', () => {
    expect(uciLineToSan(startFen, ['e2e4', 'e7e5', 'g1f3'])).toEqual(['e4', 'e5', 'Nf3']);
  });
});

describe('createMoveReview', () => {
  it('recognizes an engine-best central move', () => {
    const best = result({ bestMove: 'e2e4', scoreCp: 32, pv: ['e2e4', 'e7e5', 'g1f3'] });
    const played = result({ bestMove: 'e2e4', scoreCp: 30, pv: ['e2e4', 'e7e5', 'g1f3'] });
    const review = createMoveReview({
      beforeFen: startFen,
      uci: 'e2e4',
      san: 'e4',
      best,
      played,
    });

    expect(review.verdict).toBe('Best');
    expect(review.bestMoveSan).toBe('e4');
    expect(review.reasons.join(' ')).toContain('central square');
  });

  it('measures a substantial evaluation loss', () => {
    const best = result({ bestMove: 'e2e4', scoreCp: 40, pv: ['e2e4', 'e7e5'] });
    const played = result({ bestMove: 'e2e3', scoreCp: -150, pv: ['e2e3', 'e7e5'] });
    const review = createMoveReview({
      beforeFen: startFen,
      uci: 'e2e3',
      san: 'e3',
      best,
      played,
    });

    expect(review.centipawnLoss).toBe(190);
    expect(review.verdict).toBe('Mistake');
    expect(review.bestMoveSan).toBe('e4');
  });
});


describe('conversational coach parser', () => {
  it('recognizes a candidate move in natural language', () => {
    const parsed = parseCoachPrompt(startFen, 'What if Nf3?');
    expect(parsed.intent).toBe('compare-move');
    expect(parsed.move?.uci).toBe('g1f3');
  });

  it('recognizes strategic and material questions', () => {
    expect(parseCoachPrompt(startFen, 'What is my plan?').intent).toBe('plan');
    expect(parseCoachPrompt(startFen, 'What is the material balance?').intent).toBe('material');
    expect(parseCoachPrompt(startFen, 'What is Black threatening?').intent).toBe('threat');
  });
});
