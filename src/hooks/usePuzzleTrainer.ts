import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { PUZZLES, PUZZLE_LEVELS, puzzlePositions, puzzleStart, tryPuzzleMove, type PuzzleLevel, type PuzzleMotif } from '../lib/puzzles';

const STORAGE_KEY = 'stockfish-coach.puzzles.v1';
function loadSolved(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as string[]; }
  catch { return []; }
}

export function usePuzzleTrainer() {
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (replyTimer.current) clearTimeout(replyTimer.current); }, []);
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
  const [message, setMessage] = useState('Find the best move. The opponent replies automatically.');
  const [pendingReply, setPendingReply] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square }>(() => ({ from: PUZZLES[0].moves[0].slice(0, 2) as Square, to: PUZZLES[0].moves[0].slice(2, 4) as Square }));
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [solvedIds, setSolvedIds] = useState(loadSolved);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);

  const positions = useMemo(() => puzzle ? puzzlePositions(puzzle) : [], [puzzle]);
  const currentGame = useMemo(() => replayIndex !== null ? positions[replayIndex] : new Chess(fen), [fen, positions, replayIndex]);
  const orientation: 'white' | 'black' = positions[0]?.turn() === 'b' ? 'black' : 'white';
  const targets = useMemo(() => new Set<Square>(selectedSquare && replayIndex === null && !pendingReply ? currentGame.moves({ square: selectedSquare, verbose: true }).map((move) => move.to) : []), [currentGame, selectedSquare, replayIndex, pendingReply]);
  const expected = puzzle?.moves[nextIndex];
  const hintFrom = !pendingReply && hintLevel >= 1 && expected ? expected.slice(0, 2) as Square : null;
  const hintTo = !pendingReply && hintLevel >= 2 && expected ? expected.slice(2, 4) as Square : null;
  const replayMove = replayIndex !== null ? puzzle?.moves[replayIndex] : null;
  const displayedLastMove = replayMove ? { from: replayMove.slice(0, 2) as Square, to: replayMove.slice(2, 4) as Square } : lastMove;

  function selectPuzzle(id: string) {
    const selected = PUZZLES.find((item) => item.id === id);
    if (!selected) return;
    if (replyTimer.current) { clearTimeout(replyTimer.current); replyTimer.current = null; }
    setSelectedId(id);
    setFen(puzzleStart(selected).fen());
    setNextIndex(1); setMistakes(0); setHintLevel(0); setMessage('Find the best move. The opponent replies automatically.');
    setPendingReply(false);
    setLastMove({ from: selected.moves[0].slice(0, 2) as Square, to: selected.moves[0].slice(2, 4) as Square });
    setReplayIndex(null); setSolved(false); setRevealed(false); setSelectedSquare(null);
  }
  function changeLevel(value: PuzzleLevel) { setLevel(value); setPage(0); const band = PUZZLE_LEVELS.find((item) => item.id === value)!; const first = PUZZLES.find((item) => item.rating >= band.min && item.rating <= band.max && (motif === 'all' || item.themes.includes(motif))); if (first) selectPuzzle(first.id); }
  function changeMotif(value: PuzzleMotif) { setMotif(value); setPage(0); const band = PUZZLE_LEVELS.find((item) => item.id === level)!; const first = PUZZLES.find((item) => item.rating >= band.min && item.rating <= band.max && (value === 'all' || item.themes.includes(value))); if (first) selectPuzzle(first.id); }
  function attempt(from: Square, to: Square): boolean {
    if (!puzzle || replayIndex !== null || solved || revealed || pendingReply) return false;
    const result = tryPuzzleMove(puzzle, new Chess(fen), nextIndex, from, to);
    setSelectedSquare(null);
    if (!result.correct) { setMistakes((count) => count + 1); setMessage('Try again. Look for a forcing move or a tactical threat.'); return false; }
    setFen(result.playerFen!); setHintLevel(0);
    setLastMove({ from, to });
    if (result.solved) {
      setNextIndex(result.nextIndex);
      setSolved(true); setMessage(`Solved${mistakes ? ` after ${mistakes} ${mistakes === 1 ? 'retry' : 'retries'}` : ' on the first try'}!`);
      if (!solvedIds.includes(puzzle.id)) { const ids = [...solvedIds, puzzle.id]; setSolvedIds(ids); try { localStorage.setItem(STORAGE_KEY, JSON.stringify(ids)); } catch { /* storage is optional */ } }
    } else {
      setPendingReply(true);
      setMessage(`${result.san} is correct. Opponent replying…`);
      const replyUci = puzzle.moves[nextIndex + 1];
      replyTimer.current = setTimeout(() => {
        setFen(result.game.fen());
        setNextIndex(result.nextIndex);
        setLastMove({ from: replyUci.slice(0, 2) as Square, to: replyUci.slice(2, 4) as Square });
        setMessage(`${result.san} was correct. Opponent plays ${result.replySan}${result.replyIsEnPassant ? ' en passant, capturing your pawn' : ''}. Find the next move.`);
        setPendingReply(false);
        replyTimer.current = null;
      }, 850);
    }
    return true;
  }
  function tap(square: Square) {
    if (replayIndex !== null || solved || revealed || pendingReply) return;
    const piece = currentGame.get(square);
    if (selectedSquare && attempt(selectedSquare, square)) return;
    setSelectedSquare(piece?.color === currentGame.turn() ? square : null);
  }
  function retry() { if (puzzle) selectPuzzle(puzzle.id); }
  function next() { if (!puzzle || !filtered.length) return; selectPuzzle(filtered[(filtered.indexOf(puzzle) + 1) % filtered.length].id); }
  function reveal() { if (pendingReply) return; setRevealed(true); setReplayIndex(0); setSelectedSquare(null); setMessage('Solution shown. Step through the moves on the board.'); }
  function review() { setReplayIndex(positions.length - 1); setSelectedSquare(null); }
  function setReviewIndex(index: number) { setReplayIndex(Math.max(0, Math.min(index, positions.length - 1))); }
  return { level, motif, page, setPage, filtered, puzzle, fen, nextIndex, mistakes, hintLevel, setHintLevel, message, pendingReply, displayedLastMove, replayIndex, solved, revealed, solvedIds, selectedSquare, setSelectedSquare, positions, currentGame, orientation, targets, hintFrom, hintTo, selectPuzzle, changeLevel, changeMotif, attempt, tap, retry, next, reveal, review, setReviewIndex };
}
