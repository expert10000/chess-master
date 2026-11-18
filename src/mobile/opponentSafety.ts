import { Chess, type PieceSymbol } from 'chess.js';

const PIECE_VALUE: Record<PieceSymbol, number> = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };

/** Detect a large, immediate loss before accepting a deliberately weakened engine move. */
export function exposesMajorPieceToCapture(fen: string, uci: string): boolean {
  const game = new Chess(fen);
  let move;
  try { move = game.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? 'q' }); }
  catch { return false; }
  if (move.piece !== 'q' && move.piece !== 'r') return false;
  if (PIECE_VALUE[move.piece] - (move.captured ? PIECE_VALUE[move.captured] : 0) < 4) return false;
  return game.moves({ verbose: true }).some((reply) =>
    reply.to === move.to && reply.captured === move.piece && PIECE_VALUE[reply.piece] < PIECE_VALUE[move.piece]);
}
