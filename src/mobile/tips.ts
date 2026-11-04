import { Chess, type Move } from 'chess.js';

export function moveTip(move: Move, game: Chess): string {
  if (game.isCheckmate()) return 'Checkmate. Well played! Start a new game when you’re ready.';
  if (game.isDraw()) return 'The game is drawn. Try a new opening in the next game.';
  if (move.san.includes('+')) return 'That gives check. Before your next move, look at every way the king can escape.';
  if (move.san.includes('O-O')) return 'Castling tucks your king away and brings a rook closer to the action.';
  if (move.captured) return 'After a capture, pause and check whether the opponent can recapture.';
  if (move.piece === 'p' && ['d4', 'e4', 'd5', 'e5'].includes(move.to)) {
    return 'A pawn in the center controls useful squares. Now develop pieces behind it.';
  }
  if ((move.piece === 'n' || move.piece === 'b') && game.history().length < 12) {
    return 'Good development idea: bring pieces toward the center before moving the same piece again.';
  }
  return 'Before choosing a move, scan for checks, captures, and threats on both sides.';
}

export function hintTip(move: Move, game?: Chess): string {
  if (move.san.includes('#')) return 'This move ends the game with checkmate.';
  if (move.san.includes('+')) return 'This move gives check. Look at the king’s legal replies.';
  if (move.captured) return 'This move captures a piece. Check the exchange before playing it.';
  if (move.san.includes('O-O')) return 'This move castles, improving king safety and rook activity.';
  if (move.piece === 'p' && ['d4', 'e4', 'd5', 'e5'].includes(move.to)) {
    return 'This move claims space in the center.';
  }
  if (move.piece === 'n' && game) {
    const opponent = move.color === 'w' ? 'b' : 'w';
    const pawnAttacker = game.attackers(move.from, opponent).find((square) => game.get(square)?.type === 'p');
    if (pawnAttacker) {
      const retreatNote = ['b1', 'g1', 'b8', 'g8'].includes(move.to)
        ? ' This is safe, but it gives back the knight’s development; compare other safe squares too.'
        : '';
      return `The opponent's pawn on ${pawnAttacker} attacks your knight on ${move.from}. Moving it to ${move.to} avoids that pawn.${retreatNote}`;
    }
  }
  if (move.piece === 'n' && ['b1', 'g1', 'b8', 'g8'].includes(move.from) && ['c3', 'f3', 'c6', 'f6'].includes(move.to)) {
    return 'This develops a knight toward the center and brings another piece into play.';
  }
  if (move.piece === 'n' && ['b1', 'g1', 'b8', 'g8'].includes(move.to)) {
    return 'This retreats a knight. Check the opponent’s threats and look for another safe square before deciding.';
  }
  return 'Look at the highlighted start and destination squares, then decide what the move improves.';
}
