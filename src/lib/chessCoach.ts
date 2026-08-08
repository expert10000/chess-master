import { Chess, type Color, type Square } from 'chess.js';
import type { AnalyseResult, EngineLine } from '../types/engine';
import { analyzeMoveConcepts, analyzePositionConcepts, conceptsAsBullets, type ChessConcept } from './chessConcepts';

export type Verdict = 'Best' | 'Excellent' | 'Good' | 'Inaccuracy' | 'Mistake' | 'Blunder';

export interface MoveReview {
  beforeFen: string;
  playedUci: string;
  bestMoveUci: string | null;
  concepts: ChessConcept[];
  verdict: Verdict;
  centipawnLoss: number;
  title: string;
  summary: string;
  reasons: string[];
  bestMoveSan: string | null;
  playedLineSan: string[];
  bestLineSan: string[];
  /** Raw UCI principal variations used by the board line player. */
  playedLineUci?: string[];
  bestLineUci?: string[];
  bestEvaluation: string;
  playedEvaluation: string;
  /** Stockfish score normalized to White's point of view. Added in v0.8.2 for timelines. */
  bestScoreCpWhite?: number | null;
  playedScoreCpWhite?: number | null;
  bestMateWhite?: number | null;
  playedMateWhite?: number | null;
}

const pieceNames: Record<string, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

const pieceValues: Record<string, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 0,
};

export function classifyLoss(loss: number): Verdict {
  if (loss <= 12) return 'Best';
  if (loss <= 30) return 'Excellent';
  if (loss <= 70) return 'Good';
  if (loss <= 120) return 'Inaccuracy';
  if (loss <= 250) return 'Mistake';
  return 'Blunder';
}

function lineNumeric(line: EngineLine | undefined, mover: Color): number {
  if (!line) return 0;
  if (line.mate !== null) {
    const whiteValue = line.mate > 0 ? 100_000 - Math.abs(line.mate) * 100 : -100_000 + Math.abs(line.mate) * 100;
    return mover === 'w' ? whiteValue : -whiteValue;
  }
  const cp = line.scoreCp ?? 0;
  return mover === 'w' ? cp : -cp;
}

export function formatEvaluation(line: EngineLine | undefined): string {
  if (!line) return '—';
  if (line.mate !== null) return line.mate > 0 ? `M${line.mate}` : `-M${Math.abs(line.mate)}`;
  const pawns = (line.scoreCp ?? 0) / 100;
  return `${pawns >= 0 ? '+' : ''}${pawns.toFixed(2)}`;
}

export function uciToSan(fen: string, uci: string): string | null {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return null;
  const game = new Chess(fen);
  try {
    const move = game.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4] ?? 'q',
    });
    return move.san;
  } catch {
    return null;
  }
}

export function uciLineToSan(fen: string, line: string[], limit = 8): string[] {
  const game = new Chess(fen);
  const san: string[] = [];
  for (const uci of line.slice(0, limit)) {
    try {
      const move = game.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4] ?? 'q',
      });
      san.push(move.san);
    } catch {
      break;
    }
  }
  return san;
}

function verdictSummary(verdict: Verdict, loss: number, bestMoveSan: string | null): string {
  const best = bestMoveSan ? ` The engine preferred ${bestMoveSan}.` : '';
  switch (verdict) {
    case 'Best':
      return 'This was the engine’s first choice or effectively equivalent to it.';
    case 'Excellent':
      return 'This preserved nearly all of the position’s value and followed the right plan.';
    case 'Good':
      return `This was sound, although a more precise continuation was available.${best}`;
    case 'Inaccuracy':
      return `This gave away a modest part of the advantage or allowed unnecessary counterplay.${best}`;
    case 'Mistake':
      return `This changed the evaluation substantially—about ${(loss / 100).toFixed(1)} pawns compared with best play.${best}`;
    case 'Blunder':
      return `This lost a major amount of value—about ${(loss / 100).toFixed(1)} pawns or a decisive tactical sequence.${best}`;
  }
}

export function createMoveReview(input: {
  beforeFen: string;
  uci: string;
  san: string;
  best: AnalyseResult;
  played: AnalyseResult;
}): MoveReview {
  const game = new Chess(input.beforeFen);
  const mover = game.turn();
  const from = input.uci.slice(0, 2);
  const to = input.uci.slice(2, 4);
  const movingPiece = game.get(from as Square);
  const bestLine = input.best.lines[0];
  const playedLine = input.played.lines[0];
  const bestNumeric = lineNumeric(bestLine, mover);
  const playedNumeric = lineNumeric(playedLine, mover);
  const centipawnLoss = Math.max(0, Math.round(bestNumeric - playedNumeric));
  const verdict = classifyLoss(centipawnLoss);
  const bestMoveSan = input.best.bestMove ? uciToSan(input.beforeFen, input.best.bestMove) : null;
  const reasons: string[] = [];
  const concepts = analyzeMoveConcepts(input.beforeFen, input.uci);

  let move;
  try {
    move = game.move({ from, to, promotion: input.uci[4] ?? 'q' });
  } catch {
    throw new Error(`Could not reconstruct move ${input.uci}.`);
  }

  const flags = move.flags;
  if (input.best.bestMove === input.uci) {
    reasons.push('It matches Stockfish’s first choice in the position.');
  }
  if (flags.includes('k') || flags.includes('q')) {
    reasons.push('It castles, improving king safety while activating a rook.');
  }
  if (move.captured) {
    const captured = pieceNames[move.captured] ?? move.captured;
    const value = pieceValues[move.captured] ?? 0;
    reasons.push(`It captures a ${captured}${value ? ` worth roughly ${value} points` : ''}.`);
  }
  if (game.isCheck()) {
    reasons.push('It gives check, forcing the opponent to answer an immediate threat.');
  }
  if (movingPiece && ['n', 'b'].includes(movingPiece.type)) {
    const homeRank = mover === 'w' ? '1' : '8';
    if (from.endsWith(homeRank)) reasons.push(`It develops the ${pieceNames[movingPiece.type]} from its starting square.`);
  }
  if (['d4', 'e4', 'd5', 'e5'].includes(to)) {
    reasons.push('It occupies or contests a central square, increasing space and piece influence.');
  }
  if (flags.includes('p')) {
    reasons.push(`It promotes the pawn to a ${pieceNames[input.uci[4] ?? 'q'] ?? 'queen'}.`);
  }
  const queenLeavesHomeEarly = movingPiece?.type === 'q'
    && Number(from[1]) === (mover === 'w' ? 1 : 8)
    && (mover === 'w' ? Number(to[1]) <= 4 : Number(to[1]) >= 5);
  if (queenLeavesHomeEarly) {
    reasons.push('The queen moves early, so its safety and the lost development tempo must be justified tactically.');
  }

  const bestLineSan = uciLineToSan(input.beforeFen, bestLine?.pv ?? []);
  const playedLineSan = uciLineToSan(input.beforeFen, playedLine?.pv ?? []);

  if (input.best.bestMove && input.best.bestMove !== input.uci && bestMoveSan) {
    const continuation = bestLineSan.slice(0, 5).join(' ');
    reasons.push(
      continuation
        ? `The stronger alternative was ${bestMoveSan}; a principal continuation is ${continuation}.`
        : `The stronger alternative was ${bestMoveSan}.`,
    );
  }

  for (const concept of concepts.slice(0, 4)) {
    const sentence = `${concept.label}: ${concept.detail}`;
    if (!reasons.includes(sentence)) reasons.push(sentence);
  }

  if (reasons.length === 0) {
    const continuation = playedLineSan.slice(0, 5).join(' ');
    reasons.push(
      continuation
        ? `Its main point is revealed by the continuation ${continuation}.`
        : 'Its value is positional rather than an immediate capture or check.',
    );
  }

  return {
    beforeFen: input.beforeFen,
    playedUci: input.uci,
    bestMoveUci: input.best.bestMove ?? null,
    concepts,
    verdict,
    centipawnLoss,
    title: `${input.san} — ${verdict}`,
    summary: verdictSummary(verdict, centipawnLoss, bestMoveSan),
    reasons,
    bestMoveSan,
    playedLineSan,
    bestLineSan,
    playedLineUci: playedLine?.pv ? [...playedLine.pv] : [],
    bestLineUci: bestLine?.pv ? [...bestLine.pv] : [],
    bestEvaluation: formatEvaluation(bestLine),
    playedEvaluation: formatEvaluation(playedLine),
    bestScoreCpWhite: bestLine?.scoreCp ?? null,
    playedScoreCpWhite: playedLine?.scoreCp ?? null,
    bestMateWhite: bestLine?.mate ?? null,
    playedMateWhite: playedLine?.mate ?? null,
  };
}

export type CoachQuestion = 'why-move' | 'why-best' | 'what-threat' | 'show-line';

export interface CoachAnswer {
  title: string;
  text: string;
  bullets: string[];
  lineSan: string[];
  concepts?: ChessConcept[];
}

export interface ResolvedMoveInput {
  uci: string;
  san: string;
}

/** Resolve either UCI (e2e4, e7e8q) or SAN (Nf3, O-O, Qxd5+) in a position. */
export function resolveMoveInput(fen: string, rawInput: string): ResolvedMoveInput | null {
  const input = rawInput.trim();
  if (!input) return null;
  const game = new Chess(fen);
  const legalMoves = game.moves({ verbose: true });
  const normalized = input.replace(/0/g, 'O').replace(/\s+/g, '').toLowerCase();

  for (const move of legalMoves) {
    const uci = `${move.from}${move.to}${move.promotion ?? ''}`;
    const sanNormalized = move.san.replace(/\s+/g, '').toLowerCase();
    if (uci.toLowerCase() === normalized || sanNormalized === normalized) {
      return { uci, san: move.san };
    }
  }
  return null;
}

function firstForcingMove(line: string[]): string | null {
  return line.find((san, index) => index > 0 && (san.includes('x') || san.includes('+') || san.includes('#') || san.includes('='))) ?? null;
}

export function answerCoachQuestion(review: MoveReview, question: CoachQuestion): CoachAnswer {
  const bestLine = review.bestLineSan.slice(0, 8);
  const playedLine = review.playedLineSan.slice(0, 8);
  const forcing = firstForcingMove(bestLine);

  switch (question) {
    case 'why-move': {
      const quality = review.verdict === 'Best' || review.verdict === 'Excellent'
        ? 'The move works because it keeps the position close to Stockfish’s preferred play.'
        : review.verdict === 'Good'
          ? 'The move is sound, but Stockfish found a more precise continuation.'
          : 'The move has a concrete drawback compared with the engine’s best continuation.';
      return {
        title: `Why ${review.title.split(' — ')[0]}?`,
        text: quality,
        bullets: review.reasons.slice(0, 5),
        lineSan: playedLine,
        concepts: review.concepts,
      };
    }
    case 'why-best': {
      const best = review.bestMoveSan ?? 'the engine move';
      const loss = (review.centipawnLoss / 100).toFixed(2);
      const bestConcepts = review.bestMoveUci ? analyzeMoveConcepts(review.beforeFen, review.bestMoveUci) : [];
      return {
        title: `Why is ${best} stronger?`,
        text: review.centipawnLoss <= 12
          ? `${best} is essentially equivalent to the played move at this search depth.`
          : `${best} preserves about ${loss} pawns more evaluation than the played move in Stockfish’s calculation.`,
        bullets: [
          bestLine.length ? `Stockfish’s principal line begins ${bestLine.join(' ')}.` : 'Stockfish ranks this as its first choice.',
          playedLine.length ? `After the played move, its main line is ${playedLine.join(' ')}.` : 'The played move leads to a less favorable evaluated position.',
        ],
        lineSan: bestLine,
        concepts: bestConcepts,
      };
    }
    case 'what-threat': {
      return {
        title: 'What is the concrete idea or threat?',
        text: forcing
          ? `The principal variation contains the forcing move ${forcing}. This is the clearest concrete signal in Stockfish’s line.`
          : 'Stockfish does not show an immediate forcing capture or check in the short principal variation; the point appears mainly positional.',
        bullets: [
          bestLine.length ? `Best continuation: ${bestLine.join(' ')}.` : 'No principal variation is available.',
          'A principal variation is evidence of the engine’s calculation, not a proof that the opponent must choose every move in it.',
        ],
        lineSan: bestLine,
      };
    }
    case 'show-line':
      return {
        title: 'Show the calculation',
        text: 'Here are the two concrete lines used to compare the move.',
        bullets: [
          bestLine.length ? `Best: ${bestLine.join(' ')}` : 'Best line unavailable.',
          playedLine.length ? `Played: ${playedLine.join(' ')}` : 'Played-move line unavailable.',
        ],
        lineSan: bestLine,
      };
  }
}

// v0.6.0 — deterministic conversational coach. The parser and answer generator stay
// local and ground every chess claim in the current board plus Stockfish output.
export type ConversationIntent =
  | 'why-current-move'
  | 'why-best-move'
  | 'compare-move'
  | 'threat'
  | 'plan'
  | 'calculation'
  | 'material'
  | 'king-safety'
  | 'development'
  | 'tactics'
  | 'pawn-structure'
  | 'positional'
  | 'unknown';

export interface ParsedCoachPrompt {
  raw: string;
  intent: ConversationIntent;
  move: ResolvedMoveInput | null;
}

export interface ConversationAnswer extends CoachAnswer {
  confidenceNote: string;
}

const capturePieceAliases: Record<string, string> = {
  pawn: 'p',
  knight: 'n',
  horse: 'n',
  bishop: 'b',
  rook: 'r',
  castle: 'r',
  queen: 'q',
};

function legalMoveMention(fen: string, raw: string): ResolvedMoveInput | null {
  const whole = resolveMoveInput(fen, raw);
  if (whole) return whole;

  const tokenPattern = /(?:O-O-O|O-O|[a-h][1-8][a-h][1-8][qrbn]?|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?[+#]?)/gi;
  const tokens = raw.replace(/0/g, 'O').match(tokenPattern) ?? [];
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const resolved = resolveMoveInput(fen, tokens[index]);
    if (resolved) return resolved;
  }

  const lower = raw.toLowerCase();
  const captureWord = Object.keys(capturePieceAliases).find((name) =>
    lower.includes(`take the ${name}`)
    || lower.includes(`take ${name}`)
    || lower.includes(`capture the ${name}`)
    || lower.includes(`capture ${name}`),
  );
  if (captureWord) {
    const targetType = capturePieceAliases[captureWord];
    const game = new Chess(fen);
    const captures = game.moves({ verbose: true }).filter((move) => move.captured === targetType);
    if (captures.length === 1) {
      const move = captures[0];
      return { uci: `${move.from}${move.to}${move.promotion ?? ''}`, san: move.san };
    }
  }

  return null;
}

export function parseCoachPrompt(fen: string, raw: string): ParsedCoachPrompt {
  const question = raw.trim();
  const lower = question.toLowerCase();
  const move = legalMoveMention(fen, question);

  if (move && /(?:why\s+not|what\s+if|instead|rather|how\s+about|can\s+i|could\s+i|should\s+i|play\s+)/i.test(question)) {
    return { raw: question, intent: 'compare-move', move };
  }
  if (/why\s+(?:is|was).*best|why.*stronger|why.*engine|best\s+move/i.test(question)) {
    return { raw: question, intent: 'why-best-move', move };
  }
  if (/why\s+(?:is|was|did)|why\s+this|why\s+my\s+move/i.test(question)) {
    return { raw: question, intent: move ? 'compare-move' : 'why-current-move', move };
  }
  if (/threat|threaten|tactic|danger|what.*coming|what.*wants/i.test(question)) {
    return { raw: question, intent: 'threat', move };
  }
  if (/plan|strategy|strategic|what\s+should\s+i\s+do|where\s+should\s+i\s+play/i.test(question)) {
    return { raw: question, intent: 'plan', move };
  }
  if (/line|variation|calculate|calculation|continuation|what\s+happens/i.test(question)) {
    return { raw: question, intent: move ? 'compare-move' : 'calculation', move };
  }
  if (/fork|pin|skewer|double\s+attack|discovered|overload|hanging|loose\s+piece|tactical\s+motif|tactics|combination/i.test(question)) {
    return { raw: question, intent: 'tactics', move };
  }
  if (/pawn\s+structure|isolated|doubled|passed\s+pawn|pawn\s+weakness|weak\s+pawn/i.test(question)) {
    return { raw: question, intent: 'pawn-structure', move };
  }
  if (/weak\s+square|outpost|open\s+file|semi-open|bishop\s+pair|space|positional|positionally|weakness|strong\s+square/i.test(question)) {
    return { raw: question, intent: 'positional', move };
  }
  if (/material|piece\s+count|ahead\s+in\s+material|down\s+material/i.test(question)) {
    return { raw: question, intent: 'material', move };
  }
  if (/king\s+safety|safe\s+king|castle|castling|king\s+exposed/i.test(question)) {
    return { raw: question, intent: 'king-safety', move };
  }
  if (/develop|development|undeveloped|activate\s+pieces|piece\s+activity/i.test(question)) {
    return { raw: question, intent: 'development', move };
  }
  if (move) return { raw: question, intent: 'compare-move', move };
  return { raw: question, intent: 'unknown', move: null };
}

function moveFeatures(fen: string, uci: string): string[] {
  const game = new Chess(fen);
  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  const beforePiece = game.get(from);
  const features: string[] = [];
  let move;
  try {
    move = game.move({ from, to, promotion: uci[4] ?? 'q' });
  } catch {
    return features;
  }

  if (move.captured) features.push(`captures a ${pieceNames[move.captured] ?? move.captured}`);
  if (game.isCheckmate()) features.push('gives checkmate');
  else if (game.isCheck()) features.push('gives check and forces a reply');
  if (move.flags.includes('k') || move.flags.includes('q')) features.push('castles and improves king safety');
  if (beforePiece && ['n', 'b'].includes(beforePiece.type)) {
    const homeRank = move.color === 'w' ? '1' : '8';
    if (from.endsWith(homeRank)) features.push(`develops the ${pieceNames[beforePiece.type]} from its home square`);
  }
  if (['d4', 'e4', 'd5', 'e5'].includes(to)) features.push('increases central control');
  if (move.promotion) features.push(`promotes to a ${pieceNames[move.promotion] ?? 'piece'}`);
  return features;
}

function materialSummary(fen: string): { text: string; bullets: string[] } {
  const game = new Chess(fen);
  let white = 0;
  let black = 0;
  const counts: Record<'w' | 'b', Record<string, number>> = {
    w: { p: 0, n: 0, b: 0, r: 0, q: 0 },
    b: { p: 0, n: 0, b: 0, r: 0, q: 0 },
  };
  for (const row of game.board()) {
    for (const piece of row) {
      if (!piece || piece.type === 'k') continue;
      const value = pieceValues[piece.type] ?? 0;
      if (piece.color === 'w') white += value;
      else black += value;
      counts[piece.color][piece.type] += 1;
    }
  }
  const diff = white - black;
  const text = Math.abs(diff) < 0.01
    ? `Material is approximately equal at ${white} points each, ignoring the kings.`
    : diff > 0
      ? `White is ahead by roughly ${diff} material point${diff === 1 ? '' : 's'} (${white} to ${black}).`
      : `Black is ahead by roughly ${Math.abs(diff)} material point${Math.abs(diff) === 1 ? '' : 's'} (${black} to ${white}).`;
  const compact = (color: 'w' | 'b') => `Q${counts[color].q} R${counts[color].r} B${counts[color].b} N${counts[color].n} P${counts[color].p}`;
  return { text, bullets: [`White: ${compact('w')}`, `Black: ${compact('b')}`] };
}

function firstOpponentForcingMove(line: string[]): string | null {
  for (let index = 1; index < line.length; index += 2) {
    const san = line[index];
    if (san && (san.includes('x') || san.includes('+') || san.includes('#') || san.includes('='))) return san;
  }
  return null;
}

export function answerPositionQuestion(
  fen: string,
  analysis: AnalyseResult,
  prompt: ParsedCoachPrompt,
): ConversationAnswer {
  const first = analysis.lines[0];
  const bestMoveUci = analysis.bestMove ?? first?.pv[0] ?? null;
  const bestMoveSan = bestMoveUci ? uciToSan(fen, bestMoveUci) : null;
  const bestLineSan = uciLineToSan(fen, first?.pv ?? [], 10);
  const features = bestMoveUci ? moveFeatures(fen, bestMoveUci) : [];
  const positionConcepts = analyzePositionConcepts(fen);
  const bestMoveConcepts = bestMoveUci ? analyzeMoveConcepts(fen, bestMoveUci) : [];
  const relevantConcepts = [...bestMoveConcepts, ...positionConcepts].filter((concept, index, all) => all.findIndex((candidate) => candidate.id === concept.id) === index).slice(0, 10);
  const game = new Chess(fen);
  const side = game.turn() === 'w' ? 'White' : 'Black';
  const opponent = game.turn() === 'w' ? 'Black' : 'White';
  const confidenceNote = `Grounded in Stockfish ${analysis.engineName ?? ''} at depth ${first?.depth ?? '—'}; prose and named concepts are generated by deterministic chess rules.`.replace(/\s+/g, ' ').trim();

  if (prompt.intent === 'material') {
    const material = materialSummary(fen);
    return {
      title: 'Material balance',
      text: material.text,
      bullets: material.bullets,
      lineSan: bestLineSan,
      concepts: positionConcepts.filter((concept) => concept.category === 'material' || concept.category === 'structure').slice(0, 8),
      confidenceNote,
    };
  }

  if (prompt.intent === 'tactics') {
    const tactical = relevantConcepts.filter((concept) => concept.category === 'tactical');
    return {
      title: 'Tactical motifs',
      text: tactical.length
        ? `I can verify ${tactical.length} tactical motif${tactical.length === 1 ? '' : 's'} from the board geometry and the best move.`
        : 'The deterministic detector does not find a clear fork, pin, skewer, hanging piece, overloaded defender, or discovered line in the immediate position. Check the Stockfish continuation for deeper tactics.',
      bullets: tactical.length ? conceptsAsBullets(tactical, 8) : [bestLineSan.length ? `Stockfish line: ${bestLineSan.join(' ')}.` : 'No principal variation is available.'],
      lineSan: bestLineSan,
      concepts: tactical,
      confidenceNote,
    };
  }

  if (prompt.intent === 'pawn-structure') {
    const structure = positionConcepts.filter((concept) => concept.category === 'structure');
    return {
      title: 'Pawn structure',
      text: structure.length
        ? `The main verified pawn-structure features are ${structure.slice(0, 3).map((concept) => concept.label.toLowerCase()).join(', ')}.`
        : 'No doubled, isolated, or passed pawn is detected by the current structural rules.',
      bullets: conceptsAsBullets(structure, 8),
      lineSan: bestLineSan,
      concepts: structure,
      confidenceNote,
    };
  }

  if (prompt.intent === 'positional') {
    const positional = relevantConcepts.filter((concept) => ['positional', 'development', 'king'].includes(concept.category));
    return {
      title: 'Positional features',
      text: positional.length
        ? `The clearest verified positional features are ${positional.slice(0, 3).map((concept) => concept.label.toLowerCase()).join(', ')}.`
        : `Stockfish prefers ${bestMoveSan ?? 'the engine continuation'}, but the current rule set does not attach a high-confidence named positional motif to it.`,
      bullets: conceptsAsBullets(positional, 8),
      lineSan: bestLineSan,
      concepts: positional,
      confidenceNote,
    };
  }

  if (prompt.intent === 'king-safety') {
    const castling = fen.split(' ')[2] ?? '-';
    const ownRights = game.turn() === 'w' ? /[KQ]/.test(castling) : /[kq]/.test(castling);
    const bullets = [
      game.isCheck() ? `${side}'s king is currently in check, so the check must be answered immediately.` : `${side}'s king is not currently in check.`,
      ownRights ? `${side} still has at least one castling right in the FEN.` : `${side} has no remaining castling right in this position.`,
    ];
    if (bestMoveSan) bullets.push(`Stockfish's first choice is ${bestMoveSan}${features.length ? `, which ${features.join(', ')}` : ''}.`);
    return {
      title: 'King safety',
      text: game.isCheck()
        ? 'King safety is the immediate priority because the side to move is in check.'
        : 'There is no forced check right now; judge king safety through open lines, castling status, and the engine continuation.',
      bullets,
      lineSan: bestLineSan,
      concepts: relevantConcepts.filter((concept) => concept.category === 'king' || concept.category === 'tactical').slice(0, 8),
      confidenceNote,
    };
  }

  if (prompt.intent === 'development') {
    return {
      title: 'Development and activity',
      text: bestMoveSan
        ? `${side}'s best practical direction starts with ${bestMoveSan}.`
        : 'Stockfish did not return a best move for this position.',
      bullets: features.length
        ? features.map((feature) => `${bestMoveSan} ${feature}.`)
        : ['The short engine line does not expose a simple one-feature development explanation; inspect the continuation for piece coordination.'],
      lineSan: bestLineSan,
      concepts: relevantConcepts.filter((concept) => concept.category === 'development' || concept.category === 'positional').slice(0, 8),
      confidenceNote,
    };
  }

  if (prompt.intent === 'threat') {
    const forcing = firstOpponentForcingMove(bestLineSan);
    return {
      title: `What is ${opponent} threatening?`,
      text: forcing
        ? `The clearest forcing idea in the principal variation is ${forcing}.`
        : `Stockfish's main line does not show an immediate forcing capture or check by ${opponent} in the next few moves. The danger is more likely positional or depends on how ${side} responds.`,
      bullets: [
        bestMoveSan ? `${side}'s best response is ${bestMoveSan}.` : 'No best response was returned.',
        bestLineSan.length ? `Principal variation: ${bestLineSan.join(' ')}.` : 'No principal variation is available.',
      ],
      lineSan: bestLineSan,
      concepts: relevantConcepts.filter((concept) => concept.category === 'tactical').slice(0, 8),
      confidenceNote,
    };
  }

  if (prompt.intent === 'calculation') {
    return {
      title: 'Stockfish calculation',
      text: bestMoveSan ? `Stockfish starts with ${bestMoveSan} at ${formatEvaluation(first)}.` : 'Stockfish did not return a best move.',
      bullets: analysis.lines.slice(0, 3).map((line) => {
        const san = uciLineToSan(fen, line.pv, 8);
        return `#${line.multipv}: ${formatEvaluation(line)} — ${san.join(' ') || 'line unavailable'}`;
      }),
      lineSan: bestLineSan,
      concepts: bestMoveConcepts.slice(0, 8),
      confidenceNote,
    };
  }

  if (prompt.intent === 'why-best-move' || prompt.intent === 'plan' || prompt.intent === 'unknown') {
    const defaultText = prompt.intent === 'plan'
      ? `A concrete plan for ${side} is to begin with ${bestMoveSan ?? 'the engine move'} and follow the coordination shown in the principal variation.`
      : prompt.intent === 'unknown'
        ? `I interpreted this as a question about the current position. Stockfish prefers ${bestMoveSan ?? 'no move was returned'}.`
        : `Stockfish prefers ${bestMoveSan ?? 'this continuation'} because it preserves the best evaluated outcome among the searched candidates.`;
    return {
      title: prompt.intent === 'plan' ? `Plan for ${side}` : bestMoveSan ? `Why ${bestMoveSan}?` : 'Current position',
      text: defaultText,
      bullets: [
        ...(features.length ? features.map((feature) => `${bestMoveSan} ${feature}.`) : []),
        ...conceptsAsBullets(relevantConcepts, 5),
        analysis.lines.length > 1
          ? `The top alternatives evaluate ${analysis.lines.slice(0, 3).map((line) => formatEvaluation(line)).join(', ')}, so the ranking comes from comparing concrete continuations.`
          : 'Only one engine line is available for this answer.',
      ].slice(0, 8),
      lineSan: bestLineSan,
      concepts: relevantConcepts,
      confidenceNote,
    };
  }

  return {
    title: 'Coach answer',
    text: bestMoveSan ? `Stockfish prefers ${bestMoveSan}.` : 'No engine move was returned.',
    bullets: [...features, ...conceptsAsBullets(relevantConcepts, 4)].slice(0, 6),
    lineSan: bestLineSan,
    concepts: relevantConcepts,
    confidenceNote,
  };
}

export function answerComparedMove(review: MoveReview): ConversationAnswer {
  const move = review.title.split(' — ')[0];
  const difference = (review.centipawnLoss / 100).toFixed(2);
  return {
    title: `What if ${move}?`,
    text: review.centipawnLoss <= 12
      ? `${move} is essentially as strong as Stockfish's first choice at this search depth.`
      : `${move} gives up about ${difference} pawns of evaluation compared with best play, so the difference is concrete rather than stylistic.`,
    bullets: [
      ...review.reasons.slice(0, 4),
      review.bestMoveSan ? `Stockfish prefers ${review.bestMoveSan}.` : 'No different best move was returned.',
    ],
    lineSan: review.playedLineSan.slice(0, 10),
    concepts: review.concepts,
    confidenceNote: 'The comparison is calculated by Stockfish with the candidate move forced via UCI searchmoves, with deterministic tactical and positional concept detection.',
  };
}
