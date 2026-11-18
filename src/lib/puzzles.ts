import { Chess, type Square } from 'chess.js';
import data from '../data/puzzles.json';

export interface Puzzle {
  id: string;
  fen: string;
  moves: string[];
  rating: number;
  themes: string[];
}

export const PUZZLES: Puzzle[] = data;
export const PUZZLE_LEVELS = [
  { id: 'easy', label: 'Easy', min: 0, max: 899 },
  { id: 'medium', label: 'Medium', min: 900, max: 1399 },
  { id: 'hard', label: 'Hard', min: 1400, max: 1999 },
  { id: 'very-hard', label: 'Very hard', min: 2000, max: Infinity },
] as const;
export type PuzzleLevel = typeof PUZZLE_LEVELS[number]['id'];

export const PUZZLE_MOTIFS = ['all', 'mate', 'fork', 'pin', 'skewer', 'discoveredAttack', 'hangingPiece', 'sacrifice', 'endgame'] as const;
export type PuzzleMotif = typeof PUZZLE_MOTIFS[number];

export function puzzleTitle(puzzle: Puzzle): string {
  const theme = puzzle.themes.find((item) => PUZZLE_MOTIFS.includes(item as PuzzleMotif) && item !== 'all');
  const names: Record<string, string> = { mate: 'Checkmate', fork: 'Fork', pin: 'Pin', skewer: 'Skewer', discoveredAttack: 'Discovered attack', hangingPiece: 'Win a piece', sacrifice: 'Sacrifice', endgame: 'Endgame' };
  return theme ? names[theme] : 'Find the best move';
}

export function puzzleStart(puzzle: Puzzle): Chess {
  const game = new Chess(puzzle.fen);
  game.move(puzzle.moves[0]);
  return game;
}

export function puzzlePositions(puzzle: Puzzle): Chess[] {
  const game = puzzleStart(puzzle);
  const positions = [new Chess(game.fen())];
  for (const uci of puzzle.moves.slice(1)) {
    game.move(uci);
    positions.push(new Chess(game.fen()));
  }
  return positions;
}

export function puzzleSanLine(puzzle: Puzzle): string[] {
  const game = puzzleStart(puzzle);
  return puzzle.moves.slice(1).map((uci) => game.move(uci).san);
}

export function tryPuzzleMove(puzzle: Puzzle, game: Chess, nextIndex: number, from: Square, to: Square): { correct: boolean; game: Chess; nextIndex: number; solved: boolean; san?: string; replySan?: string } {
  const candidate = new Chess(game.fen());
  let move;
  try { move = candidate.move({ from, to, promotion: 'q' }); }
  catch { return { correct: false, game, nextIndex, solved: false }; }
  const expected = puzzle.moves[nextIndex];
  const isMateInOne = puzzle.themes.includes('mateIn1') && nextIndex === puzzle.moves.length - 1;
  if (`${move.from}${move.to}${move.promotion ?? ''}` !== expected && !(isMateInOne && candidate.isCheckmate())) {
    return { correct: false, game, nextIndex, solved: false };
  }
  let replySan: string | undefined;
  let index = nextIndex + 1;
  if (index < puzzle.moves.length) {
    replySan = candidate.move(puzzle.moves[index]).san;
    index++;
  }
  return { correct: true, game: candidate, nextIndex: index, solved: index >= puzzle.moves.length, san: move.san, replySan };
}
