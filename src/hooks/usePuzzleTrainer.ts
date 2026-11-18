import { useMemo, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { PUZZLES, PUZZLE_LEVELS, puzzlePositions, puzzleStart, tryPuzzleMove, type PuzzleLevel, type PuzzleMotif } from '../lib/puzzles';

const STORAGE_KEY = 'stockfish-coach.puzzles.v1';
function loadSolved(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as string[]; }
  catch { return []; }
}

export function usePuzzleTrainer() {
  const [level, setLevel] = useState<PuzzleLevel>('easy');
  const [motif, setMotif] = useState<PuzzleMotif>('all');
  const [page, setPage] = useState(0);
  const filtered = useMemo(() => {
    const band = PUZZLE_LEVELS.find((item) => item.id === level)!;
    return PUZZLES.filter((puzzle) => puzzle.rating >= band.min && puzzle.rating <= band.max && (motif === 'all' || puzzle.themes.includes(motif)));
  }, [level, motif]);
  const [selectedId, setSelectedId] = useState<string>(PUZZLES[0].id);
  const puzzle = filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null;
  const [fen, setFen] = useState(() => puzzleStart(PUZZLES[0]).fen());
  const [nextIndex, setNextIndex] = useState(1);
  const [mistakes, setMistakes] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);
  const [message, setMessage] = useState('Find the best move.');
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [solvedIds, setSolvedIds] = useState(loadSolved);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);

  const positions = useMemo(() => puzzle ? puzzlePositions(puzzle) : [], [puzzle]);
  const currentGame = useMemo(() => replayIndex !== null ? positions[replayIndex] : new Chess(fen), [fen, positions, replayIndex]);
  const orientation: 'white' | 'black' = positions[0]?.turn() === 'b' ? 'black' : 'white';
  const targets = useMemo(() => new Set<Square>(selectedSquare && replayIndex === null ? currentGame.moves({ square: selectedSquare, verbose: true }).map((move) => move.to) : []), [currentGame, selectedSquare, replayIndex]);
  const expected = puzzle?.moves[nextIndex];
  const hintFrom = hintLevel >= 1 && expected ? expected.slice(0, 2) as Square : null;
  const hintTo = hintLevel >= 2 && expected ? expected.slice(2, 4) as Square : null;

  function selectPuzzle(id: string) {
    const selected = PUZZLES.find((item) => item.id === id);
    if (!selected) return;
    setSelectedId(id);
    setFen(puzzleStart(selected).fen());
    setNextIndex(1); setMistakes(0); setHintLevel(0); setMessage('Find the best move.');
    setReplayIndex(null); setSolved(false); setRevealed(false); setSelectedSquare(null);
  }
  function changeLevel(value: PuzzleLevel) { setLevel(value); setPage(0); const band = PUZZLE_LEVELS.find((item) => item.id === value)!; const first = PUZZLES.find((item) => item.rating >= band.min && item.rating <= band.max && (motif === 'all' || item.themes.includes(motif))); if (first) selectPuzzle(first.id); }
  function changeMotif(value: PuzzleMotif) { setMotif(value); setPage(0); const band = PUZZLE_LEVELS.find((item) => item.id === level)!; const first = PUZZLES.find((item) => item.rating >= band.min && item.rating <= band.max && (value === 'all' || item.themes.includes(value))); if (first) selectPuzzle(first.id); }
  function attempt(from: Square, to: Square): boolean {
    if (!puzzle || replayIndex !== null || solved || revealed) return false;
    const result = tryPuzzleMove(puzzle, new Chess(fen), nextIndex, from, to);
    setSelectedSquare(null);
    if (!result.correct) { setMistakes((count) => count + 1); setMessage('Try again. Look for a forcing move or a tactical threat.'); return false; }
    setFen(result.game.fen()); setNextIndex(result.nextIndex); setHintLevel(0);
    if (result.solved) {
      setSolved(true); setMessage(`Solved${mistakes ? ` after ${mistakes} ${mistakes === 1 ? 'retry' : 'retries'}` : ' on the first try'}!`);
      if (!solvedIds.includes(puzzle.id)) { const ids = [...solvedIds, puzzle.id]; setSolvedIds(ids); try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch { /* storage is optional */ } }
    } else setMessage(`${result.san} is right. Opponent plays ${result.replySan}. Find the next move.`);
    return true;
  }
  function tap(square: Square) {
    if (replayIndex !== null || solved || revealed) return;
    const piece = currentGame.get(square);
    if (selectedSquare && attempt(selectedSquare, square)) return;
    setSelectedSquare(piece?.color === currentGame.turn() ? square : null);
  }
  function retry() { if (puzzle) selectPuzzle(puzzle.id); }
  function next() { if (!puzzle || !filtered.length) return; selectPuzzle(filtered[(filtered.indexOf(puzzle) + 1) % filtered.length].id); }
  function reveal() { setRevealed(true); setReplayIndex(0); setSelectedSquare(null); setMessage('Solution shown. Step through the moves on the board.'); }
  function review() { setReplayIndex(positions.length - 1); setSelectedSquare(null); }
  function setReviewIndex(index: number) { setReplayIndex(Math.max(0, Math.min(index, positions.length - 1))); }
  return { level, motif, page, setPage, filtered, puzzle, fen, nextIndex, mistakes, hintLevel, setHintLevel, message, replayIndex, solved, revealed, solvedIds, selectedSquare, setSelectedSquare, positions, currentGame, orientation, targets, hintFrom, hintTo, selectPuzzle, changeLevel, changeMotif, attempt, tap, retry, next, reveal, review, setReviewIndex };
}
