import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Chess, type Move, type PieceSymbol, type Square } from 'chess.js';
import { MobileEngine, type MobileAnalysis } from './engine';
import { hintTip, moveTip } from './tips';
import { openingHint } from './openingHint';
import { createMobileExplanation, HINT_MODES, type HintMode, type MobileExplanation } from './causalHints';
import { PIECE_GLYPHS } from '../lib/pieceGlyphs';
import { illustratedBounds } from './illustratedPieces';

type Side = 'w' | 'b';
type Tab = 'play' | 'coach' | 'moves';
type Difficulty = '1800' | '2000' | '2100' | 'max';
type PieceStyle = 'desktop' | 'spatial' | 'chessnut' | 'fantasy' | 'illustrated';

const STORAGE_KEY = 'stockfish-coach.mobile.v1';
const HINT_MODE_KEY = 'stockfish-coach.mobile.hint-mode.v1';
const PIECE_STYLE_KEY = 'stockfish-coach.mobile.piece-style.v2';
const PIECE_STYLES: { id: PieceStyle; name: string; description: string }[] = [
  { id: 'desktop', name: 'Desktop original', description: 'The familiar Stockfish Coach pieces' },
  { id: 'illustrated', name: 'Illustrated', description: 'Your detailed light and dark pieces' },
  { id: 'spatial', name: 'Modern', description: 'Clean shapes and strong contrast' },
  { id: 'chessnut', name: 'Classic', description: 'Traditional tournament pieces' },
  { id: 'fantasy', name: 'Fantasy', description: 'Detailed carved pieces' },
];
const LEVELS: Record<Difficulty, { label: string; description: string; elo: number; movetimeMs: number; unrestricted: boolean }> = {
  '1800': { label: '1800', description: 'A steady club challenge', elo: 1800, movetimeMs: 420, unrestricted: false },
  '2000': { label: '2000', description: 'Stronger positional play', elo: 2000, movetimeMs: 600, unrestricted: false },
  '2100': { label: '2100', description: 'Tough and tactical', elo: 2100, movetimeMs: 750, unrestricted: false },
  max: { label: 'Max', description: 'No strength limit', elo: 3190, movetimeMs: 1300, unrestricted: true },
};
function PieceIcon({ color, piece, style }: { color: Side; piece: PieceSymbol; style: PieceStyle }) {
  if (style === 'desktop') return <span className={`chess-piece piece-desktop piece-desktop-${color}`} aria-hidden="true">{PIECE_GLYPHS[color][piece]}</span>;
  if (style === 'illustrated') {
    const [x, y, width, height] = illustratedBounds(color, piece);
    const size = 83.7; // 90% of the previous 93% square height.
    return <svg className="chess-piece piece-illustrated" viewBox={`${x} ${y} ${width} ${height}`} style={{ width: `${size * width / height}%`, height: `${size}%` }} aria-hidden="true"><image href="./pieces/illustrated-sheet.png" width="1448" height="1086" /></svg>;
  }
  return <img className={`chess-piece ${color === 'w' ? 'piece-white' : 'piece-black'} piece-style-${style}`} src={`./pieces/${style}/${color}${piece.toUpperCase()}.svg`} alt="" draggable={false} aria-hidden="true" />;
}

interface SavedGame {
  pgn: string;
  side: Side;
  difficulty: Difficulty;
  flipped: boolean;
}

function loadSaved(): SavedGame {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Record<string, unknown>;
    const previousLevel = value.difficulty;
    const difficulty: Difficulty = typeof previousLevel === 'string' && previousLevel in LEVELS
      ? previousLevel as Difficulty
      : previousLevel === 'challenge' ? '2100' : '1800';
    return {
      pgn: typeof value.pgn === 'string' ? value.pgn : '',
      side: value.side === 'b' ? 'b' : 'w',
      difficulty,
      flipped: value.flipped === true,
    };
  } catch {
    return { pgn: '', side: 'w', difficulty: '1800', flipped: false };
  }
}

function loadHintMode(): HintMode {
  const saved = localStorage.getItem(HINT_MODE_KEY);
  return saved === 'quick' || saved === 'deep' ? saved : 'explain';
}

function loadPieceStyle(): PieceStyle {
  const saved = localStorage.getItem(PIECE_STYLE_KEY);
  return PIECE_STYLES.some(({ id }) => id === saved) ? saved as PieceStyle : 'desktop';
}

function gameLabel(game: Chess, side: Side, busy: boolean): string {
  if (game.isCheckmate()) return game.turn() === side ? 'Checkmate · Stockfish wins' : 'Checkmate · you win!';
  if (game.isDraw()) return 'Drawn game';
  if (busy && game.turn() !== side) return 'Stockfish is thinking…';
  if (busy) return 'Finding a helpful move…';
  if (game.isCheck()) return 'Check · protect your king';
  return game.turn() === side ? 'Your turn' : 'Stockfish to move';
}

export default function MobileApp() {
  const saved = useRef(loadSaved()).current;
  const gameRef = useRef<Chess | null>(null);
  if (!gameRef.current) {
    const initial = new Chess();
    if (saved.pgn) {
      try { initial.loadPgn(saved.pgn); } catch { initial.reset(); }
    }
    gameRef.current = initial;
  }
  const game = gameRef.current;
  const engineRef = useRef<MobileEngine | null>(null);
  const sessionRef = useRef(0);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const tipCardRef = useRef<HTMLElement | null>(null);
  const dragRef = useRef<{ from: Square; pointerId: number; startX: number; startY: number; piece: PieceSymbol; color: Side; active: boolean } | null>(null);
  const suppressDragClickRef = useRef<{ from: Square; until: number } | null>(null);
  const [fen, setFen] = useState(game.fen());
  const [moves, setMoves] = useState<Move[]>(game.history({ verbose: true }));
  const [side, setSide] = useState<Side>(saved.side);
  const [difficulty, setDifficulty] = useState<Difficulty>(saved.difficulty);
  const [flipped, setFlipped] = useState(saved.flipped);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [engineError, setEngineError] = useState('');
  const [selected, setSelected] = useState<Square | null>(null);
  const [hint, setHint] = useState<{ move: Move; analysis: MobileAnalysis | null; explanation: MobileExplanation | null; source: 'book' | 'engine'; bookMoveSan: string | null } | null>(null);
  const [hintMode, setHintMode] = useState<HintMode>(loadHintMode);
  const [pieceStyle, setPieceStyle] = useState<PieceStyle>(loadPieceStyle);
  const [showPiecePicker, setShowPiecePicker] = useState(false);
  const [hintSearchMode, setHintSearchMode] = useState<HintMode | null>(null);
  const [hintProgress, setHintProgress] = useState('');
  const [tip, setTip] = useState('Own the center, develop your pieces, and keep your king safe.');
  const [tab, setTab] = useState<Tab>('play');
  const [showSetup, setShowSetup] = useState(false);
  const [showLevelPicker, setShowLevelPicker] = useState(false);
  const [setupSide, setSetupSide] = useState<Side>(saved.side);
  const [setupDifficulty, setSetupDifficulty] = useState<Difficulty>(saved.difficulty);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [lastMove, setLastMove] = useState<Move | null>(moves.at(-1) ?? null);
  const [viewPly, setViewPly] = useState<number | null>(null);
  const [dragPiece, setDragPiece] = useState<{ from: Square; piece: PieceSymbol; color: Side; x: number; y: number } | null>(null);

  const orientation: Side = flipped ? (side === 'w' ? 'b' : 'w') : side;
  const files = orientation === 'w' ? 'abcdefgh' : 'hgfedcba';
  const ranks = orientation === 'w' ? '87654321' : '12345678';
  const displayedGame = useMemo(() => {
    if (viewPly === null) return game;
    const snapshot = new Chess();
    for (const move of moves.slice(0, viewPly)) {
      snapshot.move({ from: move.from, to: move.to, promotion: move.promotion });
    }
    return snapshot;
  }, [fen, moves, viewPly]);
  const displayedMove = viewPly === null ? lastMove : moves[viewPly - 1] ?? null;
  const displayedTip = viewPly === null
    ? tip
    : displayedMove ? moveTip(displayedMove, displayedGame) : 'This is the starting position. Watch how the opening develops.';
  const legal = selected && viewPly === null ? game.moves({ square: selected, verbose: true }) : [];
  const targets = new Set(legal.map((move) => move.to));
  const status = viewPly === null ? gameLabel(game, side, busy) : `History · ${viewPly}/${moves.length}`;

  function refresh(): void {
    setFen(game.fen());
    setMoves(game.history({ verbose: true }));
    setLastMove(game.history({ verbose: true }).at(-1) ?? null);
  }

  async function playEngine(level: Difficulty = difficulty): Promise<void> {
    const engine = engineRef.current;
    if (!engine || game.isGameOver()) return;
    const session = sessionRef.current;
    setBusy(true);
    try {
      const result = await engine.analyse(game.fen(), LEVELS[level], LEVELS[level].unrestricted);
      if (session !== sessionRef.current || !result.bestMove) return;
      const move = game.move({ from: result.bestMove.slice(0, 2), to: result.bestMove.slice(2, 4), promotion: result.bestMove[4] ?? 'q' });
      refresh();
      setTip(game.isGameOver() ? moveTip(move, game) : 'Stockfish moved. Scan for checks, captures, and threats before you reply.');
      setHint(null);
    } catch (error) {
      if (session === sessionRef.current) setEngineError(error instanceof Error ? error.message : 'Engine move failed.');
    } finally {
      if (session === sessionRef.current) setBusy(false);
    }
  }

  useEffect(() => {
    const engine = new MobileEngine();
    engineRef.current = engine;
    let active = true;
    engine.waitUntilReady().then(() => {
      if (!active) return;
      setReady(true);
      if (!game.isGameOver() && game.turn() !== saved.side) void playEngine(saved.difficulty);
    }).catch((error: unknown) => {
      if (active) setEngineError(error instanceof Error ? error.message : 'Stockfish could not load.');
    });
    return () => {
      active = false;
      sessionRef.current += 1;
      engine.dispose();
      engineRef.current = null;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ pgn: game.pgn(), side, difficulty, flipped } satisfies SavedGame));
  }, [fen, side, difficulty, flipped]);

  useEffect(() => {
    localStorage.setItem(HINT_MODE_KEY, hintMode);
  }, [hintMode]);

  useEffect(() => {
    localStorage.setItem(PIECE_STYLE_KEY, pieceStyle);
  }, [pieceStyle]);

  useEffect(() => {
    if (!hint || tab !== 'play' || viewPly !== null) return;
    const frame = requestAnimationFrame(() => tipCardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' }));
    return () => cancelAnimationFrame(frame);
  }, [hint, tab, viewPly]);

  useEffect(() => {
    if (!hintSearchMode) return;
    const onVisibilityChange = () => { if (document.hidden) cancelHint(); };
    document.addEventListener('visibilitychange', onVisibilityChange);
    return () => document.removeEventListener('visibilitychange', onVisibilityChange);
  }, [hintSearchMode]);

  function makeHumanMove(from: Square, to: Square, promoteTo: PieceSymbol = 'q'): void {
    try {
      const move = game.move({ from, to, promotion: promoteTo });
      setSelected(null);
      setPromotion(null);
      setHint(null);
      setTip(moveTip(move, game));
      refresh();
      if (!game.isGameOver()) void playEngine();
    } catch {
      setSelected(null);
    }
  }

  function tapSquare(square: Square): void {
    if (!ready || busy || viewPly !== null || game.isGameOver() || game.turn() !== side || promotion) return;
    const piece = game.get(square);
    if (selected && targets.has(square)) {
      if (legal.some((move) => move.to === square && move.promotion)) setPromotion({ from: selected, to: square });
      else makeHumanMove(selected, square);
      return;
    }
    setSelected(piece?.color === side ? square : null);
  }

  function startDrag(event: ReactPointerEvent<HTMLButtonElement>, square: Square, piece: { type: PieceSymbol; color: Side } | undefined): void {
    if (dragRef.current || event.button !== 0 || !piece || piece.color !== side || !ready || busy || viewPly !== null || game.isGameOver() || game.turn() !== side || promotion) return;
    dragRef.current = { from: square, pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, piece: piece.type, color: piece.color, active: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDrag(event: ReactPointerEvent<HTMLButtonElement>): void {
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (!current.active && Math.hypot(event.clientX - current.startX, event.clientY - current.startY) < 8) return;
    if (!current.active) {
      current.active = true;
      setSelected(current.from);
    }
    setDragPiece({ from: current.from, piece: current.piece, color: current.color, x: event.clientX, y: event.clientY });
  }

  function endDrag(event: ReactPointerEvent<HTMLButtonElement>): void {
    const current = dragRef.current;
    if (!current || current.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setDragPiece(null);
    if (!current.active) return;
    suppressDragClickRef.current = { from: current.from, until: performance.now() + 400 };
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLButtonElement>('.mobile-board .square');
    const destination = target?.dataset.square as Square | undefined;
    const legalMove = destination && game.moves({ square: current.from, verbose: true }).find((move) => move.to === destination);
    if (!legalMove) {
      setSelected(current.from);
      return;
    }
    if (legalMove.promotion) setPromotion({ from: current.from, to: destination });
    else makeHumanMove(current.from, destination);
  }

  function cancelDrag(event: ReactPointerEvent<HTMLButtonElement>): void {
    if (dragRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
    dragRef.current = null;
    setDragPiece(null);
  }

  function cancelHint(): void {
    sessionRef.current += 1;
    engineRef.current?.stop();
    setBusy(false);
    setHintSearchMode(null);
    setHintProgress('');
    setTip('Analysis cancelled. The board has not changed.');
  }

  async function askForHint(requestedMode: HintMode = hintMode, verifyBook = false): Promise<void> {
    if (!engineRef.current || busy || viewPly !== null || game.isGameOver() || game.turn() !== side) return;
    const session = sessionRef.current;
    const startFen = game.fen();
    const book = openingHint(game);
    if (book && requestedMode === 'quick' && !verifyBook) {
      setHint({ move: book.move, analysis: null, explanation: null, source: 'book', bookMoveSan: book.move.san });
      setSelected(null);
      setTip(`Book suggestion: ${book.move.san}. ${hintTip(book.move, game)} This has not been checked by Stockfish at this position.`);
      return;
    }
    setBusy(true);
    setHint(null);
    setEngineError('');
    setHintSearchMode(requestedMode);
    setHintProgress(requestedMode === 'deep' ? 'Searching the best line…' : 'Checking the position…');
    try {
      const engine = engineRef.current;
      const analysis = requestedMode === 'deep'
        ? await engine.analyse(startFen, { elo: 2200, movetimeMs: 6500 }, true, 1)
        : await engine.analyse(startFen, { elo: 2200, movetimeMs: requestedMode === 'quick' ? 1200 : 3800 }, true, requestedMode === 'quick' ? 1 : 2);
      if (session !== sessionRef.current || game.fen() !== startFen) return;
      let comparison: MobileAnalysis | undefined;
      if (requestedMode === 'deep' && analysis.bestMove) {
        setHintProgress('Comparing another move…');
        comparison = await engine.analyse(startFen, { elo: 2200, movetimeMs: 2600 }, true, 2);
        if (session !== sessionRef.current || game.fen() !== startFen) return;
      }
      const explanation = createMobileExplanation(game, analysis, requestedMode, comparison);
      if (!explanation) throw new Error('Stockfish did not return a legal move for this position.');
      setHint({ move: explanation.move, analysis, explanation, source: 'engine', bookMoveSan: book?.move.san ?? null });
      setSelected(null);
      setTip(`Stockfish suggests ${explanation.move.san}.`);
    } catch (error) {
      if (session === sessionRef.current) setEngineError(error instanceof Error ? error.message : 'Hint unavailable.');
    } finally {
      if (session === sessionRef.current) {
        setBusy(false);
        setHintSearchMode(null);
        setHintProgress('');
      }
    }
  }

  function newGame(): void {
    sessionRef.current += 1;
    engineRef.current?.stop();
    game.reset();
    setSide(setupSide);
    setDifficulty(setupDifficulty);
    setFlipped(false);
    setSelected(null);
    setHint(null);
    setHintSearchMode(null);
    setHintProgress('');
    setPromotion(null);
    setViewPly(null);
    setTip('Own the center, develop your pieces, and keep your king safe.');
    setBusy(false);
    setShowSetup(false);
    setTab('play');
    refresh();
    if (setupSide === 'b' && ready) void playEngine(setupDifficulty);
  }

  function undo(): void {
    if (!moves.length || viewPly !== null) return;
    sessionRef.current += 1;
    engineRef.current?.stop();
    game.undo();
    if (game.turn() !== side && game.history().length) game.undo();
    setBusy(false);
    setHint(null);
    setHintSearchMode(null);
    setHintProgress('');
    setSelected(null);
    setTip('Try a different plan. Look for a safe developing move.');
    refresh();
  }

  function openHistory(ply: number): void {
    if (hintSearchMode) {
      sessionRef.current += 1;
      engineRef.current?.stop();
      setBusy(false);
      setHintSearchMode(null);
      setHintProgress('');
    }
    setViewPly(Math.max(0, Math.min(ply, moves.length)));
    setSelected(null);
    setHint(null);
    setTab('play');
  }

  const playerLabel = side === 'w' ? 'White' : 'Black';
  const engineLabel = side === 'w' ? 'Black' : 'White';

  return (
    <main className="mobile-app">
      <header className="app-header">
        <div className="brand-icon" aria-hidden="true">♞</div>
        <div className="brand-copy"><strong>Stockfish Coach</strong><span>Play better, one move at a time</span></div>
        <div className="offline-badge"><i /> OFFLINE</div>
      </header>

      {tab === 'play' && <div className="play-screen">
        <div className="play-heading">
          <div><span className="eyebrow">QUICK GAME</span><h1>Play chess</h1></div>
          <button className="round-action" type="button" onClick={() => { setSetupSide(side); setSetupDifficulty(difficulty); setShowSetup(true); }} aria-label="New game">＋</button>
        </div>
        <div className="match-strip">
          <div className="player-avatar engine-avatar">♞</div>
          <div className="match-player"><strong>Stockfish</strong><span>{engineLabel} · {difficulty === 'max' ? 'Max strength' : `~${LEVELS[difficulty].label} Elo`}</span></div>
          <div className="engine-actions"><span className="engine-indicator">{ready ? 'Ready' : 'Loading'}</span><button type="button" className="level-control" aria-label="Change engine level" onClick={() => setShowLevelPicker(true)} disabled={busy}>Change level</button></div>
        </div>
        {viewPly !== null && <div className="history-banner" role="status">
          <div><span>VIEWING HISTORY</span><strong>{viewPly === 0 ? 'Starting position' : `${Math.ceil(viewPly / 2)}${viewPly % 2 ? '. White' : '... Black'} · ${displayedMove?.san}`}</strong></div>
          <button type="button" onClick={() => setViewPly(null)}>Return to live</button>
        </div>}
        <div className="board-wrap" ref={boardRef}>
          <div className={`mobile-board ${busy ? 'busy' : ''}`} role="grid" aria-label="Chessboard">
            {[...ranks].flatMap((rank, row) => [...files].map((file, col) => {
              const square = `${file}${rank}` as Square;
              const piece = displayedGame.get(square);
              const light = (file.charCodeAt(0) - 97 + Number(rank)) % 2 === 0;
              const isLast = displayedMove?.from === square || displayedMove?.to === square;
              const isHint = viewPly === null && (hint?.move.from === square || hint?.move.to === square);
              const isTarget = targets.has(square);
              const canDrag = Boolean(piece?.color === side && ready && !busy && viewPly === null && !game.isGameOver() && game.turn() === side && !promotion);
              return <button
                type="button"
                role="gridcell"
                key={square}
                data-square={square}
                aria-label={`${square}${piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${piece.type}` : ''}`}
                className={`square ${light ? 'light' : 'dark'} ${selected === square ? 'selected' : ''} ${isLast ? 'last' : ''} ${isHint ? 'hinted' : ''} ${dragPiece?.from === square ? 'drag-origin' : ''}`}
                style={{ touchAction: canDrag ? 'none' : undefined }}
                onClick={() => {
                  const suppressed = suppressDragClickRef.current;
                  if (suppressed?.from === square && performance.now() < suppressed.until) {
                    suppressDragClickRef.current = null;
                    return;
                  }
                  tapSquare(square);
                }}
                onPointerDown={(event) => startDrag(event, square, piece ?? undefined)}
                onPointerMove={moveDrag}
                onPointerUp={endDrag}
                onPointerCancel={cancelDrag}
              >
                {col === 0 && <small className="rank">{rank}</small>}
                {row === 7 && <small className="file">{file}</small>}
                {piece && <PieceIcon color={piece.color} piece={piece.type} style={pieceStyle} />}
                {isTarget && <span className={piece ? 'capture-target' : 'move-target'} />}
              </button>;
            }))}
          </div>
        </div>
        {dragPiece && <div className="drag-piece" style={{ left: dragPiece.x, top: dragPiece.y - 22 }} aria-hidden="true"><PieceIcon color={dragPiece.color} piece={dragPiece.piece} style={pieceStyle} /></div>}
        <div className="match-strip you-strip">
          <div className="player-avatar you-avatar">YOU</div>
          <div className="match-player"><strong>You</strong><span>{playerLabel}</span></div>
          <span className={`turn-pill ${viewPly === null && game.turn() === side && !busy ? 'active' : ''}`}>{status}</span>
        </div>
        {engineError && <div className="error-banner" role="alert">{engineError}</div>}
        <div className="game-actions">
          <button type="button" onClick={undo} disabled={!moves.length || viewPly !== null}><span>↶</span> Undo</button>
          <button type="button" onClick={() => setFlipped((value) => !value)}><span>⟳</span> Flip</button>
          <button type="button" onClick={() => setShowPiecePicker(true)} aria-label="Choose piece style"><span>♗</span> Pieces</button>
          <button className="hint-button" type="button" onClick={() => void askForHint()} disabled={!ready || busy || viewPly !== null || game.turn() !== side || game.isGameOver()}><span>✦</span> Hint</button>
        </div>
        <div className="hint-mode-picker" role="group" aria-label="Hint analysis depth">
          <div><strong>Hint analysis</strong><small>Separate from opponent strength</small></div>
          <div className="hint-mode-options">{(Object.keys(HINT_MODES) as HintMode[]).map((mode) =>
            <button key={mode} type="button" className={hintMode === mode ? 'active' : ''} aria-pressed={hintMode === mode} onClick={() => setHintMode(mode)} disabled={busy} title={HINT_MODES[mode].description}>
              {HINT_MODES[mode].label}<small>{HINT_MODES[mode].duration}</small>
            </button>)}</div>
        </div>
        {hintSearchMode && <div className="hint-progress" role="status"><span>{hintProgress}</span><button type="button" onClick={cancelHint}>Cancel</button></div>}
        <section className="tip-card" aria-live="polite" ref={tipCardRef}>
          <div className="tip-symbol">✦</div>
          <div>
            <span className="tip-label">{viewPly === null ? 'COACH TIP' : 'POSITION TIP'}</span>
            <p>{displayedTip}</p>
            {viewPly === null && hint?.source === 'book' && <button className="verify-book" type="button" onClick={() => void askForHint('explain', true)} disabled={busy}>Verify with Stockfish →</button>}
            {viewPly === null && hint?.explanation && <div className="hint-explanation">
              <div className="hint-evidence-heading"><strong>Why this move?</strong><span className={`hint-status ${hint.explanation.status}`}>{hint.explanation.status === 'supported' ? 'Checked line' : hint.explanation.status === 'provisional' ? 'Preliminary' : 'Limited evidence'}</span></div>
              <p>{hint.explanation.whyNow}</p>
              {hint.explanation.replySan && <p><b>Best reply in this search:</b> {game.turn() === 'w' ? 'Black' : 'White'} plays {hint.explanation.replySan}. {hint.explanation.replyConsequence}</p>}
              {hint.explanation.alternativeSan && <p><b>{hint.explanation.alternativeGapCp !== null && Math.abs(hint.explanation.alternativeGapCp) <= 35 ? 'Close alternative' : 'Another candidate'}:</b> {hint.explanation.alternativeSan}{hint.explanation.alternativeReplySan ? `, followed by ${hint.explanation.alternativeReplySan} in its searched line` : ''}. {hint.explanation.alternativeGapCp !== null && Math.abs(hint.explanation.alternativeGapCp) <= 35 ? 'The engine scores these moves similarly; either may be practical.' : ''}</p>}
              {hint.explanation.lineSan.length > 1 && <details><summary>Show searched continuation</summary><p>{hint.explanation.lineSan.join(' · ')}</p></details>}
              {hint.bookMoveSan && <small>{hint.bookMoveSan === hint.move.san ? 'This move also appears in the local opening book.' : `The local book suggests ${hint.bookMoveSan}; this search chose ${hint.move.san}.`}</small>}
              <small>{hint.explanation.evidenceNote}</small>
            </div>}
            {viewPly === null && hint && <small>{hint.analysis ? `Stockfish · depth ${hint.analysis.depth} · ${((hint.explanation?.elapsedMs ?? hint.analysis.elapsedMs) / 1000).toFixed(1)} s` : 'Local opening book · not engine verified'}</small>}
            {viewPly === null && hint && <button className="view-hint-board" type="button" onClick={() => boardRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}>View highlighted move on board ↑</button>}
          </div>
        </section>
        <div className="move-preview"><span>Moves</span><strong>{viewPly !== null ? `Viewing ${viewPly} of ${moves.length}` : moves.length ? moves.slice(-4).map((move) => move.san).join('  ·  ') : 'Your opening starts here'}</strong><button type="button" onClick={() => setTab('moves')}>View all →</button></div>
      </div>}

      {tab === 'coach' && <div className="secondary-screen">
        <span className="eyebrow">LEARN AS YOU PLAY</span><h1>Your coach</h1>
        <section className="lesson-hero"><div className="lesson-icon">✦</div><span>IN THIS POSITION</span><h2>{viewPly !== null ? 'Study this move' : game.isGameOver() ? 'Game complete' : game.turn() === side ? 'Find your next idea' : 'Watch the reply'}</h2><p>{displayedTip}</p><button type="button" onClick={() => { setTab('play'); void askForHint(); }} disabled={!ready || busy || viewPly !== null || game.turn() !== side || game.isGameOver()}>Show a Stockfish hint →</button></section>
        <h2 className="section-title">Three habits to build</h2>
        <div className="habit-card"><b>01</b><div><strong>Scan for forcing moves</strong><p>Checks, captures, and direct threats deserve a look before quiet moves.</p></div></div>
        <div className="habit-card"><b>02</b><div><strong>Develop with purpose</strong><p>Bring knights and bishops into play and fight for the center.</p></div></div>
        <div className="habit-card"><b>03</b><div><strong>Keep your king safe</strong><p>Castle when it is sensible, and notice open lines near your king.</p></div></div>
        <p className="coach-footnote">Tips are offline and based on the board. Stockfish chooses hints; you choose the move.</p>
      </div>}

      {tab === 'moves' && <div className="secondary-screen">
        <span className="eyebrow">YOUR GAME</span><h1>Move history</h1>
        <div className="history-summary"><span>{moves.length} plies played</span><strong>{game.isGameOver() ? gameLabel(game, side, false) : 'Tap a move to view it'}</strong></div>
        {moves.length === 0 ? <div className="empty-moves">Make your first move to see the game unfold.</div> : <div className="history-list">
          {Array.from({ length: Math.ceil(moves.length / 2) }, (_, index) => {
            const whitePly = index * 2 + 1;
            const blackPly = whitePly + 1;
            const white = moves[whitePly - 1];
            const black = moves[blackPly - 1];
            return <div className={`history-row ${viewPly === whitePly || viewPly === blackPly ? 'viewed' : ''}`} key={index} onClick={() => openHistory(black ? blackPly : whitePly)}>
              <button type="button" className="move-number-button" onClick={(event) => { event.stopPropagation(); openHistory(black ? blackPly : whitePly); }} aria-label={`View position after move ${index + 1}`}>{index + 1}.</button>
              <button type="button" className={viewPly === whitePly ? 'active' : ''} onClick={(event) => { event.stopPropagation(); openHistory(whitePly); }} aria-label={`View position after ${white.san}`}>{white.san}</button>
              {black ? <button type="button" className={viewPly === blackPly ? 'active' : ''} onClick={(event) => { event.stopPropagation(); openHistory(blackPly); }} aria-label={`View position after ${black.san}`}>{black.san}</button> : <span>—</span>}
            </div>;
          })}
        </div>}
        <button className="back-to-game" type="button" onClick={() => setTab('play')}>Back to the board →</button>
      </div>}

      <nav className="bottom-nav" aria-label="App sections">
        <button type="button" className={tab === 'play' ? 'active' : ''} onClick={() => setTab('play')}><span>♞</span>Play</button>
        <button type="button" className={tab === 'coach' ? 'active' : ''} onClick={() => setTab('coach')}><span>✦</span>Coach</button>
        <button type="button" className={tab === 'moves' ? 'active' : ''} onClick={() => setTab('moves')}><span>☷</span>Moves</button>
      </nav>

      {showSetup && <div className="modal-backdrop" onClick={() => setShowSetup(false)}>
        <section className="setup-sheet" role="dialog" aria-modal="true" aria-label="New game" onClick={(event) => event.stopPropagation()}>
          <div className="sheet-handle" />
          <span className="eyebrow">FRESH START</span><h2>New game</h2>
          <p>Choose your side and a comfortable challenge.</p>
          <strong className="field-title">Play as</strong>
          <div className="choice-row"><button type="button" className={setupSide === 'w' ? 'active' : ''} onClick={() => setSetupSide('w')}>♔ White</button><button type="button" className={setupSide === 'b' ? 'active' : ''} onClick={() => setSetupSide('b')}>♚ Black</button></div>
          <strong className="field-title">Opponent strength</strong>
          <div className="level-list">{(Object.keys(LEVELS) as Difficulty[]).map((level) => <button type="button" className={setupDifficulty === level ? 'active' : ''} key={level} onClick={() => setSetupDifficulty(level)}><span>{LEVELS[level].label}{level !== 'max' ? ' Elo' : ''}</span><small>{LEVELS[level].description}</small></button>)}</div>
          <p className="level-note">Elo levels are approximate. Max removes the strength limit.</p>
          <button className="start-button" type="button" onClick={newGame}>Start game →</button>
          <button className="cancel-button" type="button" onClick={() => setShowSetup(false)}>Keep playing</button>
        </section>
      </div>}
      {showLevelPicker && <div className="modal-backdrop" onClick={() => setShowLevelPicker(false)}>
        <section className="setup-sheet level-sheet" role="dialog" aria-modal="true" aria-label="Engine level" onClick={(event) => event.stopPropagation()}>
          <div className="sheet-handle" />
          <span className="eyebrow">OPPONENT</span><h2>Engine level</h2>
          <p>Change Stockfish’s strength without restarting your game.</p>
          <div className="level-list">{(Object.keys(LEVELS) as Difficulty[]).map((level) => <button type="button" className={difficulty === level ? 'active' : ''} key={level} onClick={() => { setDifficulty(level); setShowLevelPicker(false); }}><span>{LEVELS[level].label}{level !== 'max' ? ' Elo' : ''}</span><small>{LEVELS[level].description}</small></button>)}</div>
          <p className="level-note">Elo levels are approximate. Max removes the strength limit.</p>
          <button className="cancel-button" type="button" onClick={() => setShowLevelPicker(false)}>Keep current level</button>
        </section>
      </div>}
      {showPiecePicker && <div className="modal-backdrop" onClick={() => setShowPiecePicker(false)}>
        <section className="setup-sheet piece-sheet" role="dialog" aria-modal="true" aria-label="Piece style" onClick={(event) => event.stopPropagation()}>
          <div className="sheet-handle" />
          <span className="eyebrow">BOARD LOOK</span><h2>Piece style</h2>
          <p>Choose the pieces that are easiest to recognize. Your game stays in place.</p>
          <div className="piece-style-list">{PIECE_STYLES.map(({ id, name, description }) => <button key={id} type="button" className={pieceStyle === id ? 'active' : ''} aria-pressed={pieceStyle === id} onClick={() => { setPieceStyle(id); setShowPiecePicker(false); }}>
            <span className="piece-style-preview" aria-hidden="true"><span className="preview-light"><PieceIcon color="w" piece="b" style={id} /></span><span className="preview-dark"><PieceIcon color="b" piece="b" style={id} /></span></span>
            <span className="piece-style-copy"><strong>{name}</strong><small>{description}</small></span>
            <span className="piece-style-check" aria-hidden="true">{pieceStyle === id ? '✓' : ''}</span>
          </button>)}</div>
          <p className="piece-art-credit">Optional artwork: Maurizio Monge (Modern, Fantasy) and Alexis Luengas (Classic). License details are included with the app.</p>
          <button className="cancel-button" type="button" onClick={() => setShowPiecePicker(false)}>Back to game</button>
        </section>
      </div>}
      {promotion && <div className="modal-backdrop"><section className="promotion-sheet" role="dialog" aria-modal="true" aria-label="Choose promotion"><h2>Promote your pawn</h2><div>{(['q', 'r', 'b', 'n'] as const).map((piece) => <button key={piece} type="button" aria-label={`Promote to ${{ q: 'queen', r: 'rook', b: 'bishop', n: 'knight' }[piece]}`} onClick={() => makeHumanMove(promotion.from, promotion.to, piece)}><PieceIcon color={side} piece={piece} style={pieceStyle} /></button>)}</div></section></div>}
    </main>
  );
}
