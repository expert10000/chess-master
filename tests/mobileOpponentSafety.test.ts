import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { exposesMajorPieceToCapture } from '../src/mobile/opponentSafety';

const BEFORE_QXD5 = 'r3kb1r/1p1b1ppp/p1qp4/2pN4/4P3/5N2/PPP2PPP/R1BQ1RK1 b kq - 3 11';

describe('mobile opponent safety', () => {
  it('flags the queen giveaway from the reported game', () => {
    expect(exposesMajorPieceToCapture(BEFORE_QXD5, 'c6d5')).toBe(true);
    const game = new Chess(BEFORE_QXD5);
    game.move('c6d5');
    expect(game.moves()).toContain('exd5');
  });

  it('allows ordinary moves and balanced queen exchanges', () => {
    expect(exposesMajorPieceToCapture(BEFORE_QXD5, 'f8e7')).toBe(false);
    expect(exposesMajorPieceToCapture(BEFORE_QXD5, 'e8c8')).toBe(false);
    const exchange = '4k3/8/8/3q4/3Q4/8/8/4K3 w - - 0 1';
    expect(exposesMajorPieceToCapture(exchange, 'd4d5')).toBe(false);
  });
});
