import { describe, expect, it } from 'vitest';
import { Chess, type Square } from 'chess.js';
import { PUZZLES, puzzlePositions, puzzleStart, tryPuzzleMove } from '../src/lib/puzzles';

describe('offline puzzles', () => {
  it('has legal setup and complete solution lines for every bundled puzzle', () => {
    expect(PUZZLES.length).toBeGreaterThan(700);
    for (const puzzle of PUZZLES) {
      expect(puzzle.moves.length % 2).toBe(0);
      const positions = puzzlePositions(puzzle);
      expect(positions.length).toBe(puzzle.moves.length);
      expect(positions[0].fen()).toBe(puzzleStart(puzzle).fen());
    }
  });

  it('keeps the board after an incorrect move and plays the published reply after a correct one', () => {
    const puzzle = PUZZLES.find((item) => item.moves.length >= 4)!;
    const game = puzzleStart(puzzle);
    const expected = puzzle.moves[1];
    const legalAlternative = game.moves({ verbose: true }).find((move) => `${move.from}${move.to}` !== expected);
    if (legalAlternative) {
      const wrong = tryPuzzleMove(puzzle, game, 1, legalAlternative.from, legalAlternative.to);
      expect(wrong.correct).toBe(false);
      expect(wrong.game.fen()).toBe(game.fen());
    }
    const result = tryPuzzleMove(puzzle, game, 1, expected.slice(0, 2) as Square, expected.slice(2, 4) as Square);
    expect(result.correct).toBe(true);
    const replay = new Chess(game.fen());
    replay.move(expected);
    replay.move(puzzle.moves[2]);
    expect(result.game.fen()).toBe(replay.fen());
    expect(result.nextIndex).toBe(3);
  });

  it('accepts another legal checkmate in one', () => {
    const puzzle = PUZZLES.find((item) => item.id === '43jqD')!;
    const game = puzzleStart(puzzle);
    const result = tryPuzzleMove(puzzle, game, 1, 'h8', 'h2');
    expect(result.correct).toBe(true);
    expect(result.solved).toBe(true);
    expect(result.game.isCheckmate()).toBe(true);
  });
});
