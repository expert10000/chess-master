import { useLayoutEffect, useRef } from 'react';
import type { MoveReview } from '../lib/chessCoach';

export type ReplaySpeed = 0.5 | 1 | 2;

export interface PlyRecord {
  id: number;
  ply: number;
  beforeFen: string;
  afterFen: string;
  uci: string;
  san: string;
  color: 'w' | 'b';
  review?: MoveReview;
}

interface MoveListProps {
  records: PlyRecord[];
  activeId: number | null;
  viewedPly: number | null;
  disabled?: boolean;
  onNavigate(ply: number | null): void;
  playing?: boolean;
  onPlayPause?(): void;
  onReplay?(): void;
  replaySpeed: ReplaySpeed;
  onReplaySpeedChange(speed: ReplaySpeed): void;
  focusMode: boolean;
  onToggleFocus(): void;
  onFork?(): void;
  forkDisabled?: boolean;
  onPreviousMistake?(): void;
  onNextMistake?(): void;
  previousMistakeAvailable?: boolean;
  nextMistakeAvailable?: boolean;
}

export function MoveList({
  records,
  activeId,
  viewedPly,
  disabled = false,
  onNavigate,
  playing = false,
  onPlayPause,
  onReplay,
  replaySpeed,
  onReplaySpeedChange,
  focusMode,
  onToggleFocus,
  onFork,
  forkDisabled = false,
  onPreviousMistake,
  onNextMistake,
  previousMistakeAvailable = false,
  nextMistakeAvailable = false,
}: MoveListProps) {
  const moveListRef = useRef<HTMLDivElement>(null);
  const rows: Array<{ moveNumber: number; white?: PlyRecord; black?: PlyRecord }> = [];
  for (const record of records) {
    const moveNumber = Math.ceil(record.ply / 2);
    let row = rows.find((candidate) => candidate.moveNumber === moveNumber);
    if (!row) {
      row = { moveNumber };
      rows.push(row);
    }
    if (record.color === 'w') row.white = record;
    else row.black = record;
  }

  const currentPly = viewedPly ?? records.length;
  const atStart = currentPly === 0;
  const atLatest = viewedPly === null;

  useLayoutEffect(() => {
    const list = moveListRef.current;
    if (!list || records.length === 0) return;
    if (viewedPly === 0) {
      list.scrollTop = 0;
      return;
    }
    const targetPly = viewedPly ?? records.length;
    const selectedRow = list.querySelector<HTMLElement>(`[data-ply="${targetPly}"]`)?.closest<HTMLElement>('.move-row');
    if (!selectedRow) return;
    const listBounds = list.getBoundingClientRect();
    const rowBounds = selectedRow.getBoundingClientRect();
    if (rowBounds.top < listBounds.top + 8 || rowBounds.bottom > listBounds.bottom - 8) {
      list.scrollTop += rowBounds.top - listBounds.top - (list.clientHeight - rowBounds.height) / 2;
    }
  }, [viewedPly, records.length, records[0]?.id]);

  return (
    <div className="history-browser">
      <div className="history-navigation" aria-label="Move history navigation">
        <button
          type="button"
          onClick={() => onNavigate(0)}
          disabled={disabled || records.length === 0 || atStart}
          title="Starting position (Home)"
          aria-label="Go to starting position"
        >|‹</button>
        <button
          type="button"
          onClick={() => onNavigate(Math.max(0, currentPly - 1))}
          disabled={disabled || records.length === 0 || atStart}
          title="Previous ply (Left Arrow)"
          aria-label="Previous ply"
        >‹</button>
        <div className={`history-position ${atLatest ? 'live' : ''}`}>
          <strong>{atLatest ? 'LIVE' : currentPly === 0 ? 'START' : `PLY ${currentPly}`}</strong>
          <span>{currentPly}/{records.length}</span>
        </div>
        <button
          type="button"
          onClick={() => currentPly + 1 > records.length ? onNavigate(null) : onNavigate(currentPly + 1)}
          disabled={disabled || records.length === 0 || atLatest}
          title="Next ply (Right Arrow)"
          aria-label="Next ply"
        >›</button>
        <button
          type="button"
          onClick={() => onNavigate(null)}
          disabled={disabled || records.length === 0 || atLatest}
          title="Latest position (End)"
          aria-label="Go to latest position"
        >›|</button>
      </div>

      <div className="history-playback-actions" aria-label="Game replay controls">
        <button
          className="history-step-button"
          type="button"
          onClick={() => onNavigate(Math.max(0, currentPly - 1))}
          disabled={disabled || records.length === 0 || atStart}
        >← Previous move</button>
        <button
          className="history-step-button"
          type="button"
          onClick={() => currentPly + 1 > records.length ? onNavigate(null) : onNavigate(currentPly + 1)}
          disabled={disabled || records.length === 0 || atLatest}
        >Next move →</button>
        <button type="button" onClick={onPlayPause} disabled={disabled || records.length === 0}>{playing ? 'Pause replay' : 'Play moves'}</button>
        <button type="button" onClick={onReplay} disabled={disabled || records.length === 0}>Replay from start</button>
        <button type="button" onClick={onFork} disabled={disabled || forkDisabled || viewedPly === null} title="Start a new playable variation from the selected position">Fork &amp; play</button>
      </div>

      <div className="history-replay-options">
        <div className="history-speed-control" aria-label="Replay speed">
          <span>Speed</span>
          {([0.5, 1, 2] as const).map((speed) => (
            <button
              type="button"
              key={speed}
              aria-pressed={replaySpeed === speed}
              className={replaySpeed === speed ? 'active' : ''}
              onClick={() => onReplaySpeedChange(speed)}
            >{speed}×</button>
          ))}
        </div>
        <button type="button" className="history-focus-button" onClick={onToggleFocus} disabled={records.length === 0} aria-pressed={focusMode}>
          {focusMode ? 'Exit focus' : 'Focus replay'}
        </button>
      </div>

      <div className="history-shortcuts">←/→ step · Home start · End latest · [ / ] mistakes</div>

      <div className="mistake-navigation" aria-label="Mistake navigation">
        <button
          type="button"
          onClick={onPreviousMistake}
          disabled={disabled || !previousMistakeAvailable}
          title="Previous inaccuracy, mistake, or blunder"
        >← Previous mistake</button>
        <button
          type="button"
          onClick={onNextMistake}
          disabled={disabled || !nextMistakeAvailable}
          title="Next inaccuracy, mistake, or blunder"
        >Next mistake →</button>
      </div>

      <div className="move-list" aria-label="Move history" aria-busy={disabled} ref={moveListRef}>
        {rows.length === 0 && <div className="empty-state">Play a move to begin the game.</div>}
        {rows.map((row) => (
          <div className="move-row" key={row.moveNumber}>
            <span className="move-number">{row.moveNumber}.</span>
            {(['white', 'black'] as const).map((side) => {
              const record = side === 'white' ? row.white : row.black;
              return record ? (
                <button
                  type="button"
                  className={[
                    'move-chip',
                    activeId === record.id ? 'active' : '',
                    viewedPly === record.ply ? 'viewed' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => onNavigate(record.ply)}
                  title={`View position after ${record.san}`}
                  data-ply={record.ply}
                  disabled={disabled}
                  key={side}
                >
                  <span className="move-san">{record.san}</span>
                  {record.review && (
                    <span
                      className={`move-verdict move-verdict-${record.review.verdict.toLowerCase()}`}
                      title={`${record.review.verdict} · ${record.review.centipawnLoss} cp loss`}
                    >
                      {record.review.verdict === 'Inaccuracy' ? '?!'
                        : record.review.verdict === 'Mistake' ? '?'
                          : record.review.verdict === 'Blunder' ? '??'
                            : record.review.verdict === 'Best' ? '★'
                              : record.review.verdict === 'Excellent' ? '!' : '✓'}
                    </span>
                  )}
                </button>
              ) : <span className="move-placeholder" key={side}>—</span>;
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
