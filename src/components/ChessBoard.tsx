import { useRef, useState, type CSSProperties, type DragEvent, type MouseEvent } from 'react';
import { type Chess, type Square } from 'chess.js';
import type { BoardArrow, BoardHighlight, BoardIdeaTarget } from '../lib/boardIdeas';

const glyphs: Record<string, string> = {
  wp: '♙',
  wn: '♘',
  wb: '♗',
  wr: '♖',
  wq: '♕',
  wk: '♔',
  bp: '♟',
  bn: '♞',
  bb: '♝',
  br: '♜',
  bq: '♛',
  bk: '♚',
};

const DRAG_MIME = 'application/x-stockfish-coach-square';
const ALL_FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const ALL_RANKS = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

interface EngineMoveAnimation {
  from: Square;
  to: Square;
  durationMs: number;
}

interface ChessBoardProps {
  game: Chess;
  orientation: 'white' | 'black';
  selected: Square | null;
  legalTargets: Set<Square>;
  lastMove: { from: Square; to: Square } | null;
  disabled: boolean;
  engineThinking: boolean;
  engineMoveAnimation: EngineMoveAnimation | null;
  arrows?: BoardArrow[];
  highlights?: BoardHighlight[];
  ideaInspection?: boolean;
  selectedIdeaId?: string | null;
  onIdeaClick?(target: BoardIdeaTarget): void;
  onSquareInspect?(square: Square): void;
  onSquareClick(square: Square): void;
  onPieceDragStart(square: Square): void;
  onPieceDragCancel(): void;
  onPieceDrop(from: Square, to: Square): boolean;
}

function findKing(game: Chess, color: 'w' | 'b'): Square | null {
  for (const rank of ALL_RANKS) {
    for (const file of ALL_FILES) {
      const square = `${file}${rank}` as Square;
      const piece = game.get(square);
      if (piece?.color === color && piece.type === 'k') return square;
    }
  }
  return null;
}

function visualPosition(square: Square, orientation: 'white' | 'black'): { row: number; column: number } {
  const fileIndex = square.charCodeAt(0) - 97;
  const rank = Number(square[1]);

  if (orientation === 'white') {
    return { row: 8 - rank, column: fileIndex };
  }

  return { row: rank - 1, column: 7 - fileIndex };
}

function arrowGeometry(arrow: BoardArrow, orientation: 'white' | 'black') {
  const from = visualPosition(arrow.from, orientation);
  const to = visualPosition(arrow.to, orientation);
  const x1 = (from.column + 0.5) * 12.5;
  const y1 = (from.row + 0.5) * 12.5;
  const x2 = (to.column + 0.5) * 12.5;
  const y2 = (to.row + 0.5) * 12.5;
  const dx = x2 - x1;
  const dy = y2 - y1;
  const length = Math.max(0.001, Math.hypot(dx, dy));
  const trimStart = 2.2;
  const trimEnd = 4.2;
  return {
    x1: x1 + dx / length * trimStart,
    y1: y1 + dy / length * trimStart,
    x2: x2 - dx / length * trimEnd,
    y2: y2 - dy / length * trimEnd,
  };
}

export function ChessBoard({
  game,
  orientation,
  selected,
  legalTargets,
  lastMove,
  disabled,
  engineThinking,
  engineMoveAnimation,
  arrows = [],
  highlights = [],
  ideaInspection = false,
  selectedIdeaId = null,
  onIdeaClick,
  onSquareInspect,
  onSquareClick,
  onPieceDragStart,
  onPieceDragCancel,
  onPieceDrop,
}: ChessBoardProps) {
  const files = orientation === 'white'
    ? ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h']
    : ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'];
  const ranks = orientation === 'white'
    ? ['8', '7', '6', '5', '4', '3', '2', '1']
    : ['1', '2', '3', '4', '5', '6', '7', '8'];

  const [dragFrom, setDragFrom] = useState<Square | null>(null);
  const [dragOver, setDragOver] = useState<Square | null>(null);
  const dropAccepted = useRef(false);

  const checkedKing = game.isCheck() ? findKing(game, game.turn()) : null;
  const checkmate = game.isCheckmate();
  const animationPiece = engineMoveAnimation ? game.get(engineMoveAnimation.from) : null;
  const animationFrom = engineMoveAnimation ? visualPosition(engineMoveAnimation.from, orientation) : null;
  const animationTo = engineMoveAnimation ? visualPosition(engineMoveAnimation.to, orientation) : null;

  const animationStyle = engineMoveAnimation && animationFrom && animationTo
    ? ({
        left: `${animationFrom.column * 12.5}%`,
        top: `${animationFrom.row * 12.5}%`,
        '--move-x': `${(animationTo.column - animationFrom.column) * 100}%`,
        '--move-y': `${(animationTo.row - animationFrom.row) * 100}%`,
        '--move-duration': `${engineMoveAnimation.durationMs}ms`,
      } as CSSProperties)
    : undefined;

  const highlightsBySquare = new Map<Square, BoardHighlight[]>();
  for (const highlight of highlights) {
    const bucket = highlightsBySquare.get(highlight.square) ?? [];
    bucket.push(highlight);
    highlightsBySquare.set(highlight.square, bucket);
  }

  function startDrag(event: DragEvent<HTMLSpanElement>, square: Square): void {
    if (disabled) {
      event.preventDefault();
      return;
    }

    const piece = game.get(square);
    if (!piece || piece.color !== game.turn()) {
      event.preventDefault();
      return;
    }

    dropAccepted.current = false;
    setDragFrom(square);
    setDragOver(null);
    onPieceDragStart(square);

    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData(DRAG_MIME, square);
    event.dataTransfer.setData('text/plain', square);
  }

  function finishDrag(): void {
    setDragFrom(null);
    setDragOver(null);
    if (!dropAccepted.current) onPieceDragCancel();
    dropAccepted.current = false;
  }

  function dragOverSquare(event: DragEvent<HTMLButtonElement>, square: Square): void {
    if (!dragFrom || !legalTargets.has(square)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    if (dragOver !== square) setDragOver(square);
  }

  function leaveSquare(event: DragEvent<HTMLButtonElement>, square: Square): void {
    if (dragOver !== square) return;
    const next = event.relatedTarget;
    if (next instanceof Node && event.currentTarget.contains(next)) return;
    setDragOver(null);
  }

  function dropOnSquare(event: DragEvent<HTMLButtonElement>, square: Square): void {
    event.preventDefault();
    const from = dragFrom ?? event.dataTransfer.getData(DRAG_MIME) as Square;
    setDragOver(null);

    if (!from || !legalTargets.has(square)) {
      dropAccepted.current = false;
      return;
    }

    dropAccepted.current = onPieceDrop(from, square);
  }

  return (
    <div
      className={[
        'chessboard',
        disabled ? 'board-disabled' : '',
        dragFrom ? 'board-dragging' : '',
        engineThinking ? 'engine-thinking' : '',
        game.isGameOver() ? 'board-game-over' : '',
        ideaInspection ? 'board-idea-inspection' : '',
      ].filter(Boolean).join(' ')}
      role="grid"
      aria-label="Chessboard"
      aria-busy={engineThinking}
    >
      {ranks.flatMap((rank, rowIndex) =>
        files.map((file, columnIndex) => {
          const square = `${file}${rank}` as Square;
          const piece = game.get(square);
          const isLight = (file.charCodeAt(0) - 97 + Number(rank)) % 2 === 0;
          const isSelected = square === selected;
          const isTarget = legalTargets.has(square);
          const isLastFrom = lastMove?.from === square;
          const isLastTo = lastMove?.to === square;
          const isDragSource = square === dragFrom;
          const isDragOver = square === dragOver && isTarget;
          const isEngineAnimationSource = engineMoveAnimation?.from === square;
          const isCheckedKing = checkedKing === square;
          const showFile = rowIndex === 7;
          const showRank = columnIndex === 0;
          const canDrag = !disabled && Boolean(piece && piece.color === game.turn());
          const squareHighlights = highlightsBySquare.get(square) ?? [];
          const isInspectedSquare = selectedIdeaId === `square:${square}`;

          return (
            <button
              type="button"
              role="gridcell"
              aria-label={`${square}${piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${piece.type}` : ''}`}
              className={[
                'board-square',
                isLight ? 'light-square' : 'dark-square',
                isSelected ? 'selected-square' : '',
                isLastFrom ? 'last-from-square' : '',
                isLastTo ? 'last-to-square' : '',
                isDragSource ? 'drag-source-square' : '',
                isDragOver ? 'drag-over-square' : '',
                isEngineAnimationSource ? 'engine-animation-source' : '',
                isCheckedKing ? (checkmate ? 'checkmate-square' : 'check-square') : '',
                isInspectedSquare ? 'inspected-square' : '',
              ].filter(Boolean).join(' ')}
              key={square}
              onClick={() => {
                if (ideaInspection) {
                  onSquareInspect?.(square);
                  return;
                }
                onSquareClick(square);
              }}
              onDragOver={(event) => dragOverSquare(event, square)}
              onDragLeave={(event) => leaveSquare(event, square)}
              onDrop={(event) => dropOnSquare(event, square)}
              disabled={disabled && !ideaInspection}
              aria-disabled={disabled || ideaInspection}
            >
              {showRank && <span className="rank-label">{rank}</span>}
              {showFile && <span className="file-label">{file}</span>}
              {piece && (
                <span
                  className={`piece piece-${piece.color}`}
                  draggable={canDrag}
                  onDragStart={(event) => startDrag(event, square)}
                  onDragEnd={finishDrag}
                  aria-hidden="true"
                >
                  {glyphs[`${piece.color}${piece.type}`]}
                </span>
              )}
              {isTarget && <span className={piece ? 'capture-ring' : 'move-dot'} />}
              {squareHighlights.slice(0, 2).map((highlight, index) => (
                <span
                  className={`idea-highlight-ring idea-${highlight.kind} idea-ring-${index} ${selectedIdeaId === `highlight:${highlight.id}` ? 'idea-selected' : ''}`}
                  title={`${highlight.label}${highlight.detail ? ` — ${highlight.detail}` : ''}`}
                  aria-hidden="true"
                  key={highlight.id}
                  onClick={ideaInspection && onIdeaClick ? (event) => {
                    event.stopPropagation();
                    onIdeaClick({ type: 'highlight', item: highlight });
                  } : undefined}
                />
              ))}
            </button>
          );
        }),
      )}

      {arrows.length > 0 && (
        <svg
          className={`board-arrow-layer ${ideaInspection ? 'interactive' : ''}`}
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          aria-hidden={ideaInspection ? undefined : true}
          aria-label={ideaInspection ? 'Interactive board idea arrows' : undefined}
        >
          <defs>
            {(['best', 'played', 'candidate', 'tactical', 'white-control', 'black-control', 'legal'] as const).map((kind) => (
              <marker
                id={`arrow-head-${kind}`}
                key={kind}
                viewBox="0 0 10 10"
                refX="8"
                refY="5"
                markerWidth="5.2"
                markerHeight="5.2"
                orient="auto-start-reverse"
              >
                <path d="M 0 0 L 10 5 L 0 10 z" className={`arrow-head arrow-${kind}`} />
              </marker>
            ))}
          </defs>
          {arrows.map((arrow) => {
            const geometry = arrowGeometry(arrow, orientation);
            const handleArrowClick = ideaInspection && onIdeaClick ? (event: MouseEvent<SVGLineElement>) => {
              event.stopPropagation();
              onIdeaClick({ type: 'arrow', item: arrow });
            } : undefined;
            return (
              <g key={arrow.id}>
                {ideaInspection && (
                  <line
                    className="board-idea-arrow-hit"
                    x1={geometry.x1}
                    y1={geometry.y1}
                    x2={geometry.x2}
                    y2={geometry.y2}
                    onClick={handleArrowClick}
                  />
                )}
                <line
                  className={`board-idea-arrow arrow-${arrow.kind} ${selectedIdeaId === `arrow:${arrow.id}` ? 'idea-selected' : ''}`}
                  x1={geometry.x1}
                  y1={geometry.y1}
                  x2={geometry.x2}
                  y2={geometry.y2}
                  markerEnd={`url(#arrow-head-${arrow.kind})`}
                  onClick={handleArrowClick}
                />
              </g>
            );
          })}
        </svg>
      )}

      {engineMoveAnimation && animationPiece && animationStyle && (
        <div className="engine-move-overlay" style={animationStyle} aria-hidden="true">
          <span className={`piece piece-${animationPiece.color} engine-moving-piece`}>
            {glyphs[`${animationPiece.color}${animationPiece.type}`]}
          </span>
        </div>
      )}
    </div>
  );
}
