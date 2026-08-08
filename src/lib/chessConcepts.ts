import { Chess, type Color, type Square } from 'chess.js';

export type ConceptCategory = 'tactical' | 'positional' | 'structure' | 'king' | 'development' | 'material';
export type ConceptConfidence = 'high' | 'medium';

export interface ChessConcept {
  id: string;
  category: ConceptCategory;
  label: string;
  detail: string;
  confidence: ConceptConfidence;
}

type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

interface BoardPiece {
  square: Square;
  color: Color;
  type: PieceType;
}

const FILES = 'abcdefgh';
const pieceNames: Record<PieceType, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

const pieceValues: Record<PieceType, number> = {
  p: 1,
  n: 3,
  b: 3,
  r: 5,
  q: 9,
  k: 100,
};

function opposite(color: Color): Color {
  return color === 'w' ? 'b' : 'w';
}

function squareOf(file: number, rank: number): Square | null {
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
  return `${FILES[file]}${rank}` as Square;
}

function coords(square: Square): [number, number] {
  return [FILES.indexOf(square[0]), Number(square[1])];
}

function allPieces(game: Chess): BoardPiece[] {
  const out: BoardPiece[] = [];
  const board = game.board();
  for (let row = 0; row < board.length; row += 1) {
    for (let file = 0; file < board[row].length; file += 1) {
      const piece = board[row][file];
      if (!piece) continue;
      out.push({
        square: `${FILES[file]}${8 - row}` as Square,
        color: piece.color,
        type: piece.type as PieceType,
      });
    }
  }
  return out;
}

function rayAttacks(game: Chess, square: Square, directions: Array<[number, number]>): Square[] {
  const [file, rank] = coords(square);
  const attacked: Square[] = [];
  for (const [df, dr] of directions) {
    let f = file + df;
    let r = rank + dr;
    while (true) {
      const target = squareOf(f, r);
      if (!target) break;
      attacked.push(target);
      if (game.get(target)) break;
      f += df;
      r += dr;
    }
  }
  return attacked;
}

function attacksFrom(game: Chess, piece: BoardPiece): Square[] {
  const [file, rank] = coords(piece.square);
  if (piece.type === 'p') {
    const dr = piece.color === 'w' ? 1 : -1;
    return [-1, 1]
      .map((df) => squareOf(file + df, rank + dr))
      .filter((square): square is Square => Boolean(square));
  }
  if (piece.type === 'n') {
    const jumps: Array<[number, number]> = [
      [1, 2], [2, 1], [2, -1], [1, -2],
      [-1, -2], [-2, -1], [-2, 1], [-1, 2],
    ];
    return jumps
      .map(([df, dr]) => squareOf(file + df, rank + dr))
      .filter((square): square is Square => Boolean(square));
  }
  if (piece.type === 'k') {
    const steps: Array<[number, number]> = [];
    for (let df = -1; df <= 1; df += 1) {
      for (let dr = -1; dr <= 1; dr += 1) {
        if (df || dr) steps.push([df, dr]);
      }
    }
    return steps
      .map(([df, dr]) => squareOf(file + df, rank + dr))
      .filter((square): square is Square => Boolean(square));
  }
  const diagonal: Array<[number, number]> = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const straight: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  if (piece.type === 'b') return rayAttacks(game, piece.square, diagonal);
  if (piece.type === 'r') return rayAttacks(game, piece.square, straight);
  return rayAttacks(game, piece.square, [...diagonal, ...straight]);
}

function attackersOf(game: Chess, square: Square, byColor: Color): BoardPiece[] {
  return allPieces(game).filter((piece) => piece.color === byColor && attacksFrom(game, piece).includes(square));
}

function defendersOf(game: Chess, square: Square, color: Color): BoardPiece[] {
  return attackersOf(game, square, color).filter((piece) => piece.square !== square);
}

function materialCount(game: Chess, color: Color): number {
  return allPieces(game)
    .filter((piece) => piece.color === color && piece.type !== 'k')
    .reduce((sum, piece) => sum + pieceValues[piece.type], 0);
}

function pushUnique(concepts: ChessConcept[], concept: ChessConcept): void {
  if (!concepts.some((candidate) => candidate.id === concept.id)) concepts.push(concept);
}

function detectLooseAndHanging(game: Chess, side: Color, concepts: ChessConcept[]): void {
  const enemy = opposite(side);
  for (const piece of allPieces(game).filter((candidate) => candidate.color === side && candidate.type !== 'k')) {
    const attackers = attackersOf(game, piece.square, enemy);
    if (!attackers.length) continue;
    const defenders = defendersOf(game, piece.square, side);
    const cheapest = Math.min(...attackers.map((attacker) => pieceValues[attacker.type]));
    if (defenders.length === 0) {
      pushUnique(concepts, {
        id: `hanging-${piece.square}`,
        category: 'tactical',
        label: 'Hanging piece',
        detail: `${side === 'w' ? 'White' : 'Black'}'s ${pieceNames[piece.type]} on ${piece.square} is attacked and has no defender.`,
        confidence: 'high',
      });
    } else if (cheapest < pieceValues[piece.type] && piece.type !== 'p') {
      pushUnique(concepts, {
        id: `loose-${piece.square}`,
        category: 'tactical',
        label: 'Tactical pressure',
        detail: `The ${pieceNames[piece.type]} on ${piece.square} is attacked by a lower-value piece, so exchanges and tactical sequences deserve attention.`,
        confidence: 'medium',
      });
    }
  }
}

function detectOverloadedDefenders(game: Chess, side: Color, concepts: ChessConcept[]): void {
  const enemy = opposite(side);
  const defendedTargets = new Map<Square, Square[]>();
  for (const target of allPieces(game).filter((piece) => piece.color === side && piece.type !== 'k')) {
    if (!attackersOf(game, target.square, enemy).length) continue;
    const defenders = defendersOf(game, target.square, side);
    if (defenders.length !== 1) continue;
    const defender = defenders[0];
    const targets = defendedTargets.get(defender.square) ?? [];
    targets.push(target.square);
    defendedTargets.set(defender.square, targets);
  }
  for (const [defenderSquare, targets] of defendedTargets) {
    if (targets.length < 2) continue;
    const defender = game.get(defenderSquare);
    if (!defender) continue;
    pushUnique(concepts, {
      id: `overloaded-${defenderSquare}`,
      category: 'tactical',
      label: 'Overloaded defender',
      detail: `The ${pieceNames[defender.type as PieceType]} on ${defenderSquare} is the sole defender of multiple attacked pieces (${targets.join(', ')}).`,
      confidence: 'medium',
    });
  }
}

function detectPinsAndSkewers(game: Chess, attackerColor: Color, concepts: ChessConcept[]): void {
  const enemy = opposite(attackerColor);
  const sliders = allPieces(game).filter((piece) => piece.color === attackerColor && ['b', 'r', 'q'].includes(piece.type));
  const diagonal: Array<[number, number]> = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  const straight: Array<[number, number]> = [[1, 0], [-1, 0], [0, 1], [0, -1]];

  for (const slider of sliders) {
    const directions = slider.type === 'b' ? diagonal : slider.type === 'r' ? straight : [...diagonal, ...straight];
    const [file, rank] = coords(slider.square);
    for (const [df, dr] of directions) {
      const occupied: BoardPiece[] = [];
      let f = file + df;
      let r = rank + dr;
      while (occupied.length < 2) {
        const square = squareOf(f, r);
        if (!square) break;
        const piece = game.get(square);
        if (piece) occupied.push({ square, color: piece.color, type: piece.type as PieceType });
        f += df;
        r += dr;
      }
      if (occupied.length < 2 || occupied[0].color !== enemy || occupied[1].color !== enemy) continue;
      const front = occupied[0];
      const behind = occupied[1];
      if (behind.type === 'k') {
        pushUnique(concepts, {
          id: `pin-${slider.square}-${front.square}-${behind.square}`,
          category: 'tactical',
          label: 'Pin',
          detail: `The ${pieceNames[front.type]} on ${front.square} is pinned to the king on ${behind.square} by the ${pieceNames[slider.type]} on ${slider.square}.`,
          confidence: 'high',
        });
      } else if (front.type === 'k' || pieceValues[front.type] > pieceValues[behind.type] + 1) {
        pushUnique(concepts, {
          id: `skewer-${slider.square}-${front.square}-${behind.square}`,
          category: 'tactical',
          label: 'Skewer / line pressure',
          detail: `The ${pieceNames[slider.type]} on ${slider.square} attacks the more valuable ${pieceNames[front.type]} on ${front.square}, with the ${pieceNames[behind.type]} on ${behind.square} behind it.`,
          confidence: 'medium',
        });
      } else if (pieceValues[behind.type] >= 5) {
        pushUnique(concepts, {
          id: `relative-pin-${slider.square}-${front.square}-${behind.square}`,
          category: 'tactical',
          label: 'Relative pin',
          detail: `Moving the ${pieceNames[front.type]} on ${front.square} would expose the ${pieceNames[behind.type]} on ${behind.square} to the ${pieceNames[slider.type]} on ${slider.square}.`,
          confidence: 'medium',
        });
      }
    }
  }
}

function detectPawnStructure(game: Chess, color: Color, concepts: ChessConcept[]): void {
  const sideName = color === 'w' ? 'White' : 'Black';
  const pawns = allPieces(game).filter((piece) => piece.color === color && piece.type === 'p');
  const enemyPawns = allPieces(game).filter((piece) => piece.color !== color && piece.type === 'p');
  const byFile = new Map<number, BoardPiece[]>();
  for (const pawn of pawns) {
    const [file] = coords(pawn.square);
    const bucket = byFile.get(file) ?? [];
    bucket.push(pawn);
    byFile.set(file, bucket);
  }
  for (const [file, filePawns] of byFile) {
    if (filePawns.length > 1) {
      pushUnique(concepts, {
        id: `doubled-${color}-${file}`,
        category: 'structure',
        label: 'Doubled pawns',
        detail: `${sideName} has ${filePawns.length} pawns on the ${FILES[file]}-file, which can reduce mobility and create targets.`,
        confidence: 'high',
      });
    }
  }
  for (const pawn of pawns) {
    const [file, rank] = coords(pawn.square);
    const adjacentFriendly = pawns.some((other) => {
      const [otherFile] = coords(other.square);
      return Math.abs(otherFile - file) === 1;
    });
    if (!adjacentFriendly) {
      pushUnique(concepts, {
        id: `isolated-${pawn.square}`,
        category: 'structure',
        label: 'Isolated pawn',
        detail: `${sideName}'s pawn on ${pawn.square} has no friendly pawn on an adjacent file.`,
        confidence: 'high',
      });
    }

    const passed = !enemyPawns.some((enemyPawn) => {
      const [enemyFile, enemyRank] = coords(enemyPawn.square);
      if (Math.abs(enemyFile - file) > 1) return false;
      return color === 'w' ? enemyRank > rank : enemyRank < rank;
    });
    if (passed) {
      pushUnique(concepts, {
        id: `passed-${pawn.square}`,
        category: 'structure',
        label: 'Passed pawn',
        detail: `${sideName}'s pawn on ${pawn.square} has no opposing pawn ahead on its own or adjacent files.`,
        confidence: 'high',
      });
    }
  }
}

function detectBishopPair(game: Chess, color: Color, concepts: ChessConcept[]): void {
  const bishops = allPieces(game).filter((piece) => piece.color === color && piece.type === 'b');
  const enemyBishops = allPieces(game).filter((piece) => piece.color !== color && piece.type === 'b');
  if (bishops.length >= 2 && enemyBishops.length < 2) {
    pushUnique(concepts, {
      id: `bishop-pair-${color}`,
      category: 'positional',
      label: 'Bishop pair',
      detail: `${color === 'w' ? 'White' : 'Black'} retains both bishops, which can be valuable in open positions and on both color complexes.`,
      confidence: 'high',
    });
  }
}

function detectOutposts(game: Chess, color: Color, concepts: ChessConcept[]): void {
  const enemy = opposite(color);
  const knights = allPieces(game).filter((piece) => piece.color === color && piece.type === 'n');
  for (const knight of knights) {
    const [, rank] = coords(knight.square);
    const advanced = color === 'w' ? rank >= 5 : rank <= 4;
    if (!advanced) continue;
    const defendedByPawn = attackersOf(game, knight.square, color).some((piece) => piece.type === 'p');
    const attackableByEnemyPawn = attackersOf(game, knight.square, enemy).some((piece) => piece.type === 'p');
    if (defendedByPawn && !attackableByEnemyPawn) {
      pushUnique(concepts, {
        id: `outpost-${knight.square}`,
        category: 'positional',
        label: 'Knight outpost',
        detail: `The knight on ${knight.square} is supported by a pawn and cannot be challenged there by an enemy pawn.`,
        confidence: 'high',
      });
    }
  }
}

function detectOpenFiles(game: Chess, color: Color, concepts: ChessConcept[]): void {
  const pieces = allPieces(game);
  const ownHeavy = pieces.filter((piece) => piece.color === color && ['r', 'q'].includes(piece.type));
  for (const heavy of ownHeavy) {
    const [file] = coords(heavy.square);
    const pawnsOnFile = pieces.filter((piece) => piece.type === 'p' && coords(piece.square)[0] === file);
    if (pawnsOnFile.length === 0) {
      pushUnique(concepts, {
        id: `open-file-${color}-${file}`,
        category: 'positional',
        label: 'Open file',
        detail: `${color === 'w' ? 'White' : 'Black'}'s ${pieceNames[heavy.type]} on ${heavy.square} is placed on the open ${FILES[file]}-file.`,
        confidence: 'high',
      });
    } else if (!pawnsOnFile.some((pawn) => pawn.color === color)) {
      pushUnique(concepts, {
        id: `semi-open-file-${color}-${file}`,
        category: 'positional',
        label: 'Semi-open file',
        detail: `${color === 'w' ? 'White' : 'Black'}'s ${pieceNames[heavy.type]} on ${heavy.square} is on a semi-open ${FILES[file]}-file with no friendly pawn blocking it.`,
        confidence: 'high',
      });
    }
  }
}

function detectKingSafety(game: Chess, color: Color, concepts: ChessConcept[]): void {
  const king = allPieces(game).find((piece) => piece.color === color && piece.type === 'k');
  if (!king) return;
  const enemy = opposite(color);
  const [file, rank] = coords(king.square);
  const adjacent: Square[] = [];
  for (let df = -1; df <= 1; df += 1) {
    for (let dr = -1; dr <= 1; dr += 1) {
      if (!df && !dr) continue;
      const square = squareOf(file + df, rank + dr);
      if (square) adjacent.push(square);
    }
  }
  const attackedRing = adjacent.filter((square) => attackersOf(game, square, enemy).length).length;
  const sideName = color === 'w' ? 'White' : 'Black';
  if (attackedRing >= 4) {
    pushUnique(concepts, {
      id: `king-ring-${color}`,
      category: 'king',
      label: 'Exposed king zone',
      detail: `${attackedRing} squares immediately around ${sideName}'s king on ${king.square} are attacked by enemy pieces.`,
      confidence: 'medium',
    });
  }
  if (['g1', 'c1', 'g8', 'c8'].includes(king.square)) {
    pushUnique(concepts, {
      id: `castled-${color}`,
      category: 'king',
      label: 'Castled king',
      detail: `${sideName}'s king is on a typical castled square (${king.square}), so king safety is already partly established.`,
      confidence: 'medium',
    });
  }
}

function detectDevelopment(game: Chess, concepts: ChessConcept[]): void {
  const homes: Record<Color, Square[]> = {
    w: ['b1', 'g1', 'c1', 'f1'],
    b: ['b8', 'g8', 'c8', 'f8'],
  };
  const undeveloped: Record<Color, number> = { w: 0, b: 0 };
  for (const color of ['w', 'b'] as Color[]) {
    for (const square of homes[color]) {
      const piece = game.get(square);
      if (piece && piece.color === color && ['n', 'b'].includes(piece.type)) undeveloped[color] += 1;
    }
  }
  const difference = undeveloped.w - undeveloped.b;
  if (Math.abs(difference) >= 2) {
    const leader: Color = difference < 0 ? 'w' : 'b';
    const lagger: Color = opposite(leader);
    pushUnique(concepts, {
      id: 'development-lead',
      category: 'development',
      label: 'Development lead',
      detail: `${leader === 'w' ? 'White' : 'Black'} has developed noticeably more minor pieces; ${lagger === 'w' ? 'White' : 'Black'} still has ${undeveloped[lagger]} minor pieces on their home squares.`,
      confidence: 'high',
    });
  }
}

function detectCentralInfluence(game: Chess, concepts: ChessConcept[]): void {
  const centers = ['d4', 'e4', 'd5', 'e5'] as Square[];
  const influence: Record<Color, number> = { w: 0, b: 0 };
  for (const color of ['w', 'b'] as Color[]) {
    for (const square of centers) {
      if (attackersOf(game, square, color).length) influence[color] += 1;
      const occupant = game.get(square);
      if (occupant?.color === color) influence[color] += 1;
    }
  }
  const diff = influence.w - influence.b;
  if (Math.abs(diff) >= 2) {
    const side: Color = diff > 0 ? 'w' : 'b';
    pushUnique(concepts, {
      id: 'center-control',
      category: 'positional',
      label: 'Central influence',
      detail: `${side === 'w' ? 'White' : 'Black'} currently has the clearer influence over the four central squares d4, e4, d5 and e5.`,
      confidence: 'medium',
    });
  }
}

export function analyzePositionConcepts(fen: string): ChessConcept[] {
  const game = new Chess(fen);
  const concepts: ChessConcept[] = [];
  detectLooseAndHanging(game, 'w', concepts);
  detectLooseAndHanging(game, 'b', concepts);
  detectOverloadedDefenders(game, 'w', concepts);
  detectOverloadedDefenders(game, 'b', concepts);
  detectPinsAndSkewers(game, 'w', concepts);
  detectPinsAndSkewers(game, 'b', concepts);
  detectPawnStructure(game, 'w', concepts);
  detectPawnStructure(game, 'b', concepts);
  detectBishopPair(game, 'w', concepts);
  detectBishopPair(game, 'b', concepts);
  detectOutposts(game, 'w', concepts);
  detectOutposts(game, 'b', concepts);
  detectOpenFiles(game, 'w', concepts);
  detectOpenFiles(game, 'b', concepts);
  detectKingSafety(game, 'w', concepts);
  detectKingSafety(game, 'b', concepts);
  detectDevelopment(game, concepts);
  detectCentralInfluence(game, concepts);
  return concepts;
}

function attackedValuableTargets(game: Chess, attackerSquare: Square, attackerColor: Color): BoardPiece[] {
  const attacker = allPieces(game).find((piece) => piece.square === attackerSquare && piece.color === attackerColor);
  if (!attacker) return [];
  return attacksFrom(game, attacker)
    .map((square) => {
      const piece = game.get(square);
      return piece ? { square, color: piece.color, type: piece.type as PieceType } : null;
    })
    .filter((piece): piece is BoardPiece => Boolean(piece && piece.color !== attackerColor && (piece.type === 'k' || pieceValues[piece.type] >= 3)));
}

function sliderAttacksValuable(game: Chess, color: Color): Set<string> {
  const keys = new Set<string>();
  for (const slider of allPieces(game).filter((piece) => piece.color === color && ['b', 'r', 'q'].includes(piece.type))) {
    for (const targetSquare of attacksFrom(game, slider)) {
      const target = game.get(targetSquare);
      if (target && target.color !== color && (target.type === 'k' || pieceValues[target.type as PieceType] >= 3)) {
        keys.add(`${slider.square}-${targetSquare}`);
      }
    }
  }
  return keys;
}

export function analyzeMoveConcepts(fen: string, uci: string): ChessConcept[] {
  if (!/^[a-h][1-8][a-h][1-8][qrbn]?$/.test(uci)) return [];
  const before = new Chess(fen);
  const mover = before.turn();
  const from = uci.slice(0, 2) as Square;
  const to = uci.slice(2, 4) as Square;
  const moving = before.get(from);
  if (!moving || moving.color !== mover) return [];
  const beforeSliderAttacks = sliderAttacksValuable(before, mover);
  const beforeMaterial = materialCount(before, mover) - materialCount(before, opposite(mover));
  const beforeDefendedEnemyTargets = new Map<Square, Square[]>();
  for (const enemyPiece of allPieces(before).filter((piece) => piece.color !== mover && piece.type !== 'k')) {
    const defenders = defendersOf(before, enemyPiece.square, enemyPiece.color);
    if (defenders.length === 1) {
      const list = beforeDefendedEnemyTargets.get(defenders[0].square) ?? [];
      list.push(enemyPiece.square);
      beforeDefendedEnemyTargets.set(defenders[0].square, list);
    }
  }

  let move;
  try {
    move = before.move({ from, to, promotion: uci[4] ?? 'q' });
  } catch {
    return [];
  }
  const after = before;
  const concepts: ChessConcept[] = [];
  const movedPiece = after.get(to);
  const sideName = mover === 'w' ? 'White' : 'Black';

  if (movedPiece) {
    const valuableTargets = attackedValuableTargets(after, to, mover);
    if (valuableTargets.length >= 2) {
      pushUnique(concepts, {
        id: `fork-${to}`,
        category: 'tactical',
        label: 'Fork / double attack',
        detail: `${move.san} leaves the ${pieceNames[movedPiece.type as PieceType]} on ${to} attacking ${valuableTargets.slice(0, 3).map((target) => `${pieceNames[target.type]} ${target.square}`).join(' and ')}.`,
        confidence: 'high',
      });
    }
  }

  const afterSliderAttacks = sliderAttacksValuable(after, mover);
  const newlyOpened = [...afterSliderAttacks].filter((key) => !beforeSliderAttacks.has(key));
  if (newlyOpened.length && moving.type !== 'b' && moving.type !== 'r' && moving.type !== 'q') {
    const [slider, target] = newlyOpened[0].split('-');
    pushUnique(concepts, {
      id: `discovered-${slider}-${target}`,
      category: 'tactical',
      label: 'Discovered line attack',
      detail: `${move.san} opens a line from ${slider} onto the valuable enemy piece on ${target}.`,
      confidence: 'medium',
    });
  }

  if (move.captured) {
    const capturedSquare = to;
    const defendedTargets = beforeDefendedEnemyTargets.get(capturedSquare) ?? [];
    if (defendedTargets.length) {
      pushUnique(concepts, {
        id: `remove-defender-${capturedSquare}`,
        category: 'tactical',
        label: 'Removal of defender',
        detail: `${move.san} removes the piece on ${capturedSquare}, which was the sole defender of ${defendedTargets.join(', ')} before the capture.`,
        confidence: 'medium',
      });
    }
  }

  const afterMaterial = materialCount(after, mover) - materialCount(after, opposite(mover));
  if (afterMaterial > beforeMaterial) {
    pushUnique(concepts, {
      id: `material-gain-${to}`,
      category: 'material',
      label: 'Material gain',
      detail: `${move.san} improves ${sideName}'s raw material balance by about ${afterMaterial - beforeMaterial} point${afterMaterial - beforeMaterial === 1 ? '' : 's'}.`,
      confidence: 'high',
    });
  }

  if (after.isCheckmate()) {
    pushUnique(concepts, {
      id: `mate-${to}`,
      category: 'tactical',
      label: 'Checkmate',
      detail: `${move.san} ends the game by checkmate.`,
      confidence: 'high',
    });
  } else if (after.isCheck()) {
    pushUnique(concepts, {
      id: `check-${to}`,
      category: 'tactical',
      label: 'Forcing check',
      detail: `${move.san} gives check, so the opponent must answer the king threat immediately.`,
      confidence: 'high',
    });
  }

  if (move.flags.includes('k') || move.flags.includes('q')) {
    pushUnique(concepts, {
      id: `castle-${to}`,
      category: 'king',
      label: 'Castling',
      detail: `${move.san} improves king safety and connects a rook to the game in one move.`,
      confidence: 'high',
    });
  }

  if (['d4', 'e4', 'd5', 'e5'].includes(to)) {
    pushUnique(concepts, {
      id: `center-${to}`,
      category: 'positional',
      label: 'Central occupation',
      detail: `${move.san} places a piece or pawn directly on the central square ${to}.`,
      confidence: 'high',
    });
  }

  if (moving.type === 'n') {
    const [, rank] = coords(to);
    const advanced = mover === 'w' ? rank >= 5 : rank <= 4;
    const defendedByPawn = attackersOf(after, to, mover).some((piece) => piece.type === 'p');
    const enemyPawnAttack = attackersOf(after, to, opposite(mover)).some((piece) => piece.type === 'p');
    if (advanced && defendedByPawn && !enemyPawnAttack) {
      pushUnique(concepts, {
        id: `move-outpost-${to}`,
        category: 'positional',
        label: 'Creates an outpost',
        detail: `${move.san} places the knight on ${to}, supported by a pawn and not challengeable there by an enemy pawn.`,
        confidence: 'high',
      });
    }
  }

  detectPinsAndSkewers(after, mover, concepts);
  return concepts.slice(0, 8);
}

export function conceptsAsBullets(concepts: ChessConcept[], limit = 6): string[] {
  return concepts.slice(0, limit).map((concept) => `${concept.label}: ${concept.detail}`);
}
