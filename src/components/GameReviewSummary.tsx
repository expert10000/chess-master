import type { PlyRecord } from './MoveList';

interface GameReviewSummaryProps {
  records: PlyRecord[];
  humanColor: 'w' | 'b';
  reviewing: boolean;
  onReviewAll(): void;
  onGoToFirstIssue(): void;
}

const verdictOrder = ['Best', 'Excellent', 'Good', 'Inaccuracy', 'Mistake', 'Blunder'] as const;

export function GameReviewSummary({ records, humanColor, reviewing, onReviewAll, onGoToFirstIssue }: GameReviewSummaryProps) {
  const myMoves = records.filter((record) => record.color === humanColor);
  const reviewed = myMoves.filter((record) => record.review);
  const counts = Object.fromEntries(verdictOrder.map((verdict) => [verdict, reviewed.filter((record) => record.review?.verdict === verdict).length])) as Record<typeof verdictOrder[number], number>;
  const issues = counts.Inaccuracy + counts.Mistake + counts.Blunder;
  const avgLoss = reviewed.length
    ? Math.round(reviewed.reduce((sum, record) => sum + (record.review?.centipawnLoss ?? 0), 0) / reviewed.length)
    : null;

  return (
    <section className="panel game-review-summary">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">Full game review</span>
          <h2>Your move summary</h2>
        </div>
        <span className="review-summary-progress">{reviewed.length}/{myMoves.length}</span>
      </div>

      <div className="verdict-summary-grid">
        {verdictOrder.map((verdict) => (
          <div key={verdict} className={`verdict-summary-item verdict-summary-${verdict.toLowerCase()}`}>
            <strong>{counts[verdict]}</strong>
            <span>{verdict}</span>
          </div>
        ))}
      </div>

      <div className="review-summary-footer">
        <div>
          <span>Average loss</span>
          <strong>{avgLoss === null ? '—' : `${avgLoss} cp`}</strong>
        </div>
        <div>
          <span>Issues</span>
          <strong>{issues}</strong>
        </div>
      </div>

      <div className="review-summary-actions">
        <button type="button" onClick={onReviewAll} disabled={reviewing || records.length === 0}>
          {reviewing ? 'Reviewing…' : reviewed.length === myMoves.length && myMoves.length > 0 ? 'Re-review all' : 'Review all moves'}
        </button>
        <button type="button" onClick={onGoToFirstIssue} disabled={issues === 0}>First issue</button>
      </div>
    </section>
  );
}
