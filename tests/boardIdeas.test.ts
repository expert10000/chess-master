import { describe, expect, it } from 'vitest';
import type { MoveReview } from '../src/lib/chessCoach';
import { buildAnalysisBoardIdeas, buildReviewBoardIdeas, buildSquareControlOverlay, explainBoardIdea, explainBoardSquare } from '../src/lib/boardIdeas';

function review(overrides: Partial<MoveReview> = {}): MoveReview {
  return {
    beforeFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    playedUci: 'e2e4',
    bestMoveUci: 'e2e4',
    concepts: [],
    verdict: 'Best',
    centipawnLoss: 0,
    title: 'e4 — Best',
    summary: 'Best move.',
    reasons: [],
    bestMoveSan: 'e4',
    playedLineSan: ['e4', 'e5'],
    bestLineSan: ['e4', 'e5'],
    playedLineUci: ['e2e4', 'e7e5'],
    bestLineUci: ['e2e4', 'e7e5'],
    bestEvaluation: '+0.25',
    playedEvaluation: '+0.25',
    ...overrides,
  };
}

describe('board ideas', () => {
  it('draws the Stockfish best move from a move review', () => {
    const ideas = buildReviewBoardIdeas(review());
    expect(ideas.arrows[0]).toMatchObject({ from: 'e2', to: 'e4', kind: 'best' });
  });

  it('draws a played issue separately from the best move', () => {
    const ideas = buildReviewBoardIdeas(review({
      playedUci: 'f2f3',
      bestMoveUci: 'e2e4',
      verdict: 'Mistake',
      centipawnLoss: 180,
    }));
    expect(ideas.arrows.some((arrow) => arrow.kind === 'played' && arrow.from === 'f2' && arrow.to === 'f3')).toBe(true);
  });

  it('turns fork concept squares into tactical highlights and rays', () => {
    const ideas = buildReviewBoardIdeas(review({
      concepts: [{
        id: 'fork-e5',
        category: 'tactical',
        label: 'Fork / double attack',
        detail: 'The knight on e5 attacks queen f7 and rook c6.',
        confidence: 'high',
      }],
    }));
    expect(ideas.highlights.some((item) => item.square === 'e5' && item.kind === 'tactical')).toBe(true);
    expect(ideas.arrows.some((arrow) => arrow.kind === 'tactical' && arrow.from === 'e5')).toBe(true);
  });

  it('draws MultiPV candidates with a distinct candidate arrow', () => {
    const ideas = buildAnalysisBoardIdeas({
      bestMove: 'e2e4',
      ponder: null,
      elapsedMs: 100,
      engineName: 'Stockfish 18',
      lines: [
        { multipv: 1, depth: 18, scoreCp: 25, mate: null, pv: ['e2e4', 'e7e5'] },
        { multipv: 2, depth: 18, scoreCp: 18, mate: null, pv: ['d2d4', 'd7d5'] },
      ],
    });
    expect(ideas.arrows.some((arrow) => arrow.kind === 'best' && arrow.to === 'e4')).toBe(true);
    expect(ideas.arrows.some((arrow) => arrow.kind === 'candidate' && arrow.to === 'd4')).toBe(true);
  });

  it('explains a best-move arrow in user-facing language', () => {
    const ideas = buildReviewBoardIdeas(review());
    const explanation = explainBoardIdea({ type: 'arrow', item: ideas.arrows[0] });
    expect(explanation.title).toContain('e2 → e4');
    expect(explanation.text).toContain('Stockfish');
    expect(explanation.suggestedQuestion).toContain('e2');
  });

  it('explains a highlighted tactical square with its concept detail', () => {
    const ideas = buildReviewBoardIdeas(review({
      concepts: [{
        id: 'hanging-f6',
        category: 'tactical',
        label: 'Hanging piece',
        detail: 'Black\'s knight on f6 is attacked and has no defender.',
        confidence: 'high',
      }],
    }));
    const highlight = ideas.highlights.find((item) => item.square === 'f6');
    expect(highlight).toBeTruthy();
    const explanation = explainBoardIdea({ type: 'highlight', item: highlight! });
    expect(explanation.title).toContain('f6');
    expect(explanation.text).toContain('no defender');
  });


  it('inspects an ordinary piece square with attackers and contextual questions', () => {
    const explanation = explainBoardSquare('4k3/8/8/3n4/2B5/8/8/4K3 w - - 0 1', 'd5');
    expect(explanation.title).toContain('Black knight');
    expect(explanation.text).toContain('bishop c4');
    expect(explanation.bullets.some((bullet) => bullet.includes('White attacks d5'))).toBe(true);
    expect(explanation.suggestedQuestions?.some((question) => question.includes('Where should the knight'))).toBe(true);
  });

  it('inspects an empty square and reports both sides direct control', () => {
    const explanation = explainBoardSquare('4k3/8/8/8/2B5/8/5n2/4K3 w - - 0 1', 'd3');
    expect(explanation.title).toBe('Square d3');
    expect(explanation.text).toContain('empty');
    expect(explanation.bullets.some((bullet) => bullet.startsWith('White attackers:'))).toBe(true);
    expect(explanation.bullets.some((bullet) => bullet.startsWith('Black attackers:'))).toBe(true);
    expect(explanation.suggestedQuestions?.some((question) => question.includes('safely occupy d3'))).toBe(true);
  });

});


describe('v0.8.6 square control overlay', () => {
  it('draws attackers and defenders into an occupied inspected square', () => {
    const fen = '4k3/8/5n2/3n4/2B5/8/8/4K3 w - - 0 1';
    const overlay = buildSquareControlOverlay(fen, 'd5', 'all');
    expect(overlay.pieceColor).toBe('b');
    expect(overlay.whiteAttackers).toContain('c4');
    expect(overlay.blackAttackers).toContain('f6');
    expect(overlay.arrows.some((arrow) => arrow.from === 'c4' && arrow.to === 'd5' && arrow.kind === 'white-control')).toBe(true);
    expect(overlay.arrows.some((arrow) => arrow.from === 'f6' && arrow.to === 'd5' && arrow.kind === 'black-control')).toBe(true);
  });

  it('can isolate attackers from defenders for an occupied square', () => {
    const fen = '4k3/8/5n2/3n4/2B5/8/8/4K3 w - - 0 1';
    const attackers = buildSquareControlOverlay(fen, 'd5', 'enemy');
    const defenders = buildSquareControlOverlay(fen, 'd5', 'friendly');
    expect(attackers.arrows.map((arrow) => arrow.from)).toEqual(['c4']);
    expect(defenders.arrows.map((arrow) => arrow.from)).toEqual(['f6']);
  });

  it('draws all legal destinations for the inspected side-to-move piece', () => {
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const overlay = buildSquareControlOverlay(start, 'g1', 'legal');
    expect(overlay.legalDestinations.sort()).toEqual(['f3', 'h3']);
    expect(overlay.arrows.every((arrow) => arrow.kind === 'legal' && arrow.from === 'g1')).toBe(true);
  });

  it('shows White direct control for an empty square', () => {
    const start = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const overlay = buildSquareControlOverlay(start, 'e3', 'all');
    expect(overlay.pieceColor).toBeNull();
    expect(overlay.whiteAttackers.sort()).toEqual(['d2', 'f2']);
    expect(overlay.blackAttackers).toHaveLength(0);
  });
});
