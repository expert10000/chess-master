import { useEffect, useMemo, useRef, useState } from 'react';
import { Chess, type Square } from 'chess.js';
import { PUZZLES, PUZZLE_LEVELS, PUZZLE_MOTIFS, puzzlePositions, puzzleStart, tryPuzzleMove, type Puzzle, type PuzzleLevel, type PuzzleMotif } from '../lib/puzzles';
import { fetchFreshPuzzle, levelForRating } from '../lib/freshPuzzles';

const STORAGE_KEY = 'stockfish-coach.puzzles.v1';
const PROGRESS_KEY = 'stockfish-coach.puzzle-progress.v1';
const DOWNLOADED_KEY = 'stockfish-coach.downloaded-puzzles.v1';
type PuzzleProgress = { level: PuzzleLevel; motif: PuzzleMotif; lastByCategory: Record<string, string> };
const categoryKey = (level: PuzzleLevel, motif: PuzzleMotif) => `${level}:${motif}`;

function loadProgress(): PuzzleProgress {
  try {
    const saved = JSON.parse(localStorage.getItem(PROGRESS_KEY) || '{}');
    return {
      level: PUZZLE_LEVELS.some((item) => item.id === saved.level) ? saved.level : 'easy',
      motif: PUZZLE_MOTIFS.some((item) => item === saved.motif) ? saved.motif : 'all',
      lastByCategory: saved.lastByCategory && typeof saved.lastByCategory === 'object' ? saved.lastByCategory : {},
    };
  } catch { return { level: 'easy', motif: 'all', lastByCategory: {} }; }
}

function puzzlesInCategory(puzzles: Puzzle[], level: PuzzleLevel, motif: PuzzleMotif) {
  const band = PUZZLE_LEVELS.find((item) => item.id === level)!;
  return puzzles.filter((puzzle) => puzzle.rating >= band.min && puzzle.rating <= band.max && (motif === 'all' || puzzle.themes.includes(motif)));
}

function nextUnsolved(items: typeof PUZZLES, solvedIds: string[], currentIndex: number) {
  const solved = new Set(solvedIds);
  for (let offset = 1; offset <= items.length; offset++) {
    const candidate = items[(currentIndex + offset) % items.length];
    if (!solved.has(candidate.id)) return candidate;
  }
  return items[(currentIndex + 1) % items.length];
}

function resumePuzzle(items: typeof PUZZLES, solvedIds: string[], lastId?: string) {
  const lastIndex = items.findIndex((item) => item.id === lastId);
  if (lastIndex >= 0 && !solvedIds.includes(items[lastIndex].id)) return items[lastIndex];
  return nextUnsolved(items, solvedIds, lastIndex);
}

function loadSolved(): string[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') as string[]; }
  catch { return []; }
}

function loadDownloaded(): Puzzle[] {
  try {
    const value: unknown = JSON.parse(localStorage.getItem(DOWNLOADED_KEY) || '[]');
    if (!Array.isArray(value)) return [];
    const bundled = new Set(PUZZLES.map((puzzle) => puzzle.id));
    return value.filter((item): item is Puzzle => item && typeof item.id === 'string' && !bundled.has(item.id) && typeof item.fen === 'string' && Array.isArray(item.moves) && item.moves.length >= 2 && typeof item.rating === 'number' && Array.isArray(item.themes));
  } catch { return []; }
}

export function usePuzzleTrainer(pageSize = 12) {
  const replyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (replyTimer.current) clearTimeout(replyTimer.current); }, []);
  const [downloaded, setDownloaded] = useState(loadDownloaded);
  const allPuzzles = useMemo(() => [...PUZZLES, ...downloaded], [downloaded]);
  const [initial] = useState(() => {
    const progress = loadProgress();
    const items = puzzlesInCategory(allPuzzles, progress.level, progress.motif);
    const selected = resumePuzzle(items, loadSolved(), progress.lastByCategory[categoryKey(progress.level, progress.motif)]);
    return { ...progress, selectedId: selected?.id ?? PUZZLES[0].id, index: items.indexOf(selected) };
  });
  const lastByCategory = useRef(initial.lastByCategory);
  const [level, setLevel] = useState<PuzzleLevel>(initial.level);
  const [motif, setMotif] = useState<PuzzleMotif>(initial.motif);
  const [page, setPage] = useState(Math.floor(Math.max(0, initial.index) / pageSize));
  const filtered = useMemo(() => puzzlesInCategory(allPuzzles, level, motif), [allPuzzles, level, motif]);
  const [selectedId, setSelectedId] = useState(initial.selectedId);
  const puzzle = filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null;
  const puzzleNumber = puzzle ? filtered.indexOf(puzzle) + 1 : 0;
  const [fen, setFen] = useState(() => puzzleStart(allPuzzles.find((item) => item.id === initial.selectedId) ?? PUZZLES[0]).fen());
  const [nextIndex, setNextIndex] = useState(1);
  const [mistakes, setMistakes] = useState(0);
  const [hintLevel, setHintLevel] = useState(0);
  const [message, setMessage] = useState('Find the best move. The opponent replies automatically.');
  const [pendingReply, setPendingReply] = useState(false);
  const [lastMove, setLastMove] = useState<{ from: Square; to: Square }>(() => { const move = (allPuzzles.find((item) => item.id === initial.selectedId) ?? PUZZLES[0]).moves[0]; return { from: move.slice(0, 2) as Square, to: move.slice(2, 4) as Square }; });
  const [replayIndex, setReplayIndex] = useState<number | null>(null);
  const [solved, setSolved] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [solvedIds, setSolvedIds] = useState(loadSolved);
  const [selectedSquare, setSelectedSquare] = useState<Square | null>(null);
  const [fetching, setFetching] = useState(false);
  const [freshStatus, setFreshStatus] = useState('');

  const positions = useMemo(() => puzzle ? puzzlePositions(puzzle) : [], [puzzle]);
  const currentGame = useMemo(() => replayIndex !== null ? positions[replayIndex] : new Chess(fen), [fen, positions, replayIndex]);
  const orientation: 'white' | 'black' = positions[0]?.turn() === 'b' ? 'black' : 'white';
  const targets = useMemo(() => new Set<Square>(selectedSquare && replayIndex === null && !pendingReply ? currentGame.moves({ square: selectedSquare, verbose: true }).map((move) => move.to) : []), [currentGame, selectedSquare, replayIndex, pendingReply]);
  const expected = puzzle?.moves[nextIndex];
  const hintFrom = !pendingReply && hintLevel >= 1 && expected ? expected.slice(0, 2) as Square : null;
  const hintTo = !pendingReply && hintLevel >= 2 && expected ? expected.slice(2, 4) as Square : null;
  const replayMove = replayIndex !== null ? puzzle?.moves[replayIndex] : null;
  const displayedLastMove = replayMove ? { from: replayMove.slice(0, 2) as Square, to: replayMove.slice(2, 4) as Square } : lastMove;

  function selectPuzzle(id: string, categoryLevel = level, categoryMotif = motif, fresh?: Puzzle) {
    const selected = allPuzzles.find((item) => item.id === id) ?? fresh;
    if (!selected) return;
    if (replyTimer.current) { clearTimeout(replyTimer.current); replyTimer.current = null; }
    setSelectedId(id);
    const items = puzzlesInCategory(fresh ? [...allPuzzles, fresh] : allPuzzles, categoryLevel, categoryMotif);
    setPage(Math.floor(Math.max(0, items.findIndex((item) => item.id === id)) / pageSize));
    lastByCategory.current = { ...lastByCategory.current, [categoryKey(categoryLevel, categoryMotif)]: id };
    try { localStorage.setItem(PROGRESS_KEY, JSON.stringify({ level: categoryLevel, motif: categoryMotif, lastByCategory: lastByCategory.current })); } catch { /* storage is optional */ }
    setFen(puzzleStart(selected).fen());
    setNextIndex(1); setMistakes(0); setHintLevel(0); setMessage('Find the best move. The opponent replies automatically.');
    setPendingReply(false);
    setLastMove({ from: selected.moves[0].slice(0, 2) as Square, to: selected.moves[0].slice(2, 4) as Square });
    setReplayIndex(null); setSolved(false); setRevealed(false); setSelectedSquare(null);
  }
  function changeLevel(value: PuzzleLevel) { setLevel(value); const item = resumePuzzle(puzzlesInCategory(allPuzzles, value, motif), solvedIds, lastByCategory.current[categoryKey(value, motif)]); if (item) selectPuzzle(item.id, value, motif); }
  function changeMotif(value: PuzzleMotif) { setMotif(value); const item = resumePuzzle(puzzlesInCategory(allPuzzles, level, value), solvedIds, lastByCategory.current[categoryKey(level, value)]); if (item) selectPuzzle(item.id, level, value); }
  async function getFreshPuzzle() {
    if (fetching) return;
    setFetching(true); setFreshStatus('Getting a new puzzle from Lichess…');
    try {
      const fresh = await fetchFreshPuzzle(level, motif);
      if (allPuzzles.some((item) => item.id === fresh.id)) { setFreshStatus('This puzzle is already here. Tap again for a different one.'); return; }
      const saved = [...downloaded, fresh];
      try { localStorage.setItem(DOWNLOADED_KEY, JSON.stringify(saved)); }
      catch { throw new Error('Device storage is full. Could not save the new puzzle.'); }
      setDownloaded(saved);
      const newLevel = levelForRating(fresh.rating);
      const newMotif = motif === 'all' || fresh.themes.includes(motif) ? motif : 'all';
      setLevel(newLevel); setMotif(newMotif);
      selectPuzzle(fresh.id, newLevel, newMotif, fresh);
      setFreshStatus(`Saved for offline play${newLevel !== level ? ` in ${PUZZLE_LEVELS.find((item) => item.id === newLevel)?.label}` : ''}.`);
    } catch (error) { setFreshStatus(error instanceof Error ? error.message : 'Could not get a new puzzle.'); }
    finally { setFetching(false); }
  }
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
  function next() { if (!puzzle || !filtered.length) return; selectPuzzle(nextUnsolved(filtered, solvedIds, filtered.indexOf(puzzle)).id); }
  function reveal() { if (pendingReply) return; setRevealed(true); setReplayIndex(0); setSelectedSquare(null); setMessage('Solution shown. Step through the moves on the board.'); }
  function review() { setReplayIndex(positions.length - 1); setSelectedSquare(null); }
  function setReviewIndex(index: number) { setReplayIndex(Math.max(0, Math.min(index, positions.length - 1))); }
  return { level, motif, page, setPage, filtered, puzzle, puzzleNumber, downloadedCount: downloaded.length, fetching, freshStatus, getFreshPuzzle, fen, nextIndex, mistakes, hintLevel, setHintLevel, message, pendingReply, displayedLastMove, replayIndex, solved, revealed, solvedIds, selectedSquare, setSelectedSquare, positions, currentGame, orientation, targets, hintFrom, hintTo, selectPuzzle, changeLevel, changeMotif, attempt, tap, retry, next, reveal, review, setReviewIndex };
}
