import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';
import { uciToSan, type MoveReview } from './chessCoach';

export type PositionMetricId =
  | 'development'
  | 'kingSafety'
  | 'centerControl'
  | 'pawnStructure'
  | 'pieceActivity'
  | 'tacticalPressure';

export interface PositionMetric {
  id: PositionMetricId;
  label: string;
  value: number;
  detail: string;
}

export interface PositionProfile {
  fen: string;
  perspective: Color;
  metrics: PositionMetric[];
  overall: number;
}

export interface PositionMetricChange {
  id: PositionMetricId;
  label: string;
  before: number;
  after: number;
  delta: number;
  beforeDetail: string;
  afterDetail: string;
  interpretation: string;
}

export interface PositionalBeforeAfterComparison {
  role: 'played' | 'best';
  moveUci: string;
  moveSan: string;
  beforeFen: string;
  afterFen: string;
  perspective: Color;
  before: PositionProfile;
  after: PositionProfile;
  changes: PositionMetricChange[];
  overallDelta: number;
  headline: string;
  improvements: PositionMetricChange[];
  declines: PositionMetricChange[];
}

interface BoardPiece {
  square: Square;
  color: Color;
  type: PieceSymbol;
}

const FILES = 'abcdefgh';
const RANKS = '12345678';
const CENTER: Square[] = ['d4', 'e4', 'd5', 'e5'];
const PIECE_VALUE: Record<PieceSymbol, number> = {
  p: 1,
  n: 3,
  b: 3.15,
  r: 5,
  q: 9,
  k: 2,
};

const METRIC_WEIGHTS: Record<PositionMetricId, number> = {
  development: 0.18,
  kingSafety: 0.20,
  centerControl: 0.17,
  pawnStructure: 0.15,
  pieceActivity: 0.15,
  tacticalPressure: 0.15,
};

function clamp(value: number, minimum = 0, maximum = 10): number {
  return Math.max(minimum, Math.min(maximum, value));
}

function rounded(value: number): number {
  return Math.round(value * 10) / 10;
}

function squareAt(file: number, rank: number): Square | null {
  if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
  return `${FILES[file]}${RANKS[rank]}` as Square;
}

function squareCoordinates(square: Square): [number, number] {
  return [FILES.indexOf(square[0]), RANKS.indexOf(square[1])];
}

function pieces(game: Chess): BoardPiece[] {
  const result: BoardPiece[] = [];
  for (const file of FILES) {
    for (const rank of RANKS) {
      const square = `${file}${rank}` as Square;
      const piece = game.get(square);
      if (piece) result.push({ square, color: piece.color, type: piece.type });
    }
  }
  return result;
}

function geometricAttackSquares(game: Chess, piece: BoardPiece): Square[] {
  const [file, rank] = squareCoordinates(piece.square);
  const attacks: Square[] = [];

  if (piece.type === 'p') {
    const direction = piece.color === 'w' ? 1 : -1;
    for (const df of [-1, 1]) {
      const target = squareAt(file + df, rank + direction);
      if (target) attacks.push(target);
    }
    return attacks;
  }

  if (piece.type === 'n') {
    const jumps = [
      [1, 2], [2, 1], [2, -1], [1, -2],
      [-1, -2], [-2, -1], [-2, 1], [-1, 2],
    ];
    for (const [df, dr] of jumps) {
      const target = squareAt(file + df, rank + dr);
      if (target) attacks.push(target);
    }
    return attacks;
  }

  if (piece.type === 'k') {
    for (let df = -1; df <= 1; df += 1) {
      for (let dr = -1; dr <= 1; dr += 1) {
        if (!df && !dr) continue;
        const target = squareAt(file + df, rank + dr);
        if (target) attacks.push(target);
      }
    }
    return attacks;
  }

  const directions: Array<[number, number]> = [];
  if (piece.type === 'b' || piece.type === 'q') {
    directions.push([1, 1], [1, -1], [-1, 1], [-1, -1]);
  }
  if (piece.type === 'r' || piece.type === 'q') {
    directions.push([1, 0], [-1, 0], [0, 1], [0, -1]);
  }

  for (const [df, dr] of directions) {
    let step = 1;
    while (true) {
      const target = squareAt(file + df * step, rank + dr * step);
      if (!target) break;
      attacks.push(target);
      if (game.get(target)) break;
      step += 1;
    }
  }

  return attacks;
}

function geometricDestinations(game: Chess, piece: BoardPiece): Square[] {
  return geometricAttackSquares(game, piece).filter((target) => game.get(target)?.color !== piece.color);
}

function attacksSquare(game: Chess, piece: BoardPiece, target: Square): boolean {
  return geometricAttackSquares(game, piece).includes(target);
}

function attackers(game: Chess, target: Square, color: Color): BoardPiece[] {
  return pieces(game).filter((piece) => piece.color === color && attacksSquare(game, piece, target));
}

function otherColor(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

function developmentMetric(game: Chess, color: Color): PositionMetric {
  const home = color === 'w'
    ? { knights: ['b1', 'g1'], bishops: ['c1', 'f1'], queen: 'd1', backRank: '1' }
    : { knights: ['b8', 'g8'], bishops: ['c8', 'f8'], queen: 'd8', backRank: '8' };

  let developedMinors = 0;
  for (const square of home.knights) {
    const piece = game.get(square as Square);
    if (!(piece?.color === color && piece.type === 'n')) developedMinors += 1;
  }
  for (const square of home.bishops) {
    const piece = game.get(square as Square);
    if (!(piece?.color === color && piece.type === 'b')) developedMinors += 1;
  }

  const queen = game.get(home.queen as Square);
  const queenDeveloped = !(queen?.color === color && queen.type === 'q');
  const rooks = pieces(game).filter((piece) => piece.color === color && piece.type === 'r');
  const rookActivity = rooks.filter((rook) => rook.square[1] !== home.backRank).length;

  const value = clamp(
    developedMinors * 2
      + (queenDeveloped ? 0.7 : 0)
      + rookActivity * 0.65,
  );

  return {
    id: 'development',
    label: 'Development',
    value: rounded(value),
    detail: `${developedMinors}/4 minor pieces developed${queenDeveloped ? ' · queen moved' : ''}${rookActivity ? ` · ${rookActivity} rook${rookActivity === 1 ? '' : 's'} active off the back rank` : ''}.`,
  };
}

function kingSafetyMetric(game: Chess, color: Color): PositionMetric {
  const ownPieces = pieces(game).filter((piece) => piece.color === color);
  const king = ownPieces.find((piece) => piece.type === 'k');
  if (!king) {
    return { id: 'kingSafety', label: 'King safety', value: 0, detail: 'King not found.' };
  }

  const [kingFile, kingRank] = squareCoordinates(king.square);
  const opponent = otherColor(color);
  const castled = king.square === (color === 'w' ? 'g1' : 'g8')
    || king.square === (color === 'w' ? 'c1' : 'c8');

  let shield = 0;
  const pawnDirection = color === 'w' ? 1 : -1;
  for (let df = -1; df <= 1; df += 1) {
    const target = squareAt(kingFile + df, kingRank + pawnDirection);
    if (!target) continue;
    const piece = game.get(target);
    if (piece?.color === color && piece.type === 'p') shield += 1;
  }

  let nearbyEnemyPressure = 0;
  for (let df = -1; df <= 1; df += 1) {
    for (let dr = -1; dr <= 1; dr += 1) {
      const target = squareAt(kingFile + df, kingRank + dr);
      if (!target) continue;
      nearbyEnemyPressure += attackers(game, target, opponent).length;
    }
  }

  const centralKing = king.square[0] === 'd' || king.square[0] === 'e';
  const advancedKing = color === 'w' ? kingRank >= 2 : kingRank <= 5;

  const value = clamp(
    5
      + (castled ? 2.3 : 0)
      + shield * 0.65
      - nearbyEnemyPressure * 0.32
      - (centralKing && !castled ? 0.7 : 0)
      - (advancedKing ? 0.45 : 0),
  );

  return {
    id: 'kingSafety',
    label: 'King safety',
    value: rounded(value),
    detail: `${castled ? 'Castled' : `King on ${king.square}`} · ${shield} shield pawn${shield === 1 ? '' : 's'} · ${nearbyEnemyPressure} direct attack ray${nearbyEnemyPressure === 1 ? '' : 's'} near the king.`,
  };
}

function centerControlMetric(game: Chess, color: Color): PositionMetric {
  const opponent = otherColor(color);
  let ownControl = 0;
  let enemyControl = 0;
  let ownOccupancy = 0;
  let enemyOccupancy = 0;

  for (const square of CENTER) {
    ownControl += attackers(game, square, color).length;
    enemyControl += attackers(game, square, opponent).length;
    const occupant = game.get(square);
    if (occupant?.color === color) ownOccupancy += 1;
    if (occupant?.color === opponent) enemyOccupancy += 1;
  }

  const value = clamp(
    5
      + (ownControl - enemyControl) * 0.7
      + (ownOccupancy - enemyOccupancy) * 0.9,
  );

  return {
    id: 'centerControl',
    label: 'Central control',
    value: rounded(value),
    detail: `Core center d4/e4/d5/e5: ${ownControl} own attack${ownControl === 1 ? '' : 's'} vs ${enemyControl} opponent attack${enemyControl === 1 ? '' : 's'} · occupancy ${ownOccupancy}-${enemyOccupancy}.`,
  };
}

function pawnStructureMetric(game: Chess, color: Color): PositionMetric {
  const pawns = pieces(game).filter((piece) => piece.color === color && piece.type === 'p');
  const opponentPawns = pieces(game).filter((piece) => piece.color !== color && piece.type === 'p');
  const perFile = new Map<number, BoardPiece[]>();

  for (const pawn of pawns) {
    const [file] = squareCoordinates(pawn.square);
    perFile.set(file, [...(perFile.get(file) ?? []), pawn]);
  }

  let doubled = 0;
  let isolated = 0;
  let passed = 0;

  for (const [file, filePawns] of perFile.entries()) {
    if (filePawns.length > 1) doubled += filePawns.length - 1;
    const neighborCount = (perFile.get(file - 1)?.length ?? 0) + (perFile.get(file + 1)?.length ?? 0);
    if (!neighborCount) isolated += filePawns.length;
  }

  for (const pawn of pawns) {
    const [file, rank] = squareCoordinates(pawn.square);
    const blockers = opponentPawns.some((enemy) => {
      const [enemyFile, enemyRank] = squareCoordinates(enemy.square);
      const adjacentFile = Math.abs(enemyFile - file) <= 1;
      const ahead = color === 'w' ? enemyRank > rank : enemyRank < rank;
      return adjacentFile && ahead;
    });
    if (!blockers) passed += 1;
  }

  const value = clamp(8.1 - doubled * 1.05 - isolated * 0.65 + passed * 0.35);

  return {
    id: 'pawnStructure',
    label: 'Pawn structure',
    value: rounded(value),
    detail: `${doubled} doubled · ${isolated} isolated · ${passed} passed pawn${passed === 1 ? '' : 's'} by geometric file test.`,
  };
}

function pieceActivityMetric(game: Chess, color: Color): PositionMetric {
  const ownPieces = pieces(game).filter((piece) => piece.color === color);
  let weightedMobility = 0;

  for (const piece of ownPieces) {
    if (piece.type === 'p' || piece.type === 'k') continue;
    const destinations = geometricDestinations(game, piece).length;
    const weight = piece.type === 'q' ? 0.55 : piece.type === 'r' ? 0.8 : 1;
    weightedMobility += destinations * weight;
  }

  const value = clamp(1.2 + weightedMobility / 4.5);

  return {
    id: 'pieceActivity',
    label: 'Piece activity',
    value: rounded(value),
    detail: `${rounded(weightedMobility)} weighted geometric mobility points for minor/major pieces.`,
  };
}

function tacticalPressureMetric(game: Chess, color: Color): PositionMetric {
  const opponent = otherColor(color);
  const enemyPieces = pieces(game).filter((piece) => piece.color === opponent);
  let pressure = 0;
  let hangingTargets = 0;
  let attackedTargets = 0;

  for (const target of enemyPieces) {
    if (target.type === 'k') continue;
    const ownAttackers = attackers(game, target.square, color).length;
    if (!ownAttackers) continue;

    attackedTargets += 1;
    const defenders = attackers(game, target.square, opponent).length;
    const value = PIECE_VALUE[target.type];
    pressure += Math.min(2.2, ownAttackers * 0.45 + value * 0.12);
    if (ownAttackers > defenders) {
      pressure += Math.min(1.6, value * 0.18);
      hangingTargets += 1;
    }
  }

  const enemyKing = enemyPieces.find((piece) => piece.type === 'k');
  const kingPressure = enemyKing ? attackers(game, enemyKing.square, color).length : 0;
  pressure += kingPressure * 1.1;

  const value = clamp(2 + pressure);

  return {
    id: 'tacticalPressure',
    label: 'Tactical pressure',
    value: rounded(value),
    detail: `${attackedTargets} attacked non-king target${attackedTargets === 1 ? '' : 's'} · ${hangingTargets} locally over-attacked · ${kingPressure} direct king attack${kingPressure === 1 ? '' : 's'}.`,
  };
}

export function buildPositionProfile(fen: string, perspective: Color): PositionProfile {
  const game = new Chess(fen);
  const metrics = [
    developmentMetric(game, perspective),
    kingSafetyMetric(game, perspective),
    centerControlMetric(game, perspective),
    pawnStructureMetric(game, perspective),
    pieceActivityMetric(game, perspective),
    tacticalPressureMetric(game, perspective),
  ];

  const overall = metrics.reduce(
    (sum, metric) => sum + metric.value * METRIC_WEIGHTS[metric.id],
    0,
  );

  return {
    fen,
    perspective,
    metrics,
    overall: rounded(overall),
  };
}

function applyUciMove(fen: string, uci: string): string {
  const game = new Chess(fen);
  game.move({
    from: uci.slice(0, 2),
    to: uci.slice(2, 4),
    promotion: uci[4] ?? 'q',
  });
  return game.fen();
}

function interpretation(label: string, delta: number): string {
  if (delta >= 1.2) return `${label} improves substantially.`;
  if (delta >= 0.35) return `${label} improves.`;
  if (delta <= -1.2) return `${label} deteriorates substantially.`;
  if (delta <= -0.35) return `${label} becomes weaker.`;
  return `${label} is broadly unchanged.`;
}

function compareProfiles(before: PositionProfile, after: PositionProfile): PositionMetricChange[] {
  return before.metrics.map((beforeMetric) => {
    const afterMetric = after.metrics.find((metric) => metric.id === beforeMetric.id)!;
    const delta = rounded(afterMetric.value - beforeMetric.value);
    return {
      id: beforeMetric.id,
      label: beforeMetric.label,
      before: beforeMetric.value,
      after: afterMetric.value,
      delta,
      beforeDetail: beforeMetric.detail,
      afterDetail: afterMetric.detail,
      interpretation: interpretation(beforeMetric.label, delta),
    };
  });
}

export function buildPositionalBeforeAfter(
  review: MoveReview,
  role: 'played' | 'best',
): PositionalBeforeAfterComparison | null {
  const moveUci = role === 'played' ? review.playedUci : review.bestMoveUci;
  if (!moveUci) return null;

  let afterFen: string;
  try {
    afterFen = applyUciMove(review.beforeFen, moveUci);
  } catch {
    return null;
  }

  const perspective = new Chess(review.beforeFen).turn();
  const before = buildPositionProfile(review.beforeFen, perspective);
  const after = buildPositionProfile(afterFen, perspective);
  const changes = compareProfiles(before, after);
  const overallDelta = rounded(after.overall - before.overall);
  const moveSan = role === 'best'
    ? review.bestMoveSan ?? uciToSan(review.beforeFen, moveUci) ?? moveUci
    : uciToSan(review.beforeFen, moveUci) ?? moveUci;

  const improvements = changes
    .filter((change) => change.delta >= 0.35)
    .sort((a, b) => b.delta - a.delta);
  const declines = changes
    .filter((change) => change.delta <= -0.35)
    .sort((a, b) => a.delta - b.delta);

  let headline: string;
  if (overallDelta >= 0.75) headline = `${moveSan} improves several positional features.`;
  else if (overallDelta >= 0.2) headline = `${moveSan} gives a modest positional improvement.`;
  else if (overallDelta <= -0.75) headline = `${moveSan} weakens several positional features.`;
  else if (overallDelta <= -0.2) headline = `${moveSan} gives up some positional quality.`;
  else headline = `${moveSan} is positionally close to neutral by these heuristics.`;

  return {
    role,
    moveUci,
    moveSan,
    beforeFen: review.beforeFen,
    afterFen,
    perspective,
    before,
    after,
    changes,
    overallDelta,
    headline,
    improvements,
    declines,
  };
}
