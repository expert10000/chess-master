import type { PlyRecord } from './MoveList';
import { buildEvaluationTimeline, timelineRange } from '../lib/evaluationTimeline';

interface EvaluationTimelineProps {
  records: PlyRecord[];
  humanColor: 'w' | 'b';
  viewedPly: number | null;
  disabled?: boolean;
  onNavigate(ply: number): void;
  onReviewAll(): void;
}

const WIDTH = 820;
const HEIGHT = 238;
const LEFT = 44;
const RIGHT = 18;
const TOP = 18;
const BOTTOM = 34;

export function EvaluationTimeline({
  records,
  humanColor,
  viewedPly,
  disabled = false,
  onNavigate,
  onReviewAll,
}: EvaluationTimelineProps) {
  const points = buildEvaluationTimeline(records, humanColor);
  const reviewedCount = records.filter((record) => Boolean(record.review)).length;
  const range = timelineRange(points);
  const plotWidth = WIDTH - LEFT - RIGHT;
  const plotHeight = HEIGHT - TOP - BOTTOM;
  const maxPly = Math.max(1, records.length);
  const activePly = viewedPly ?? records.length;

  const x = (ply: number) => LEFT + (ply / maxPly) * plotWidth;
  const y = (evaluation: number) => {
    const clamped = Math.max(-range, Math.min(range, evaluation));
    return TOP + ((range - clamped) / (range * 2)) * plotHeight;
  };

  const linePath = points.length
    ? points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${x(point.ply).toFixed(1)} ${y(point.evaluation).toFixed(1)}`).join(' ')
    : '';

  const tickPlies = Array.from(new Set([0, Math.round(maxPly / 4), Math.round(maxPly / 2), Math.round((maxPly * 3) / 4), maxPly]));
  const issues = points.filter((point) => point.isIssue);

  return (
    <section className="panel evaluation-timeline-panel">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">Game review</span>
          <h2>Evaluation timeline</h2>
        </div>
        <div className="timeline-progress">
          <strong>{reviewedCount}/{records.length}</strong>
          <span>reviewed</span>
        </div>
      </div>

      <div className="timeline-legend">
        <span>White advantage ↑</span>
        <span>{issues.length} of your issues marked</span>
        <span>Black advantage ↓</span>
      </div>

      {points.length === 0 ? (
        <div className="timeline-empty">
          <span>Review moves to build the evaluation graph.</span>
          <button type="button" onClick={onReviewAll} disabled={disabled || records.length === 0}>Review all moves</button>
        </div>
      ) : (
        <div className="timeline-chart-wrap">
          <svg className="evaluation-timeline" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="Stockfish evaluation by move. Click a point to jump to that position.">
            <rect className="timeline-white-zone" x={LEFT} y={TOP} width={plotWidth} height={plotHeight / 2} />
            <rect className="timeline-black-zone" x={LEFT} y={TOP + plotHeight / 2} width={plotWidth} height={plotHeight / 2} />

            {[range, range / 2, 0, -range / 2, -range].map((value) => (
              <g key={value}>
                <line className={value === 0 ? 'timeline-zero-line' : 'timeline-grid-line'} x1={LEFT} x2={WIDTH - RIGHT} y1={y(value)} y2={y(value)} />
                <text className="timeline-axis-label" x={LEFT - 7} y={y(value) + 4} textAnchor="end">
                  {value > 0 ? `+${value}` : value}
                </text>
              </g>
            ))}

            {tickPlies.map((ply) => (
              <g key={ply}>
                <line className="timeline-x-grid" x1={x(ply)} x2={x(ply)} y1={TOP} y2={HEIGHT - BOTTOM} />
                <text className="timeline-x-label" x={x(ply)} y={HEIGHT - 10} textAnchor="middle">{ply === 0 ? 'Start' : ply}</text>
              </g>
            ))}

            {linePath && <path className="timeline-eval-line" d={linePath} />}

            {points.map((point) => {
              const issueClass = point.isIssue && point.verdict ? `timeline-issue-${point.verdict.toLowerCase()}` : '';
              const active = point.ply === activePly;
              const title = point.ply === 0
                ? `Starting position · ${point.display}`
                : `Ply ${point.ply} · ${point.san ?? ''} · ${point.display}${point.verdict ? ` · ${point.verdict}` : ''}`;
              return (
                <g
                  key={`${point.ply}-${point.san ?? 'start'}`}
                  className={`timeline-point-group ${active ? 'active' : ''} ${point.isIssue ? 'issue' : ''}`}
                  role="button"
                  tabIndex={disabled ? -1 : 0}
                  aria-label={title}
                  onClick={() => !disabled && onNavigate(point.ply)}
                  onKeyDown={(event) => {
                    if (!disabled && (event.key === 'Enter' || event.key === ' ')) {
                      event.preventDefault();
                      onNavigate(point.ply);
                    }
                  }}
                >
                  <title>{title}</title>
                  {active && <circle className="timeline-active-ring" cx={x(point.ply)} cy={y(point.evaluation)} r={9} />}
                  <circle
                    className={`timeline-point ${issueClass}`}
                    cx={x(point.ply)}
                    cy={y(point.evaluation)}
                    r={point.isIssue ? 6.2 : 4.1}
                  />
                  {point.isIssue && (
                    <text className="timeline-issue-symbol" x={x(point.ply)} y={y(point.evaluation) - 10} textAnchor="middle">
                      {point.verdict === 'Blunder' ? '??' : point.verdict === 'Mistake' ? '?' : '?!'}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      )}

      {reviewedCount < records.length && points.length > 0 && (
        <div className="timeline-incomplete">
          <span>{records.length - reviewedCount} moves are still unreviewed, so the graph may have gaps.</span>
          <button type="button" onClick={onReviewAll} disabled={disabled}>Complete review</button>
        </div>
      )}
    </section>
  );
}
