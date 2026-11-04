import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { openingHint } from '../src/mobile/openingHint';
import { hintTip } from '../src/mobile/tips';

describe('mobile opening hints', () => {
  it('offers a known opening continuation and explains knight development', () => {
    const game = new Chess();
    game.loadPgn('1. e4 e5');
    const hint = openingHint(game);
    expect(hint?.move.san).toBe('Nf3');
    expect(hintTip(hint!.move)).toContain('develops a knight');
  });

  it('does not use a book continuation after a player leaves its exact line', () => {
    const game = new Chess();
    game.loadPgn('1. Nc3 d5');
    expect(openingHint(game)).toBeNull();
  });

  it('explains a knight retreat forced by an advancing pawn', () => {
    const game = new Chess();
    game.loadPgn('1. e4 d5 2. Nc3 d4');
    const preview = new Chess(game.fen());
    const retreat = preview.move('Nb1');
    expect(hintTip(retreat, game)).toContain('pawn on d4 attacks your knight on c3');
    expect(hintTip(retreat, game)).toContain('gives back the knight’s development');
  });
});
