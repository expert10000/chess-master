import { Chess } from 'chess.js';

export interface OpeningBookLine {
  eco: string;
  name: string;
  variation?: string;
  moves: string[];
  recognizeAt: number;
  weight: number;
}

interface CompiledOpeningLine extends OpeningBookLine {
  sanMoves: string[];
}

export interface OpeningAlternative {
  uci: string;
  san: string;
  localShare: number;
  weight: number;
  continuationUci: string[];
  continuationSan: string[];
  targetEco: string;
  targetName: string;
  targetVariation?: string;
}

export interface OpeningDeviation {
  ply: number;
  moveNumber: number;
  side: 'White' | 'Black';
  uci: string;
  san: string;
  beforeFen: string;
  alternatives: OpeningAlternative[];
}

export type OpeningType =
  | 'Open game'
  | 'Semi-open game'
  | 'Closed game'
  | 'Indian defense'
  | 'Flank opening'
  | 'Opening book';

export interface OpeningTaxonomy {
  type: OpeningType;
  family: string;
  branch: string;
}

export interface OpeningRecognition {
  eco: string | null;
  name: string;
  variation?: string;
  taxonomy: OpeningTaxonomy;
  playedPly: number;
  matchedPly: number;
  withinBook: boolean;
  theoryEnded: boolean;
  explorerFen: string;
  pathSan: string[];
  alternatives: OpeningAlternative[];
  deviation: OpeningDeviation | null;
  coverageLabel: string;
}

interface OpeningNode {
  recognition: CompiledOpeningLine | null;
  alternatives: Map<string, {
    uci: string;
    san: string;
    weight: number;
    continuationUci: string[];
    continuationSan: string[];
    target: CompiledOpeningLine;
    sourceWeight: number;
  }>;
  fen: string;
}

export const OPENING_BOOK_LINES: OpeningBookLine[] = [
  { eco: 'C20', name: "King's Pawn Opening", moves: ['e2e4'], recognizeAt: 1, weight: 90 },
  { eco: 'D00', name: "Queen's Pawn Opening", moves: ['d2d4'], recognizeAt: 1, weight: 74 },
  { eco: 'A10', name: 'English Opening', moves: ['c2c4'], recognizeAt: 1, weight: 36 },
  { eco: 'A04', name: 'Réti Opening', moves: ['g1f3'], recognizeAt: 1, weight: 32 },

  { eco: 'C20', name: "King's Pawn Game", moves: ['e2e4', 'e7e5'], recognizeAt: 2, weight: 58 },
  { eco: 'C50', name: 'Italian Game', moves: ['e2e4','e7e5','g1f3','b8c6','f1c4','f8c5'], recognizeAt: 6, weight: 34 },
  { eco: 'C50', name: 'Italian Game', variation: 'Giuoco Pianissimo', moves: ['e2e4','e7e5','g1f3','b8c6','f1c4','f8c5','c2c3','g8f6','d2d3','d7d6'], recognizeAt: 8, weight: 24 },
  { eco: 'C51', name: 'Italian Game', variation: 'Evans Gambit', moves: ['e2e4','e7e5','g1f3','b8c6','f1c4','f8c5','b2b4','c5b4','c2c3','b4a5','d2d4'], recognizeAt: 7, weight: 11 },
  { eco: 'C55', name: 'Two Knights Defense', moves: ['e2e4','e7e5','g1f3','b8c6','f1c4','g8f6'], recognizeAt: 6, weight: 25 },
  { eco: 'C57', name: 'Two Knights Defense', variation: 'Knight Attack', moves: ['e2e4','e7e5','g1f3','b8c6','f1c4','g8f6','f3g5','d7d5','e4d5'], recognizeAt: 7, weight: 13 },
  { eco: 'C60', name: 'Ruy Lopez', moves: ['e2e4','e7e5','g1f3','b8c6','f1b5'], recognizeAt: 5, weight: 42 },
  { eco: 'C60', name: 'Ruy Lopez', variation: 'Morphy Defense', moves: ['e2e4','e7e5','g1f3','b8c6','f1b5','a7a6'], recognizeAt: 6, weight: 36 },
  { eco: 'C84', name: 'Ruy Lopez', variation: 'Closed', moves: ['e2e4','e7e5','g1f3','b8c6','f1b5','a7a6','b5a4','g8f6','e1g1','f8e7','f1e1','b7b5','a4b3','d7d6','c2c3','e8g8','h2h3'], recognizeAt: 10, weight: 20 },
  { eco: 'C67', name: 'Ruy Lopez', variation: 'Berlin Defense', moves: ['e2e4','e7e5','g1f3','b8c6','f1b5','g8f6','e1g1','f6e4','d2d4','e4d6','b5c6','d7c6','d4e5','d6f5'], recognizeAt: 6, weight: 18 },
  { eco: 'C45', name: 'Scotch Game', moves: ['e2e4','e7e5','g1f3','b8c6','d2d4','e5d4','f3d4','g8f6'], recognizeAt: 5, weight: 22 },
  { eco: 'C47', name: 'Four Knights Game', moves: ['e2e4','e7e5','g1f3','b8c6','b1c3','g8f6','f1b5','f8b4'], recognizeAt: 6, weight: 15 },
  { eco: 'C25', name: 'Vienna Game', moves: ['e2e4','e7e5','b1c3','g8f6','f2f4','d7d5'], recognizeAt: 3, weight: 13 },

  { eco: 'B20', name: 'Sicilian Defense', moves: ['e2e4','c7c5'], recognizeAt: 2, weight: 74 },
  { eco: 'B50', name: 'Sicilian Defense', variation: 'Open Sicilian', moves: ['e2e4','c7c5','g1f3','d7d6','d2d4','c5d4','f3d4'], recognizeAt: 5, weight: 37 },
  { eco: 'B90', name: 'Sicilian Defense', variation: 'Najdorf', moves: ['e2e4','c7c5','g1f3','d7d6','d2d4','c5d4','f3d4','g8f6','b1c3','a7a6'], recognizeAt: 10, weight: 29 },
  { eco: 'B70', name: 'Sicilian Defense', variation: 'Dragon', moves: ['e2e4','c7c5','g1f3','d7d6','d2d4','c5d4','f3d4','g8f6','b1c3','g7g6'], recognizeAt: 10, weight: 18 },
  { eco: 'B56', name: 'Sicilian Defense', variation: 'Classical', moves: ['e2e4','c7c5','g1f3','d7d6','d2d4','c5d4','f3d4','g8f6','b1c3','b8c6'], recognizeAt: 10, weight: 15 },
  { eco: 'B80', name: 'Sicilian Defense', variation: 'Scheveningen', moves: ['e2e4','c7c5','g1f3','d7d6','d2d4','c5d4','f3d4','g8f6','b1c3','e7e6'], recognizeAt: 10, weight: 14 },
  { eco: 'B33', name: 'Sicilian Defense', variation: 'Sveshnikov', moves: ['e2e4','c7c5','g1f3','b8c6','d2d4','c5d4','f3d4','g8f6','b1c3','e7e5'], recognizeAt: 10, weight: 17 },
  { eco: 'B34', name: 'Sicilian Defense', variation: 'Accelerated Dragon', moves: ['e2e4','c7c5','g1f3','b8c6','d2d4','c5d4','f3d4','g7g6'], recognizeAt: 8, weight: 13 },
  { eco: 'B22', name: 'Sicilian Defense', variation: 'Alapin', moves: ['e2e4','c7c5','c2c3','d7d5','e4d5','d8d5','d2d4'], recognizeAt: 3, weight: 16 },
  { eco: 'B23', name: 'Sicilian Defense', variation: 'Closed', moves: ['e2e4','c7c5','b1c3','b8c6','g2g3','g7g6','f1g2','f8g7','d2d3','d7d6'], recognizeAt: 3, weight: 14 },

  { eco: 'C00', name: 'French Defense', moves: ['e2e4','e7e6'], recognizeAt: 2, weight: 38 },
  { eco: 'C02', name: 'French Defense', variation: 'Advance', moves: ['e2e4','e7e6','d2d4','d7d5','e4e5','c7c5','c2c3','b8c6','g1f3','d8b6'], recognizeAt: 5, weight: 20 },
  { eco: 'C05', name: 'French Defense', variation: 'Tarrasch', moves: ['e2e4','e7e6','d2d4','d7d5','b1d2','g8f6','e4e5','f6d7'], recognizeAt: 5, weight: 15 },
  { eco: 'C15', name: 'French Defense', variation: 'Winawer', moves: ['e2e4','e7e6','d2d4','d7d5','b1c3','f8b4','e4e5','c7c5','a2a3','b4c3','b2c3'], recognizeAt: 6, weight: 15 },
  { eco: 'C01', name: 'French Defense', variation: 'Exchange', moves: ['e2e4','e7e6','d2d4','d7d5','e4d5','e6d5'], recognizeAt: 5, weight: 10 },

  { eco: 'B10', name: 'Caro-Kann Defense', moves: ['e2e4','c7c6'], recognizeAt: 2, weight: 35 },
  { eco: 'B18', name: 'Caro-Kann Defense', variation: 'Classical', moves: ['e2e4','c7c6','d2d4','d7d5','b1c3','d5e4','c3e4','c8f5','e4g3','f5g6'], recognizeAt: 5, weight: 19 },
  { eco: 'B12', name: 'Caro-Kann Defense', variation: 'Advance', moves: ['e2e4','c7c6','d2d4','d7d5','e4e5','c8f5','g1f3','e7e6'], recognizeAt: 5, weight: 17 },
  { eco: 'B01', name: 'Scandinavian Defense', moves: ['e2e4','d7d5','e4d5','d8d5','b1c3','d5d8','d2d4'], recognizeAt: 2, weight: 14 },
  { eco: 'B07', name: 'Pirc Defense', moves: ['e2e4','d7d6','d2d4','g8f6','b1c3','g7g6','f2f4','f8g7','g1f3','e8g8'], recognizeAt: 4, weight: 16 },
  { eco: 'B02', name: "Alekhine's Defense", moves: ['e2e4','g8f6','e4e5','f6d5','d2d4','d7d6','g1f3'], recognizeAt: 2, weight: 9 },
  { eco: 'B06', name: 'Modern Defense', moves: ['e2e4','g7g6','d2d4','f8g7','b1c3','d7d6','f2f4','a7a6'], recognizeAt: 2, weight: 10 },

  { eco: 'D06', name: "Queen's Gambit", moves: ['d2d4','d7d5','c2c4'], recognizeAt: 3, weight: 48 },
  { eco: 'D30', name: "Queen's Gambit Declined", moves: ['d2d4','d7d5','c2c4','e7e6','b1c3','g8f6','c1g5','f8e7','e2e3','e8g8'], recognizeAt: 4, weight: 27 },
  { eco: 'D10', name: 'Slav Defense', moves: ['d2d4','d7d5','c2c4','c7c6','g1f3','g8f6','b1c3','d5c4'], recognizeAt: 4, weight: 23 },
  { eco: 'D43', name: 'Semi-Slav Defense', moves: ['d2d4','d7d5','c2c4','e7e6','b1c3','g8f6','g1f3','c7c6'], recognizeAt: 8, weight: 17 },
  { eco: 'D20', name: "Queen's Gambit Accepted", moves: ['d2d4','d7d5','c2c4','d5c4','g1f3','g8f6','e2e3','e7e6','f1c4','c7c5'], recognizeAt: 4, weight: 16 },
  { eco: 'D02', name: 'London System', moves: ['d2d4','d7d5','g1f3','g8f6','c1f4','e7e6','e2e3','c7c5','c2c3','b8c6'], recognizeAt: 5, weight: 18 },

  { eco: 'E90', name: "King's Indian Defense", variation: 'Classical', moves: ['d2d4','g8f6','c2c4','g7g6','b1c3','f8g7','e2e4','d7d6','g1f3','e8g8','f1e2','e7e5'], recognizeAt: 8, weight: 25 },
  { eco: 'E80', name: "King's Indian Defense", variation: 'Sämisch', moves: ['d2d4','g8f6','c2c4','g7g6','b1c3','f8g7','e2e4','d7d6','f2f3','e8g8','c1e3'], recognizeAt: 9, weight: 14 },
  { eco: 'E20', name: 'Nimzo-Indian Defense', moves: ['d2d4','g8f6','c2c4','e7e6','b1c3','f8b4','e2e3','e8g8','f1d3','d7d5','g1f3','c7c5'], recognizeAt: 6, weight: 24 },
  { eco: 'E15', name: "Queen's Indian Defense", moves: ['d2d4','g8f6','c2c4','e7e6','g1f3','b7b6','g2g3','c8b7','f1g2','f8e7'], recognizeAt: 6, weight: 18 },
  { eco: 'D85', name: 'Grünfeld Defense', variation: 'Exchange', moves: ['d2d4','g8f6','c2c4','g7g6','b1c3','d7d5','c4d5','f6d5','e2e4','d5c3','b2c3'], recognizeAt: 6, weight: 19 },
  { eco: 'A60', name: 'Benoni Defense', variation: 'Modern', moves: ['d2d4','g8f6','c2c4','c7c5','d4d5','e7e6','b1c3','e6d5','c4d5','d7d6'], recognizeAt: 6, weight: 13 },
  { eco: 'A57', name: 'Benko Gambit', moves: ['d2d4','g8f6','c2c4','c7c5','d4d5','b7b5','c4b5','a7a6','b5a6','c8a6'], recognizeAt: 6, weight: 11 },
  { eco: 'A45', name: 'Trompowsky Attack', moves: ['d2d4','g8f6','c1g5','e7e6','e2e4','h7h6','g5f6','d8f6','b1c3'], recognizeAt: 3, weight: 12 },
  { eco: 'A80', name: 'Dutch Defense', moves: ['d2d4','f7f5','g2g3','g8f6','f1g2','g7g6','g1f3','f8g7','e1g1','e8g8'], recognizeAt: 2, weight: 12 },

  { eco: 'A28', name: 'English Opening', variation: 'Four Knights', moves: ['c2c4','e7e5','b1c3','g8f6','g2g3','d7d5','c4d5','f6d5','f1g2','d5b6'], recognizeAt: 4, weight: 18 },
  { eco: 'A34', name: 'English Opening', variation: 'Symmetrical', moves: ['c2c4','c7c5','b1c3','b8c6','g1f3','g8f6','g2g3','g7g6','f1g2','f8g7'], recognizeAt: 2, weight: 15 },
  { eco: 'A09', name: 'Réti Opening', variation: 'King-side Fianchetto', moves: ['g1f3','d7d5','c2c4','e7e6','g2g3','g8f6','f1g2','f8e7','e1g1','e8g8'], recognizeAt: 3, weight: 16 },
  { eco: 'E06', name: 'Catalan Opening', moves: ['d2d4','g8f6','c2c4','e7e6','g2g3','d7d5','f1g2','f8e7','g1f3','e8g8','e1g1'], recognizeAt: 5, weight: 17 },
];

export const OPENING_BOOK_LINE_COUNT = OPENING_BOOK_LINES.length;

function compileLine(line: OpeningBookLine): CompiledOpeningLine | null {
  const game = new Chess();
  const sanMoves: string[] = [];

  try {
    for (const uci of line.moves) {
      const move = game.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4] ?? 'q',
      });
      sanMoves.push(move.san);
    }
  } catch {
    return null;
  }

  return { ...line, sanMoves };
}

const COMPILED_LINES = OPENING_BOOK_LINES
  .map(compileLine)
  .filter((line): line is CompiledOpeningLine => Boolean(line));

function prefixKey(moves: string[]): string {
  return moves.join(' ');
}

function chooseRecognition(current: CompiledOpeningLine | null, candidate: CompiledOpeningLine, ply: number): CompiledOpeningLine {
  if (ply < candidate.recognizeAt) return current ?? candidate;
  if (!current || current.recognizeAt > ply) return candidate;
  if (candidate.recognizeAt > current.recognizeAt) return candidate;
  if (candidate.recognizeAt === current.recognizeAt && candidate.moves.length > current.moves.length) return candidate;
  return current;
}

function createBookIndex(): Map<string, OpeningNode> {
  const index = new Map<string, OpeningNode>();

  for (const line of COMPILED_LINES) {
    const game = new Chess();

    for (let ply = 0; ply <= line.moves.length; ply += 1) {
      const key = prefixKey(line.moves.slice(0, ply));
      let node = index.get(key);
      if (!node) {
        node = {
          recognition: null,
          alternatives: new Map(),
          fen: game.fen(),
        };
        index.set(key, node);
      }

      if (ply >= line.recognizeAt) {
        node.recognition = chooseRecognition(node.recognition, line, ply);
      }

      if (ply < line.moves.length) {
        const uci = line.moves[ply];
        const san = line.sanMoves[ply];
        const existing = node.alternatives.get(uci);
        const continuationUci = line.moves.slice(ply, Math.min(line.moves.length, ply + 8));
        const continuationSan = line.sanMoves.slice(ply, Math.min(line.sanMoves.length, ply + 8));

        if (existing) {
          existing.weight += line.weight;
          if (line.weight > existing.sourceWeight) {
            existing.san = san;
            existing.continuationUci = continuationUci;
            existing.continuationSan = continuationSan;
            existing.target = line;
            existing.sourceWeight = line.weight;
          }
        } else {
          node.alternatives.set(uci, {
            uci,
            san,
            weight: line.weight,
            continuationUci,
            continuationSan,
            target: line,
            sourceWeight: line.weight,
          });
        }

        try {
          game.move({
            from: uci.slice(0, 2),
            to: uci.slice(2, 4),
            promotion: uci[4] ?? 'q',
          });
        } catch {
          break;
        }
      }
    }
  }

  return index;
}

const BOOK_INDEX = createBookIndex();

function alternativesFor(node: OpeningNode | undefined): OpeningAlternative[] {
  if (!node) return [];
  const values = [...node.alternatives.values()];
  const total = values.reduce((sum, entry) => sum + entry.weight, 0) || 1;

  return values
    .sort((a, b) => b.weight - a.weight || a.san.localeCompare(b.san))
    .map((entry) => ({
      uci: entry.uci,
      san: entry.san,
      localShare: Math.round((entry.weight / total) * 100),
      weight: entry.weight,
      continuationUci: entry.continuationUci,
      continuationSan: entry.continuationSan,
      targetEco: entry.target.eco,
      targetName: entry.target.name,
      targetVariation: entry.target.variation,
    }));
}

function replayActual(moves: string[], plyLimit: number): { fen: string; san: string[] } {
  const game = new Chess();
  const san: string[] = [];

  for (let i = 0; i < Math.min(plyLimit, moves.length); i += 1) {
    try {
      const move = game.move({
        from: moves[i].slice(0, 2),
        to: moves[i].slice(2, 4),
        promotion: moves[i][4] ?? 'q',
      });
      san.push(move.san);
    } catch {
      break;
    }
  }

  return { fen: game.fen(), san };
}


export function classifyOpening(eco: string | null, name: string): OpeningTaxonomy {
  const lower = name.toLowerCase();

  if (lower.includes('english') || lower.includes('réti')) {
    return {
      type: 'Flank opening',
      family: lower.includes('english') ? 'English Opening' : 'Réti / flank openings',
      branch: name,
    };
  }

  if (
    lower.includes("king's indian")
    || lower.includes('nimzo-indian')
    || lower.includes("queen's indian")
    || lower.includes('grünfeld')
  ) {
    return {
      type: 'Indian defense',
      family: "Queen's Pawn / Indian systems",
      branch: name,
    };
  }

  if (
    lower.includes('sicilian')
    || lower.includes('french')
    || lower.includes('caro-kann')
    || lower.includes('scandinavian')
    || lower.includes('pirc')
    || lower.includes("alekhine")
    || lower.includes('modern defense')
  ) {
    return {
      type: 'Semi-open game',
      family: "King's Pawn Opening",
      branch: name,
    };
  }

  if (
    lower.includes("king's pawn")
    || lower.includes('italian')
    || lower.includes('ruy lopez')
    || lower.includes('two knights')
    || lower.includes('scotch')
    || lower.includes('four knights')
    || lower.includes('vienna')
  ) {
    return {
      type: 'Open game',
      family: "King's Pawn Opening",
      branch: name,
    };
  }

  if (
    lower.includes("queen's gambit")
    || lower.includes('slav')
    || lower.includes('semi-slav')
    || lower.includes('london')
    || lower.includes('catalan')
    || lower.includes('benoni')
    || lower.includes('benko')
    || lower.includes('trompowsky')
    || lower.includes('dutch')
    || lower.includes("queen's pawn")
  ) {
    return {
      type: 'Closed game',
      family: "Queen's Pawn Game",
      branch: name,
    };
  }

  if (eco?.startsWith('B') || /^C0|^C1/.test(eco ?? '')) {
    return { type: 'Semi-open game', family: "King's Pawn Opening", branch: name };
  }
  if (eco?.startsWith('C')) {
    return { type: 'Open game', family: "King's Pawn Opening", branch: name };
  }
  if (eco?.startsWith('E')) {
    return { type: 'Indian defense', family: "Queen's Pawn / Indian systems", branch: name };
  }
  if (eco?.startsWith('D') || /^A[4-9]/.test(eco ?? '')) {
    return { type: 'Closed game', family: "Queen's Pawn Game", branch: name };
  }
  if (eco?.startsWith('A')) {
    return { type: 'Flank opening', family: 'Flank openings', branch: name };
  }

  return { type: 'Opening book', family: 'General opening theory', branch: name };
}

export function recognizeOpening(uciMoves: string[]): OpeningRecognition {
  let matchedPly = 0;

  for (let ply = 0; ply <= uciMoves.length; ply += 1) {
    if (BOOK_INDEX.has(prefixKey(uciMoves.slice(0, ply)))) matchedPly = ply;
    else break;
  }

  const matchedKey = prefixKey(uciMoves.slice(0, matchedPly));
  const node = BOOK_INDEX.get(matchedKey) ?? BOOK_INDEX.get('');
  const replayed = replayActual(uciMoves, matchedPly);
  const recognition = node?.recognition;
  const alternatives = alternativesFor(node);
  const withinBook = matchedPly === uciMoves.length;
  const deviationPly = withinBook ? null : matchedPly + 1;

  let deviation: OpeningDeviation | null = null;
  if (deviationPly !== null) {
    const before = replayActual(uciMoves, matchedPly);
    const game = new Chess(before.fen);
    const uci = uciMoves[matchedPly];
    let san = uci;

    try {
      san = game.move({
        from: uci.slice(0, 2),
        to: uci.slice(2, 4),
        promotion: uci[4] ?? 'q',
      }).san;
    } catch {
      // Keep UCI fallback.
    }

    deviation = {
      ply: deviationPly,
      moveNumber: Math.ceil(deviationPly / 2),
      side: deviationPly % 2 === 1 ? 'White' : 'Black',
      uci,
      san,
      beforeFen: before.fen,
      alternatives,
    };
  }

  const name = recognition?.name
    ?? (matchedPly === 0 ? 'Starting position' : 'Opening book');
  const coverageLabel = deviation
    ? `Local theory ended here at ${deviation.moveNumber}${deviation.side === 'Black' ? '…' : '.'}${deviation.san}.`
    : matchedPly === 0
      ? 'Choose a first move from the local opening book.'
      : `In the local book through ${Math.ceil(matchedPly / 2)}${matchedPly % 2 === 0 ? '…' : '.'}${replayed.san[matchedPly - 1] ?? ''}.`;

  const eco = recognition?.eco ?? null;
  return {
    eco,
    name,
    variation: recognition?.variation,
    taxonomy: classifyOpening(eco, name),
    playedPly: uciMoves.length,
    matchedPly,
    withinBook,
    theoryEnded: Boolean(deviation),
    explorerFen: replayed.fen,
    pathSan: replayed.san,
    alternatives,
    deviation,
    coverageLabel,
  };
}
