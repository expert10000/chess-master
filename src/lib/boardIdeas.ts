import { Chess, type Color, type Square } from 'chess.js';
import { formatEvaluation, type MoveReview, type Verdict } from './chessCoach';
import { analyzePositionConcepts, type ChessConcept } from './chessConcepts';
import type { AnalyseResult } from '../types/engine';

export type BoardArrowKind = 'best' | 'played' | 'candidate' | 'tactical' | 'white-control' | 'black-control' | 'legal';
export type BoardHighlightKind = 'tactical' | 'positional' | 'structure' | 'king' | 'material';

export interface BoardArrow {
  id: string;
  from: Square;
  to: Square;
  kind: BoardArrowKind;
  label?: string;
  detail?: string;
}

export interface BoardHighlight {
  id: string;
  square: Square;
  kind: BoardHighlightKind;
  label: string;
  detail?: string;
}

export interface BoardIdeas {
  arrows: BoardArrow[];
  highlights: BoardHighlight[];
}

export type InspectionOverlayMode = 'all' | 'friendly' | 'enemy' | 'legal';

export interface SquareControlOverlay {
  target: Square;
  mode: InspectionOverlayMode;
  pieceColor: Color | null;
  arrows: BoardArrow[];
  whiteAttackers: Square[];
  blackAttackers: Square[];
  legalDestinations: Square[];
  summary: string;
}

export type BoardIdeaTarget =
  | { type: 'arrow'; item: BoardArrow }
  | { type: 'highlight'; item: BoardHighlight };

export interface BoardIdeaExplanation {
  id: string;
  title: string;
  text: string;
  bullets: string[];
  suggestedQuestion: string;
  suggestedQuestions?: string[];
  category: BoardArrowKind | BoardHighlightKind;
}

const ISSUE_VERDICTS = new Set<Verdict>(['Inaccuracy', 'Mistake', 'Blunder']);
const SQUARE_RE = /\b[a-h][1-8]\b/g;

function isUciMove(value: string | null | undefined): value is string {
  return Boolean(value && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(value));
}

function arrowFromUci(uci: string, kind: BoardArrowKind, id: string, label?: string, detail?: string): BoardArrow {
  return {
    id,
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    kind,
    label,
    detail,
  };
}

function highlightKind(concept: ChessConcept): BoardHighlightKind {
  if (concept.category === 'tactical') return 'tactical';
  if (concept.category === 'structure') return 'structure';
  if (concept.category === 'king') return 'king';
  if (concept.category === 'material') return 'material';
  return 'positional';
}

function squaresMentionedByConcept(concept: ChessConcept): Square[] {
  const values = `${concept.id} ${concept.detail}`.match(SQUARE_RE) ?? [];
  return [...new Set(values)] as Square[];
}

function conceptIdeas(concepts: ChessConcept[]): BoardIdeas {
  const arrows: BoardArrow[] = [];
  const highlights: BoardHighlight[] = [];

  for (const concept of concepts.slice(0, 8)) {
    const squares = squaresMentionedByConcept(concept);
    for (const square of squares.slice(0, 3)) {
      highlights.push({
        id: `${concept.id}-${square}`,
        square,
        kind: highlightKind(concept),
        label: concept.label,
        detail: concept.detail,
      });
    }

    // Line motifs are especially useful when drawn rather than only highlighted.
    if (concept.category === 'tactical' && squares.length >= 2 && /fork|double attack/i.test(`${concept.id} ${concept.label}`)) {
      for (const target of squares.slice(1, 3)) {
        arrows.push({
          id: `concept-fork-${concept.id}-${target}`,
          from: squares[0],
          to: target,
          kind: 'tactical',
          label: concept.label,
          detail: concept.detail,
        });
      }
    } else if (
      concept.category === 'tactical'
      && squares.length >= 2
      && /pin|skewer|discovered|line attack|pressure/i.test(`${concept.id} ${concept.label}`)
    ) {
      arrows.push({
        id: `concept-arrow-${concept.id}`,
        from: squares[0],
        to: squares[1],
        kind: 'tactical',
        label: concept.label,
        detail: concept.detail,
      });
      if (squares.length >= 3 && /pin|skewer/i.test(concept.id)) {
        arrows.push({
          id: `concept-arrow-2-${concept.id}`,
          from: squares[1],
          to: squares[2],
          kind: 'tactical',
          label: concept.label,
          detail: concept.detail,
        });
      }
    }
  }

  // Deduplicate square/category pairs and exact arrows to keep the overlay calm.
  const seenHighlights = new Set<string>();
  const uniqueHighlights = highlights.filter((item) => {
    const key = `${item.square}:${item.kind}`;
    if (seenHighlights.has(key)) return false;
    seenHighlights.add(key);
    return true;
  });
  const seenArrows = new Set<string>();
  const uniqueArrows = arrows.filter((item) => {
    const key = `${item.from}:${item.to}:${item.kind}`;
    if (seenArrows.has(key)) return false;
    seenArrows.add(key);
    return true;
  });

  return { arrows: uniqueArrows, highlights: uniqueHighlights };
}

export function buildReviewBoardIdeas(review: MoveReview | null): BoardIdeas {
  if (!review) return { arrows: [], highlights: [] };

  const concept = conceptIdeas(review.concepts ?? []);
  const arrows = [...concept.arrows];

  if (isUciMove(review.bestMoveUci)) {
    arrows.unshift(arrowFromUci(
      review.bestMoveUci,
      'best',
      'review-best',
      review.bestMoveSan ?? 'Best move',
      `Stockfish preferred ${review.bestMoveSan ?? review.bestMoveUci} with an evaluation of ${review.bestEvaluation}.`,
    ));
  }
  if (
    isUciMove(review.playedUci)
    && review.playedUci !== review.bestMoveUci
    && ISSUE_VERDICTS.has(review.verdict)
  ) {
    arrows.push(arrowFromUci(
      review.playedUci,
      'played',
      'review-played',
      'Played move',
      `${review.title}. This move lost about ${(review.centipawnLoss / 100).toFixed(2)} pawns versus Stockfish's best play.`,
    ));
  }

  return { arrows: arrows.slice(0, 7), highlights: concept.highlights.slice(0, 12) };
}

export function buildAnalysisBoardIdeas(analysis: AnalyseResult | null, fen?: string): BoardIdeas {
  if (!analysis?.lines.length && !fen) return { arrows: [], highlights: [] };
  const arrows: BoardArrow[] = [];
  for (const line of (analysis?.lines ?? []).slice(0, 3)) {
    const first = line.pv[0];
    if (!isUciMove(first)) continue;
    arrows.push(arrowFromUci(
      first,
      line.multipv === 1 ? 'best' : 'candidate',
      `analysis-${line.multipv}`,
      line.multipv === 1 ? 'Best move' : `Candidate ${line.multipv}`,
      `${line.multipv === 1 ? 'Stockfish first choice' : `MultiPV candidate ${line.multipv}`} · ${formatEvaluation(line)} at depth ${line.depth}.`,
    ));
  }
  const concept = fen ? conceptIdeas(analyzePositionConcepts(fen)) : { arrows: [], highlights: [] };
  return {
    arrows: [...arrows, ...concept.arrows].slice(0, 7),
    highlights: concept.highlights.slice(0, 12),
  };
}



function arrowKindExplanation(kind: BoardArrowKind): string {
  if (kind === 'best') return 'This arrow marks Stockfish’s first-choice move in the position.';
  if (kind === 'played') return 'This arrow marks the move that was played and was graded as an issue compared with best play.';
  if (kind === 'candidate') return 'This is one of Stockfish’s MultiPV alternatives, useful for comparing different plans.';
  if (kind === 'white-control') return 'This arrow shows a White piece directly attacking or controlling the inspected square.';
  if (kind === 'black-control') return 'This arrow shows a Black piece directly attacking or controlling the inspected square.';
  if (kind === 'legal') return 'This arrow shows a legal destination for the inspected piece in the current position.';
  return 'This arrow visualizes a tactical relationship detected from the board, such as a fork, pin, skewer, or line attack.';
}

function highlightKindExplanation(kind: BoardHighlightKind): string {
  if (kind === 'tactical') return 'The square participates in a concrete tactical motif, so forcing moves and loose pieces deserve attention.';
  if (kind === 'structure') return 'The square is relevant to the pawn structure, such as a weakness, passed pawn, or file relationship.';
  if (kind === 'king') return 'The square is relevant to king safety or a king-zone weakness.';
  if (kind === 'material') return 'The square is relevant to material balance, a hanging piece, or a material-winning sequence.';
  return 'The square has positional importance, such as an outpost, central influence, or useful piece placement.';
}

export function explainBoardIdea(target: BoardIdeaTarget): BoardIdeaExplanation {
  if (target.type === 'arrow') {
    const arrow = target.item;
    const label = arrow.label ?? (arrow.kind === 'best' ? 'Best move' : 'Board arrow');
    const text = arrow.detail ?? arrowKindExplanation(arrow.kind);
    return {
      id: `arrow:${arrow.id}`,
      title: `${label}: ${arrow.from} → ${arrow.to}`,
      text,
      bullets: [
        arrowKindExplanation(arrow.kind),
        `The arrow starts on ${arrow.from} and ends on ${arrow.to}.`,
      ],
      suggestedQuestion: `Explain the ${label.toLowerCase()} from ${arrow.from} to ${arrow.to}. Why is this arrow important in this position?`,
      category: arrow.kind,
    };
  }

  const highlight = target.item;
  return {
    id: `highlight:${highlight.id}`,
    title: `${highlight.label} · ${highlight.square}`,
    text: highlight.detail ?? highlightKindExplanation(highlight.kind),
    bullets: [
      highlightKindExplanation(highlight.kind),
      `The marker is attached specifically to square ${highlight.square}.`,
    ],
    suggestedQuestion: `Why is ${highlight.square} important here? Explain the detected idea “${highlight.label}” on ${highlight.square}.`,
    category: highlight.kind,
  };
}


/* v0.8.5 — inspect any ordinary square or piece, even when it has no precomputed idea marker. */
type InspectPieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';
interface InspectPiece {
  square: Square;
  color: Color;
  type: InspectPieceType;
}

const INSPECT_FILES = 'abcdefgh';
const INSPECT_PIECE_NAMES: Record<InspectPieceType, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

function inspectOpposite(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

function inspectCoords(square: Square): [number, number] {
  return [INSPECT_FILES.indexOf(square[0]), Number(square[1])];
}

function inspectSquareOf(file: number, rank: number): Square | null {
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
  return `${INSPECT_FILES[file]}${rank}` as Square;
}

function inspectAllPieces(game: Chess): InspectPiece[] {
  const pieces: InspectPiece[] = [];
  const board = game.board();
  for (let row = 0; row < board.length; row += 1) {
    for (let file = 0; file < board[row].length; file += 1) {
      const piece = board[row][file];
      if (!piece) continue;
      pieces.push({
        square: `${INSPECT_FILES[file]}${8 - row}` as Square,
        color: piece.color,
        type: piece.type as InspectPieceType,
      });
    }
  }
  return pieces;
}

function inspectRayAttacks(game: Chess, square: Square, directions: Array<[number, number]>): Square[] {
  const [file, rank] = inspectCoords(square);
  const attacked: Square[] = [];
  for (const [df, dr] of directions) {
    let f = file + df;
    let r = rank + dr;
    while (true) {
      const target = inspectSquareOf(f, r);
      if (!target) break;
      attacked.push(target);
      if (game.get(target)) break;
      f += df;
      r += dr;
    }
  }
  return attacked;
}

function inspectAttacksFrom(game: Chess, piece: InspectPiece): Square[] {
  const [file, rank] = inspectCoords(piece.square);
  if (piece.type === 'p') {
    const dr = piece.color === 'w' ? 1 : -1;
    return [-1, 1]
      .map((df) => inspectSquareOf(file + df, rank + dr))
      .filter((square): square is Square => Boolean(square));
  }
  if (piece.type === 'n') {
    const jumps: Array<[number, number]> = [
      [1, 2], [2, 1], [2, -1], [1, -2],
      [-1, -2], [-2, -1], [-2, 1], [-1, 2],
    ];
    return jumps
      .map(([df, dr]) => inspectSquareOf(file + df, rank + dr))
      .filter((square): square is Square => Boolean(square));
  }
  if (piece.type === 'k') {
    const out: Square[] = [];
    for (let df = -1; df <= 1; df += 1) {
      for (let dr = -1; dr <= 1; dr += 1) {
        if (!df && !dr) continue;
        const target = inspectSquareOf(file + df, rank + dr);
        if (target) out.push(target);
      }
    }
    return out;
  }
  const diagonal: Array<[number, number]> = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const straight: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  if (piece.type === 'b') return inspectRayAttacks(game, piece.square, diagonal);
  if (piece.type === 'r') return inspectRayAttacks(game, piece.square, straight);
  return inspectRayAttacks(game, piece.square, [...diagonal, ...straight]);
}

function inspectAttackers(game: Chess, square: Square, color: Color): InspectPiece[] {
  return inspectAllPieces(game).filter((piece) => piece.color === color && inspectAttacksFrom(game, piece).includes(square));
}

function inspectPieceLabel(piece: InspectPiece): string {
  return `${piece.color === 'w' ? 'White' : 'Black'} ${INSPECT_PIECE_NAMES[piece.type]} ${piece.square}`;
}

function inspectAttackerList(pieces: InspectPiece[]): string {
  if (!pieces.length) return 'none';
  return pieces.map((piece) => `${INSPECT_PIECE_NAMES[piece.type]} ${piece.square}`).join(', ');
}

function squareConcepts(fen: string, square: Square): ChessConcept[] {
  return analyzePositionConcepts(fen).filter((concept) => `${concept.id} ${concept.detail}`.includes(square));
}

function pieceSpecificQuestions(piece: InspectPiece, square: Square): string[] {
  const name = INSPECT_PIECE_NAMES[piece.type];
  const color = piece.color === 'w' ? 'White' : 'Black';
  const common = [
    `Why is the ${color.toLowerCase()} ${name} on ${square} good or bad here?`,
    `Who attacks and defends ${square}, and what does that mean tactically?`,
  ];
  if (piece.type === 'n') return [...common, `Where should the knight on ${square} go next, and why?`, `Is ${square} a good outpost for this knight?`];
  if (piece.type === 'b') return [...common, `Where should the bishop on ${square} go next, and which diagonal matters most?`, `Is this bishop good or bad in the current pawn structure?`];
  if (piece.type === 'p') return [...common, `Is the pawn on ${square} weak, isolated, doubled, backward, or passed?`, `Should this pawn advance or stay on ${square}?`];
  if (piece.type === 'r') return [...common, `Which file should the rook on ${square} use?`, `Is this rook active enough on ${square}?`];
  if (piece.type === 'q') return [...common, `Is the queen on ${square} exposed to tempo attacks?`, `Where should the queen improve from ${square}?`];
  return [...common, `How safe is the king on ${square}?`, `Which squares around the king on ${square} are weak?`];
}


function inspectSquareName(piece: InspectPiece | null): string {
  if (!piece) return 'the selected square';
  return `${piece.color === 'w' ? 'White' : 'Black'} ${INSPECT_PIECE_NAMES[piece.type]} on ${piece.square}`;
}

function controlArrow(
  piece: InspectPiece,
  target: Square,
  role: 'attacker' | 'defender' | 'control',
): BoardArrow {
  const side = piece.color === 'w' ? 'White' : 'Black';
  const pieceName = INSPECT_PIECE_NAMES[piece.type];
  const roleText = role === 'defender'
    ? `defends the piece on ${target}`
    : role === 'attacker'
      ? `attacks the piece on ${target}`
      : `controls ${target}`;
  return {
    id: `inspect-${role}-${piece.square}-${target}`,
    from: piece.square,
    to: target,
    kind: piece.color === 'w' ? 'white-control' : 'black-control',
    label: role === 'defender' ? `${side} defender` : role === 'attacker' ? `${side} attacker` : `${side} control`,
    detail: `${side} ${pieceName} ${piece.square} directly ${roleText}.`,
  };
}

/**
 * Build the visible attack/defense overlay for one inspected square.
 *
 * For an occupied square, "friendly" means defenders of the occupant and
 * "enemy" means attackers of the occupant. For an empty square the same two
 * modes are presented in the UI as White control and Black control.
 */
export function buildSquareControlOverlay(
  fen: string,
  square: Square,
  mode: InspectionOverlayMode = 'all',
): SquareControlOverlay {
  const game = new Chess(fen);
  const rawPiece = game.get(square);
  const occupant: InspectPiece | null = rawPiece
    ? { square, color: rawPiece.color, type: rawPiece.type as InspectPieceType }
    : null;
  const white = inspectAttackers(game, square, 'w').filter((piece) => piece.square !== square);
  const black = inspectAttackers(game, square, 'b').filter((piece) => piece.square !== square);
  const legalMoves = occupant && occupant.color === game.turn()
    ? game.moves({ square, verbose: true })
    : [];
  const legalDestinations = [...new Set(legalMoves.map((move) => move.to as Square))];

  let selectedControllers: InspectPiece[] = [];
  if (mode === 'all') {
    selectedControllers = [...white, ...black];
  } else if (mode === 'friendly') {
    selectedControllers = occupant
      ? (occupant.color === 'w' ? white : black)
      : white;
  } else if (mode === 'enemy') {
    selectedControllers = occupant
      ? (occupant.color === 'w' ? black : white)
      : black;
  }

  const arrows: BoardArrow[] = [];
  if (mode === 'legal') {
    for (const destination of legalDestinations) {
      arrows.push({
        id: `inspect-legal-${square}-${destination}`,
        from: square,
        to: destination,
        kind: 'legal',
        label: `Legal move ${square} → ${destination}`,
        detail: `${inspectSquareName(occupant)} can legally move to ${destination} in the current position.`,
      });
    }
  } else {
    for (const controller of selectedControllers) {
      let role: 'attacker' | 'defender' | 'control' = 'control';
      if (occupant) role = controller.color === occupant.color ? 'defender' : 'attacker';
      arrows.push(controlArrow(controller, square, role));
    }
  }

  const whiteCount = white.length;
  const blackCount = black.length;
  const controlText = whiteCount === blackCount
    ? whiteCount === 0
      ? 'No direct control arrows are available.'
      : `Direct control is balanced ${whiteCount}–${blackCount}.`
    : whiteCount > blackCount
      ? `White has more direct control, ${whiteCount}–${blackCount}.`
      : `Black has more direct control, ${blackCount}–${whiteCount}.`;

  let summary = controlText;
  if (occupant) {
    const friendlyCount = occupant.color === 'w' ? whiteCount : blackCount;
    const enemyCount = occupant.color === 'w' ? blackCount : whiteCount;
    summary = `${inspectSquareName(occupant)} has ${friendlyCount} direct defender${friendlyCount === 1 ? '' : 's'} and ${enemyCount} direct attacker${enemyCount === 1 ? '' : 's'}.`;
  }
  if (mode === 'legal') {
    summary = legalDestinations.length
      ? `${legalDestinations.length} legal destination${legalDestinations.length === 1 ? '' : 's'} from ${square}.`
      : occupant && occupant.color !== game.turn()
        ? `It is ${game.turn() === 'w' ? 'White' : 'Black'} to move, so this piece has no current legal-move overlay.`
        : `No legal destinations are available from ${square}.`;
  }

  return {
    target: square,
    mode,
    pieceColor: occupant?.color ?? null,
    arrows,
    whiteAttackers: white.map((piece) => piece.square),
    blackAttackers: black.map((piece) => piece.square),
    legalDestinations,
    summary,
  };
}

export function explainBoardSquare(fen: string, square: Square): BoardIdeaExplanation {
  const game = new Chess(fen);
  const rawPiece = game.get(square);
  const whiteAttackers = inspectAttackers(game, square, 'w');
  const blackAttackers = inspectAttackers(game, square, 'b');
  const concepts = squareConcepts(fen, square);
  const conceptBullets = concepts.slice(0, 3).map((concept) => `${concept.label}: ${concept.detail}`);

  if (rawPiece) {
    const piece: InspectPiece = { square, color: rawPiece.color, type: rawPiece.type as InspectPieceType };
    const friendly = piece.color === 'w' ? whiteAttackers : blackAttackers;
    const enemy = piece.color === 'w' ? blackAttackers : whiteAttackers;
    const defenders = friendly.filter((candidate) => candidate.square !== square);
    const sideToMove = game.turn() === 'w' ? 'White' : 'Black';
    const legalMoves = piece.color === game.turn()
      ? game.moves({ square, verbose: true }).map((move) => move.san).slice(0, 10)
      : [];

    const tacticalStatus = enemy.length
      ? defenders.length
        ? `It is attacked by ${inspectAttackerList(enemy)} and defended by ${inspectAttackerList(defenders)}.`
        : `It is attacked by ${inspectAttackerList(enemy)} and currently has no direct defender.`
      : defenders.length
        ? `It is not currently attacked and is defended by ${inspectAttackerList(defenders)}.`
        : 'It is neither directly attacked nor directly defended by another piece.';

    const questions = pieceSpecificQuestions(piece, square);
    return {
      id: `square:${square}`,
      title: `${piece.color === 'w' ? 'White' : 'Black'} ${INSPECT_PIECE_NAMES[piece.type]} · ${square}`,
      text: `${inspectPieceLabel(piece)}. ${tacticalStatus}`,
      bullets: [
        `White attacks ${square}: ${inspectAttackerList(whiteAttackers)}.`,
        `Black attacks ${square}: ${inspectAttackerList(blackAttackers)}.`,
        legalMoves.length ? `${sideToMove} to move; legal moves for this piece include ${legalMoves.join(', ')}.` : `${sideToMove} to move.`,
        ...conceptBullets,
      ],
      suggestedQuestion: questions[0],
      suggestedQuestions: questions,
      category: enemy.length && defenders.length === 0 ? 'tactical' : piece.type === 'p' ? 'structure' : piece.type === 'k' ? 'king' : 'positional',
    };
  }

  const questions = [
    `Why is the square ${square} important in this position?`,
    `Who attacks ${square}, and which side controls it more effectively?`,
    `Can I safely occupy ${square}, and with which piece?`,
    `What tactical ideas depend on control of ${square}?`,
  ];
  const whiteCount = whiteAttackers.length;
  const blackCount = blackAttackers.length;
  const control = whiteCount === blackCount
    ? whiteCount === 0 ? 'Neither side directly attacks it.' : `Both sides attack it ${whiteCount} time${whiteCount === 1 ? '' : 's'}.`
    : whiteCount > blackCount
      ? `White has more direct attackers (${whiteCount} to ${blackCount}).`
      : `Black has more direct attackers (${blackCount} to ${whiteCount}).`;

  return {
    id: `square:${square}`,
    title: `Square ${square}`,
    text: `${square} is empty. ${control}`,
    bullets: [
      `White attackers: ${inspectAttackerList(whiteAttackers)}.`,
      `Black attackers: ${inspectAttackerList(blackAttackers)}.`,
      ...conceptBullets,
    ],
    suggestedQuestion: questions[0],
    suggestedQuestions: questions,
    category: concepts.some((concept) => concept.category === 'tactical') ? 'tactical' : 'positional',
  };
}
