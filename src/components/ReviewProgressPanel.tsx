interface ReviewProgressPanelProps {
  current: number;
  total: number;
  san: string;
}

export function ReviewProgressPanel({
  current,
  total,
  san,
}: ReviewProgressPanelProps) {
  const percent = total > 0 ? Math.round(current / total * 100) : 0;

  return (
    <div className="review-batch-progress" aria-live="polite">
      <div className="review-batch-progress-heading">
        <span>Full-game review</span>
        <strong>{current}/{total} · {percent}%</strong>
      </div>
      <div className="review-batch-progress-track" aria-hidden="true">
        <span style={{ width: `${percent}%` }} />
      </div>
      <small>{san ? `Analyzing ${san}` : 'Preparing analysis…'}</small>
    </div>
  );
}
