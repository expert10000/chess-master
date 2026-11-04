import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js';
import type { MobileAnalysis, MobileLine } from './engine';

export type HintMode = 'quick' | 'explain' | 'deep';

export const HINT_MODES: Record<HintMode, { label: string; duration: string; description: string }> = {
  quick: { label: 'Quick', duration: 'about 1 s', description: 'A fast move suggestion' },
  explain: { label: 'Explain', duration: 'about 4 s', description: 'A move, best reply, and comparison' },
  deep: { label: 'Deep', duration: 'about 9 s', description: 'A longer best-line search and comparison' },
};

export interface MobileExplanation {
  move: Move;
  whyNow: string;
  replySan: string | null;
  replyConsequence: string | null;
  lineSan: string[];
  alternativeSan: string | null;
  alternativeReplySan: string | null;
  alternativeGapCp: number | null;
  status: 'supported' | 'provisional' | 'limited';
  evidenceNote: string;
  depth: number;
  elapsedMs: number;
}

const PIECE_NAMES: Record<PieceSymbol, string> = {
  p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king',
};

function replayLine(fen: string, uciLine: string[], maxPlies: number): { moves: Move[]; complete: boolean } {
  const board = new Chess(fen);
  const moves: Move[] = [];
  for (const uci of uciLine.slice(0, maxPlies)) {
    if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return { moves, complete: false };
    try {
      moves.push(board.move({ from: uci.slice(0, 2), to: uci.slice(2, 4), promotion: uci[4] ?? 'q' }));
    } catch {
      return { moves, complete: false };
    }
  }
  return { moves, complete: true };
}

function newlyAttackedEnemy(game: Chess, after: Chess, move: Move): string | null {
  const value: Record<PieceSymbol, number> = { q: 5, r: 4, b: 3, n: 3, p: 2, k: 1 };
  const enemies = after.board().flat()
    .filter((piece) => piece && piece.color !== move.color)
    .sort((a, b) => value[b!.type] - value[a!.type]);
  for (const piece of enemies) {
    if (!piece) continue;
    const square = piece.square as Square;
    if (after.attackers(square, move.color).includes(move.to) && !game.attackers(square, move.color).includes(move.from)) {
      return `${PIECE_NAMES[move.piece]} on ${move.to} now attacks the opponent's ${PIECE_NAMES[piece.type]} on ${square}`;
    }
  }
  return null;
}

function escapedAttacker(game: Chess, after: Chess, move: Move): { square: Square; piece: PieceSymbol } | null {
  const opponent = move.color === 'w' ? 'b' : 'w';
  if (after.isAttacked(move.to, opponent)) return null;
  const attackers = game.attackers(move.from, opponent);
  const square = attackers.find((candidate) => game.get(candidate)?.type === 'p') ?? attackers[0];
  const piece = square && game.get(square);
  return square && piece ? { square, piece: piece.type } : null;
}

function boardFact(game: Chess, move: Move): string | null {
  const after = new Chess(game.fen());
  after.move({ from: move.from, to: move.to, promotion: move.promotion ?? 'q' });
  if (move.san.includes('#')) return `${move.san} checkmates the opponent's king`;
  if (game.isCheck()) return `your king was in check, and ${move.san} is a legal escape`;

  const attacker = escapedAttacker(game, after, move);
  if (attacker) return `the opponent's ${PIECE_NAMES[attacker.piece]} on ${attacker.square} attacks your ${PIECE_NAMES[move.piece]} on ${move.from}; ${move.san} moves it out of that attack`;

  if (move.captured) return `${move.san} captures the opponent's ${PIECE_NAMES[move.captured]} on ${move.to}`;
  if (move.san.includes('+')) return `${move.san} gives check, requiring a king-safe reply`;
  if (move.san.startsWith('O-O')) return `${move.san} moves the king away from the center and brings a rook toward the middle`;
  if (move.promotion) return `${move.san} promotes the pawn to a ${PIECE_NAMES[move.promotion]}`;

  const attacked = newlyAttackedEnemy(game, after, move);
  if (attacked) return attacked;

  if ((move.piece === 'n' || move.piece === 'b') && ['1', '8'].includes(move.from[1])) {
    const centralSquares = (['d4', 'e4', 'd5', 'e5'] as Square[])
      .filter((square) => after.attackers(square, move.color).includes(move.to) && !game.attackers(square, move.color).includes(move.from));
    const center = centralSquares.length ? ` and adds pressure on ${centralSquares.join(' and ')}` : '';
    return `${move.san} develops the ${PIECE_NAMES[move.piece]} from ${move.from}${center}`;
  }
  if (move.piece === 'p' && ['d4', 'e4', 'd5', 'e5'].includes(move.to)) {
    return `${move.san} places a pawn on the central square ${move.to}`;
  }
  return null;
}

function validAlternative(fen: string, primary: MobileLine | undefined, candidate: MobileLine | undefined): { move: Move; reply: Move | null; gapCp: number | null } | null {
  if (!primary || !candidate || primary.move === candidate.move || candidate.depth < 8) return null;
  const line = replayLine(fen, candidate.pv, 6);
  if (!line.complete || line.moves[0] && `${line.moves[0].from}${line.moves[0].to}${line.moves[0].promotion ?? ''}` !== candidate.move) return null;
  if (!line.moves[0]) return null;
  const gapCp = primary.scoreCp === null || candidate.scoreCp === null || Math.abs(primary.depth - candidate.depth) > 2
    ? null : primary.scoreCp - candidate.scoreCp;
  return { move: line.moves[0], reply: line.moves[1] ?? null, gapCp };
}

export function createMobileExplanation(game: Chess, analysis: MobileAnalysis, mode: HintMode, comparison?: MobileAnalysis): MobileExplanation | null {
  if (!analysis.bestMove) return null;
  let move: Move;
  try {
    move = new Chess(game.fen()).move({
      from: analysis.bestMove.slice(0, 2),
      to: analysis.bestMove.slice(2, 4),
      promotion: analysis.bestMove[4] ?? 'q',
    });
  } catch {
    return null;
  }

  const main = analysis.lines[0];
  const line = main?.pv[0] === analysis.bestMove ? replayLine(game.fen(), main.pv, mode === 'deep' ? 8 : 6) : null;
  const legalLine = line?.complete && line.moves[0]?.from === move.from && line.moves[0]?.to === move.to ? line.moves : [];
  const whyNow = boardFact(game, move);
  const reply = legalLine[1] ?? null;
  let replyConsequence: string | null = null;
  if (reply) {
    if (reply.captured && reply.to === move.to) replyConsequence = `The opponent recaptures on ${reply.to} in this line.`;
    else if (reply.san.includes('+')) replyConsequence = 'The opponent replies with check in this line.';
    else {
      const after = new Chess(game.fen());
      after.move({ from: move.from, to: move.to, promotion: move.promotion ?? 'q' });
      const escaped = escapedAttacker(game, after, move);
      after.move({ from: reply.from, to: reply.to, promotion: reply.promotion ?? 'q' });
      if (escaped && after.get(move.to)?.color === move.color && after.get(escaped.square)?.type === escaped.piece
        && !after.attackers(move.to, move.color === 'w' ? 'b' : 'w').includes(escaped.square)) {
        replyConsequence = `Your ${PIECE_NAMES[move.piece]} remains outside that ${PIECE_NAMES[escaped.piece]}'s attack after the reply.`;
      }
    }
    const followup = legalLine[2];
    if (followup) {
      const afterReply = new Chess(game.fen());
      afterReply.move({ from: move.from, to: move.to, promotion: move.promotion ?? 'q' });
      afterReply.move({ from: reply.from, to: reply.to, promotion: reply.promotion ?? 'q' });
      const afterFollowup = new Chess(afterReply.fen());
      afterFollowup.move({ from: followup.from, to: followup.to, promotion: followup.promotion ?? 'q' });
      const pressure = newlyAttackedEnemy(afterReply, afterFollowup, followup);
      if (pressure) replyConsequence = `${replyConsequence ? `${replyConsequence} ` : ''}Then ${followup.san}: ${pressure}.`;
    }
  }

  const searchesDisagree = Boolean(comparison && comparison.bestMove && comparison.bestMove !== analysis.bestMove);
  const candidate = searchesDisagree ? undefined : (comparison ?? analysis).alternatives[0];
  const candidatePrimary = comparison && !searchesDisagree ? comparison.lines[0] : main;
  const alternative = validAlternative(game.fen(), candidatePrimary, candidate);
  const hasScore = analysis.scoreCp !== null || analysis.mate !== null;
  const status: MobileExplanation['status'] = !whyNow || !reply || !hasScore
    ? 'limited'
    : analysis.depth < 12 || searchesDisagree ? 'provisional' : 'supported';
  const evidenceNote = searchesDisagree
    ? 'The long and comparison searches preferred different moves, so treat this hint as provisional.'
    : !reply || !hasScore
      ? 'No reliable reply and score were returned. The move is shown without a confident explanation.'
      : !whyNow
        ? 'The line is legal, but this offline search did not isolate one clear reason for the move.'
        : analysis.depth < 12
          ? 'This is a shallow search. A longer analysis may change the recommendation.'
          : 'The board fact and reply are checked; the engine line is a searched continuation, not a forced proof.';

  return {
    move,
    whyNow: whyNow ? `${whyNow[0].toUpperCase()}${whyNow.slice(1)}.` : 'No reliable single reason identified in this search.',
    replySan: reply?.san ?? null,
    replyConsequence,
    lineSan: legalLine.map((step) => step.san),
    alternativeSan: alternative?.move.san ?? null,
    alternativeReplySan: alternative?.reply?.san ?? null,
    alternativeGapCp: alternative?.gapCp ?? null,
    status,
    evidenceNote,
    depth: analysis.depth,
    elapsedMs: analysis.elapsedMs + (comparison?.elapsedMs ?? 0),
  };
}
