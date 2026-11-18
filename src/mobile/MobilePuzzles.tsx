import { useRef, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react';
import { type PieceSymbol, type Square } from 'chess.js';
import { usePuzzleTrainer } from '../hooks/usePuzzleTrainer';
import { PUZZLE_LEVELS, PUZZLE_MOTIFS, puzzleSanLine, puzzleTitle, type PuzzleLevel, type PuzzleMotif } from '../lib/puzzles';

const motifNames: Record<string, string> = { all: 'All themes', mate: 'Checkmate', fork: 'Fork', pin: 'Pin', skewer: 'Skewer', discoveredAttack: 'Discovered attack', hangingPiece: 'Win a piece', sacrifice: 'Sacrifice', endgame: 'Endgame' };

export function MobilePuzzles({ renderPiece }: { renderPiece: (color: 'w' | 'b', piece: PieceSymbol) => ReactNode }) {
  const t = usePuzzleTrainer();
  const drag = useRef<{ from: Square; x: number; y: number } | null>(null);
  const suppressClick = useRef(false);
  const files = t.orientation === 'white' ? 'abcdefgh' : 'hgfedcba';
  const ranks = t.orientation === 'white' ? '87654321' : '12345678';
  const canMove = !t.solved && !t.revealed && t.replayIndex === null;
  const list = t.filtered.slice(t.page * 6, t.page * 6 + 6);
  const solution = t.puzzle && (t.solved || t.revealed) ? puzzleSanLine(t.puzzle) : [];

  function pointerDown(event: ReactPointerEvent<HTMLButtonElement>, square: Square) {
    if (!canMove || t.currentGame.get(square)?.color !== t.currentGame.turn()) return;
    drag.current = { from: square, x: event.clientX, y: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function pointerUp(event: ReactPointerEvent<HTMLButtonElement>) {
    const start = drag.current;
    drag.current = null;
    if (!start || Math.hypot(event.clientX - start.x, event.clientY - start.y) < 12) return;
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLButtonElement>('.puzzle-mobile-board .square');
    if (target?.dataset.square) t.attempt(start.from, target.dataset.square as Square);
    suppressClick.current = true;
    window.setTimeout(() => { suppressClick.current = false; }, 250);
  }

  return <div className="puzzle-screen" aria-label="Chess puzzles">
    <div className="puzzle-mobile-title"><div><span className="eyebrow">OFFLINE PRACTICE</span><h1>Puzzles</h1></div><span>{t.solvedIds.length} solved</span></div>
    <div className="puzzle-mobile-board-area">
      <div className="puzzle-mobile-meta"><strong>{t.puzzle ? puzzleTitle(t.puzzle) : 'Choose a puzzle'}</strong><span>{t.puzzle?.rating} rating · {t.currentGame.turn() === 'w' ? 'White' : 'Black'} to move</span></div>
      <div className="board-wrap"><div className="mobile-board puzzle-mobile-board" role="grid" aria-label="Puzzle chessboard">
        {[...ranks].flatMap((rank, row) => [...files].map((file, col) => {
          const square = `${file}${rank}` as Square;
          const piece = t.currentGame.get(square);
          const light = (file.charCodeAt(0) - 97 + Number(rank)) % 2 === 0;
          return <button key={square} type="button" role="gridcell" data-square={square} aria-label={`${square}${piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${piece.type}` : ''}`} className={`square ${light ? 'light' : 'dark'} ${t.selectedSquare === square ? 'selected' : ''} ${t.hintFrom === square || t.hintTo === square ? 'hinted' : ''}`} style={{ touchAction: 'none' }} onClick={() => { if (suppressClick.current) return; t.tap(square); }} onPointerDown={(event) => pointerDown(event, square)} onPointerUp={pointerUp} onPointerCancel={() => { drag.current = null; }}>
            {col === 0 && <small className="rank">{rank}</small>}{row === 7 && <small className="file">{file}</small>}{piece && renderPiece(piece.color, piece.type)}{t.targets.has(square) && <span className={piece ? 'capture-target' : 'move-target'} />}
          </button>;
        }))}
      </div></div>
      <div className="puzzle-mobile-status" role="status">{t.solved ? '✓ ' : ''}{t.message}</div>
      <div className="puzzle-mobile-actions"><button type="button" onClick={() => t.setHintLevel(Math.min(2, t.hintLevel + 1))} disabled={!canMove || t.hintLevel >= 2}>Hint {t.hintLevel ? `${t.hintLevel}/2` : ''}</button><button type="button" onClick={t.retry}>Retry</button><button type="button" onClick={t.reveal} disabled={!canMove}>Solution</button><button type="button" onClick={t.next}>Next →</button></div>
      {t.solved && t.replayIndex === null && <button className="puzzle-mobile-review" type="button" onClick={t.review}>Review moves on board →</button>}
      {t.replayIndex !== null && <div className="puzzle-mobile-replay"><button type="button" aria-label="Previous solution move" onClick={() => t.setReviewIndex(t.replayIndex! - 1)} disabled={t.replayIndex === 0}>‹</button><strong>{t.replayIndex === 0 ? 'Start' : `${t.replayIndex}/${t.positions.length - 1} · ${solution[t.replayIndex - 1]}`}</strong><button type="button" aria-label="Next solution move" onClick={() => t.setReviewIndex(t.replayIndex! + 1)} disabled={t.replayIndex === t.positions.length - 1}>›</button></div>}
      {solution.length > 0 && <div className="puzzle-mobile-line">{solution.map((san, index) => <button type="button" key={index} className={t.replayIndex === index + 1 ? 'active' : ''} onClick={() => t.setReviewIndex(index + 1)}>{index % 2 === 0 ? `${Math.floor(index / 2) + 1}. ` : ''}{san}</button>)}</div>}
    </div>
    <div className="puzzle-mobile-picker"><div className="puzzle-mobile-filters"><label>Difficulty<select value={t.level} onChange={(event) => t.changeLevel(event.target.value as PuzzleLevel)}>{PUZZLE_LEVELS.map((band) => <option key={band.id} value={band.id}>{band.label}</option>)}</select></label><label>Theme<select value={t.motif} onChange={(event) => t.changeMotif(event.target.value as PuzzleMotif)}>{PUZZLE_MOTIFS.map((motif) => <option key={motif} value={motif}>{motifNames[motif]}</option>)}</select></label></div><small>{t.filtered.length} puzzles available</small><div className="puzzle-mobile-list">{list.map((item) => <button type="button" key={item.id} className={item.id === t.puzzle?.id ? 'active' : ''} onClick={() => t.selectPuzzle(item.id)}><span>{t.solvedIds.includes(item.id) ? '✓ ' : ''}{puzzleTitle(item)}</span><b>{item.rating}</b></button>)}</div><div className="puzzle-mobile-pages"><button type="button" disabled={t.page === 0} onClick={() => t.setPage(t.page - 1)}>‹</button><span>{t.page + 1}/{Math.max(1, Math.ceil(t.filtered.length / 6))}</span><button type="button" disabled={(t.page + 1) * 6 >= t.filtered.length} onClick={() => t.setPage(t.page + 1)}>›</button></div><small>From Lichess · CC0</small></div>
  </div>;
}
