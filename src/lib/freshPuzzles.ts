import { Chess } from 'chess.js';
import { puzzlePositions, type Puzzle, type PuzzleLevel, PUZZLE_LEVELS } from './puzzles';

const ENDPOINT = 'https://lichess.org/api/puzzle/next';

export function levelForRating(rating: number): PuzzleLevel {
  return PUZZLE_LEVELS.find((level) => rating >= level.min && rating <= level.max)?.id ?? 'very-hard';
}

export function parseLichessPuzzle(value: unknown): Puzzle {
  if (!value || typeof value !== 'object') throw new Error('Lichess returned an invalid puzzle.');
  const response = value as { game?: { pgn?: unknown }; puzzle?: Record<string, unknown> };
  const source = response.puzzle;
  if (!source || typeof response.game?.pgn !== 'string' || typeof source.id !== 'string' || !Number.isInteger(source.rating) || !Number.isInteger(source.initialPly) || !Array.isArray(source.solution) || !Array.isArray(source.themes)) {
    throw new Error('Lichess returned an incomplete puzzle.');
  }
  const solution = source.solution as unknown[];
  if (!solution.length || solution.length % 2 !== 1 || !solution.every((move) => typeof move === 'string' && /^[a-h][1-8][a-h][1-8]$/.test(move))) {
    throw new Error('This puzzle needs a promotion choice; try another.');
  }
  const game = new Chess();
  try { game.loadPgn(response.game.pgn); } catch { throw new Error('Could not read the puzzle position from Lichess.'); }
  const history = game.history({ verbose: true });
  const setup = history.at(-1);
  if (!setup || history.length !== (source.initialPly as number) + 1 || setup.promotion) throw new Error('Could not verify the puzzle position.');
  const puzzle: Puzzle = {
    id: source.id,
    fen: setup.before,
    moves: [`${setup.from}${setup.to}`, ...(solution as string[])],
    rating: source.rating as number,
    themes: (source.themes as unknown[]).filter((theme): theme is string => typeof theme === 'string'),
  };
  try { puzzlePositions(puzzle); } catch { throw new Error('Lichess returned an invalid move sequence.'); }
  return puzzle;
}

export async function fetchFreshPuzzle(level: PuzzleLevel, motif: string): Promise<Puzzle> {
  const difficulty: Record<PuzzleLevel, string> = { easy: 'easiest', medium: 'easier', hard: 'normal', 'very-hard': 'hardest' };
  const url = new URL(ENDPOINT);
  url.searchParams.set('difficulty', difficulty[level]);
  if (motif !== 'all') url.searchParams.set('angle', motif);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
    if (response.status === 429) throw new Error('Lichess is busy. Try again in a minute.');
    if (!response.ok) throw new Error('Could not get a puzzle from Lichess. Try again later.');
    return parseLichessPuzzle(await response.json());
  } catch (error) {
    if (controller.signal.aborted) throw new Error('Lichess took too long to respond. Check your connection.');
    if (error instanceof TypeError) throw new Error('Internet connection unavailable. The saved puzzles still work offline.');
    throw error;
  } finally { clearTimeout(timeout); }
}
