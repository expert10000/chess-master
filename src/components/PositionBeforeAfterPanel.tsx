import { useMemo, useState } from 'react';
import type { MoveReview } from '../lib/chessCoach';
import {
  buildPositionalBeforeAfter,
  type PositionMetricChange,
} from '../lib/positionProfile';

interface PositionBeforeAfterPanelProps {
  review: MoveReview;
  onAskCoach?(question: string): void;
}

function deltaLabel(delta: number): string {
  if (delta > 0) return `+${delta.toFixed(1)}`;
  return delta.toFixed(1);
}

function deltaClass(delta: number): string {
  if (delta >= 0.35) return 'positive';
  if (delta <= -0.35) return 'negative';
  return 'neutral';
}

function MetricRow({ change }: { change: PositionMetricChange }) {
  return (
    <div className="position-metric-row">
      <div className="position-metric-heading">
        <strong>{change.label}</strong>
        <span className={`position-delta ${deltaClass(change.delta)}`}>{deltaLabel(change.delta)}</span>
      </div>

      <div className="position-metric-values">
        <div>
          <span>Before</span>
          <strong>{change.before.toFixed(1)}</strong>
          <i><b style={{ width: `${change.before * 10}%` }} /></i>
        </div>
        <span className="position-metric-arrow">→</span>
        <div>
          <span>After</span>
          <strong>{change.after.toFixed(1)}</strong>
          <i><b style={{ width: `${change.after * 10}%` }} /></i>
        </div>
      </div>

      <p>{change.interpretation}</p>
      <details>
        <summary>Why?</summary>
        <div>
          <span><b>Before:</b> {change.beforeDetail}</span>
          <span><b>After:</b> {change.afterDetail}</span>
        </div>
      </details>
    </div>
  );
}

export function PositionBeforeAfterPanel({
  review,
  onAskCoach,
}: PositionBeforeAfterPanelProps) {
  const [role, setRole] = useState<'played' | 'best'>('played');
  const played = useMemo(() => buildPositionalBeforeAfter(review, 'played'), [review]);
  const best = useMemo(() => buildPositionalBeforeAfter(review, 'best'), [review]);
  const comparison = role === 'best' ? best ?? played : played;
  if (!comparison) return null;

  const bestAvailable = Boolean(best && review.bestMoveUci && review.bestMoveUci !== review.playedUci);
  const mover = comparison.perspective === 'w' ? 'White' : 'Black';

  return (
    <div className="position-before-after-panel">
      <div className="position-before-after-heading">
        <div>
          <span>Positional before / after</span>
          <strong>{comparison.headline}</strong>
        </div>
        <span className={`position-overall-delta ${deltaClass(comparison.overallDelta)}`}>
          {deltaLabel(comparison.overallDelta)} heuristic
        </span>
      </div>

      <div className="position-role-switch" aria-label="Choose move for positional comparison">
        <button
          type="button"
          className={role === 'played' ? 'active' : ''}
          onClick={() => setRole('played')}
        >
          Your move · {played?.moveSan ?? review.playedUci}
        </button>
        <button
          type="button"
          className={role === 'best' ? 'active' : ''}
          onClick={() => setRole('best')}
          disabled={!bestAvailable}
        >
          Best move · {best?.moveSan ?? review.bestMoveSan ?? '—'}
        </button>
      </div>

      <div className="position-profile-overview">
        <div>
          <span>Perspective</span>
          <strong>{mover}</strong>
        </div>
        <div>
          <span>Before profile</span>
          <strong>{comparison.before.overall.toFixed(1)}/10</strong>
        </div>
        <div>
          <span>After profile</span>
          <strong>{comparison.after.overall.toFixed(1)}/10</strong>
        </div>
      </div>

      <div className="position-metric-grid">
        {comparison.changes.map((change) => (
          <MetricRow key={change.id} change={change} />
        ))}
      </div>

      <div className="position-change-summary">
        <div className="position-gains">
          <span>Improves</span>
          {comparison.improvements.length > 0
            ? <ul>{comparison.improvements.slice(0, 3).map((change) => <li key={change.id}>{change.label} {deltaLabel(change.delta)}</li>)}</ul>
            : <p>No clear heuristic gain.</p>}
        </div>
        <div className="position-losses">
          <span>Weakens</span>
          {comparison.declines.length > 0
            ? <ul>{comparison.declines.slice(0, 3).map((change) => <li key={change.id}>{change.label} {deltaLabel(change.delta)}</li>)}</ul>
            : <p>No clear heuristic decline.</p>}
        </div>
      </div>

      <button
        type="button"
        className="position-ask-coach"
        onClick={() => onAskCoach?.(
          `Explain the positional before/after changes caused by ${comparison.moveSan}. Focus on development, king safety, central control, pawn structure, piece activity, and tactical pressure, and use Stockfish evidence where relevant.`,
        )}
      >
        Ask coach about these positional changes
      </button>

      <p className="position-profile-note">
        These 0–10 values are transparent teaching heuristics, not engine evaluations. Use Stockfish score/PV for tactical correctness and these bars for explaining structural direction.
      </p>
    </div>
  );
}
