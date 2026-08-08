import { buildMoveComparison, type MoveComparisonFocus } from '../lib/moveComparison';
import type { MoveReview } from '../lib/chessCoach';

interface MoveComparisonPanelProps {
  review: MoveReview;
  focus: MoveComparisonFocus;
  onFocusChange?(focus: MoveComparisonFocus): void;
  onPlayLine?(fen: string, uciLine: string[], label: string): void;
}

function SideCard({
  review,
  role,
  onPlayLine,
}: {
  review: MoveReview;
  role: 'played' | 'best';
  onPlayLine?(fen: string, uciLine: string[], label: string): void;
}) {
  const model = buildMoveComparison(review);
  const side = role === 'played' ? model.played : model.best;
  const unique = role === 'played' ? model.playedOnlyConcepts : model.bestOnlyConcepts;

  return (
    <div className={`move-comparison-side side-${role}`}>
      <div className="move-comparison-side-heading">
        <span>{side.label}</span>
        <strong>{side.moveSan}</strong>
      </div>

      <div className="move-comparison-eval">
        <span>Evaluation</span>
        <strong>{side.evaluation}</strong>
      </div>

      {unique.length > 0 && (
        <div className="move-comparison-concepts" aria-label={`${side.label} concepts`}>
          {unique.map((label) => <span key={label}>{label}</span>)}
        </div>
      )}

      {side.lineSan.length > 0 && (
        <code>{side.lineSan.join(' ')}</code>
      )}

      {side.lineUci.length > 0 && (
        <button
          type="button"
          className="move-comparison-study"
          onClick={() => onPlayLine?.(
            review.beforeFen,
            side.lineUci,
            role === 'best' ? `Best move · ${side.moveSan}` : `Your move · ${side.moveSan}`,
          )}
        >
          ▶ Study this line
        </button>
      )}
    </div>
  );
}

export function MoveComparisonPanel({
  review,
  focus,
  onFocusChange,
  onPlayLine,
}: MoveComparisonPanelProps) {
  const comparison = buildMoveComparison(review);

  return (
    <div className="move-comparison-panel">
      <div className="move-comparison-heading">
        <div>
          <span>Move comparison</span>
          <strong>{comparison.headline}</strong>
        </div>
        <span className={`verdict verdict-${comparison.verdict.toLowerCase()}`}>{comparison.verdict}</span>
      </div>

      <div className="move-comparison-focus" aria-label="Choose which move arrows are visible on the board">
        <button
          type="button"
          className={focus === 'both' ? 'active' : ''}
          onClick={() => onFocusChange?.('both')}
          aria-pressed={focus === 'both'}
        >
          Both arrows
        </button>
        <button
          type="button"
          className={focus === 'played' ? 'active' : ''}
          onClick={() => onFocusChange?.('played')}
          aria-pressed={focus === 'played'}
          disabled={comparison.sameMove}
        >
          Your move
        </button>
        <button
          type="button"
          className={focus === 'best' ? 'active' : ''}
          onClick={() => onFocusChange?.('best')}
          aria-pressed={focus === 'best'}
        >
          Best move
        </button>
      </div>

      <div className="move-comparison-grid">
        <SideCard review={review} role="played" onPlayLine={onPlayLine} />
        <SideCard review={review} role="best" onPlayLine={onPlayLine} />
      </div>

      <div className="move-comparison-loss">
        <div>
          <span>Evaluation loss</span>
          <strong>{comparison.lossPawns.toFixed(2)} pawns · {comparison.centipawnLoss} cp</strong>
        </div>
        <div className="move-comparison-loss-track" aria-label={`Evaluation loss ${comparison.lossPawns.toFixed(2)} pawns`}>
          <span style={{ width: `${comparison.lossScalePercent}%` }} />
        </div>
        <small>Scale shown from 0 to 3+ pawns. Stockfish evaluation remains the authoritative value.</small>
      </div>

      {!comparison.sameMove && (
        <div className="move-comparison-differences">
          <div>
            <span>What the best move adds</span>
            {comparison.bestOnlyConcepts.length > 0
              ? <ul>{comparison.bestOnlyConcepts.map((item) => <li key={item}>{item}</li>)}</ul>
              : <p>The difference is mainly concrete calculation rather than a unique named concept.</p>}
          </div>
          <div>
            <span>Your move’s distinct idea</span>
            {comparison.playedOnlyConcepts.length > 0
              ? <ul>{comparison.playedOnlyConcepts.map((item) => <li key={item}>{item}</li>)}</ul>
              : <p>No extra named concept was detected for the played move.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
