import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { createMobileExplanation } from '../src/mobile/causalHints';
import type { MobileAnalysis } from '../src/mobile/engine';

function position(): Chess {
  const game = new Chess();
  game.loadPgn('1. e4 d5 2. Nc3 d4');
  return game;
}

function result(overrides: Partial<MobileAnalysis> = {}): MobileAnalysis {
  const best = { move: 'c3b1', depth: 22, scoreCp: -40, mate: null, pv: ['c3b1', 'g8f6', 'd2d3'] };
  const alternative = { move: 'c3e2', depth: 21, scoreCp: -55, mate: null, pv: ['c3e2', 'g8f6', 'd2d3'] };
  return {
    bestMove: 'c3b1', depth: 22, scoreCp: -40, mate: null,
    lines: [best, alternative], alternatives: [alternative], elapsedMs: 3800,
    ...overrides,
  };
}

describe('mobile causal hints', () => {
  it('links the attacked knight to the engine reply and a close alternative', () => {
    const explanation = createMobileExplanation(position(), result(), 'explain');
    expect(explanation?.move.san).toBe('Nb1');
    expect(explanation?.whyNow).toContain('pawn on d4 attacks your knight on c3');
    expect(explanation?.replySan).toBe('Nf6');
    expect(explanation?.replyConsequence).toContain('remains outside that pawn');
    expect(explanation?.lineSan).toEqual(['Nb1', 'Nf6', 'd3']);
    expect(explanation?.alternativeSan).toBe('Nce2');
    expect(explanation?.alternativeGapCp).toBe(15);
    expect(explanation?.status).toBe('supported');
  });

  it('explains the consequence after a recapture when the verified follow-up attacks the queen', () => {
    const game = new Chess();
    game.loadPgn('1. e4 d5');
    const analysis = result({
      bestMove: 'e4d5', scoreCp: 45,
      lines: [{ move: 'e4d5', depth: 20, scoreCp: 45, mate: null, pv: ['e4d5', 'd8d5', 'b1c3', 'd5a5'] }],
      alternatives: [],
    });
    const explanation = createMobileExplanation(game, analysis, 'explain');
    expect(explanation?.whyNow).toContain('captures the opponent\'s pawn on d5');
    expect(explanation?.replySan).toBe('Qxd5');
    expect(explanation?.replyConsequence).toContain('Nc3: knight on c3 now attacks the opponent\'s queen on d5');
    expect(explanation?.status).toBe('supported');
  });

  it('does not invent a reply or evaluation from missing evidence', () => {
    const analysis = result({ scoreCp: null, lines: [], alternatives: [] });
    const explanation = createMobileExplanation(position(), analysis, 'quick');
    expect(explanation?.replySan).toBeNull();
    expect(explanation?.alternativeSan).toBeNull();
    expect(explanation?.status).toBe('limited');
    expect(explanation?.evidenceNote).toContain('No reliable reply and score');
  });

  it('rejects an illegal principal variation rather than showing its first reply', () => {
    const analysis = result({ lines: [{ move: 'c3b1', depth: 22, scoreCp: -40, mate: null, pv: ['c3b1', 'a1a8'] }] });
    const explanation = createMobileExplanation(position(), analysis, 'explain');
    expect(explanation?.replySan).toBeNull();
    expect(explanation?.lineSan).toEqual([]);
    expect(explanation?.status).toBe('limited');
  });

  it('marks conflicting deep searches as provisional', () => {
    const comparison = result({ bestMove: 'c3e2' });
    const explanation = createMobileExplanation(position(), result({ alternatives: [] }), 'deep', comparison);
    expect(explanation?.status).toBe('provisional');
    expect(explanation?.alternativeSan).toBeNull();
    expect(explanation?.evidenceNote).toContain('preferred different moves');
  });

  it('admits when a move has no clear local explanation', () => {
    const game = new Chess();
    const analysis = result({
      bestMove: 'a2a3', scoreCp: 0,
      lines: [{ move: 'a2a3', depth: 18, scoreCp: 0, mate: null, pv: ['a2a3', 'e7e5'] }],
      alternatives: [],
    });
    const explanation = createMobileExplanation(game, analysis, 'explain');
    expect(explanation?.whyNow).toContain('No reliable single reason');
    expect(explanation?.status).toBe('limited');
  });
});
