import {
  OPENING_BOOK_LINE_COUNT,
  type OpeningAlternative,
  type OpeningRecognition,
} from '../lib/openingBook';

interface OpeningExplorerPanelProps {
  recognition: OpeningRecognition | null;
  disabled?: boolean;
  onStudyAlternative?(alternative: OpeningAlternative): void;
  preferredMoveUci?: string | null;
  onSaveAlternative?(alternative: OpeningAlternative): void;
  onForgetPreferred?(): void;
  onTrainDeviation?(): void;
  onGoToTheoryEnd?(ply: number): void;
}

function openingLabel(alternative: OpeningAlternative): string {
  return alternative.targetVariation
    ? `${alternative.targetName} · ${alternative.targetVariation}`
    : alternative.targetName;
}

export function OpeningExplorerPanel({
  recognition,
  disabled = false,
  onStudyAlternative,
  preferredMoveUci = null,
  onSaveAlternative,
  onForgetPreferred,
  onTrainDeviation,
  onGoToTheoryEnd,
}: OpeningExplorerPanelProps) {
  if (!recognition) {
    return (
      <section className="panel opening-explorer-panel">
        <div className="panel-heading compact">
          <div>
            <span className="eyebrow">Opening explorer</span>
            <h2>Local ECO book</h2>
          </div>
        </div>
        <div className="opening-unavailable">
          <strong>Opening recognition is unavailable here.</strong>
          <p>The local explorer starts from the standard initial chess position. Custom FEN positions remain fully usable with Stockfish analysis.</p>
        </div>
      </section>
    );
  }

  const title = recognition.variation
    ? `${recognition.name} · ${recognition.variation}`
    : recognition.name;

  return (
    <section className="panel opening-explorer-panel">
      <div className="panel-heading compact opening-heading">
        <div>
          <span className="eyebrow">Opening explorer</span>
          <h2>{title}</h2>
        </div>
        {recognition.eco && <span className="eco-badge">{recognition.eco}</span>}
      </div>

      <div className="opening-taxonomy-grid" aria-label="Opening classification">
        <div>
          <span>Type</span>
          <strong>{recognition.taxonomy.type}</strong>
        </div>
        <div>
          <span>Family</span>
          <strong>{recognition.taxonomy.family}</strong>
        </div>
        <div>
          <span>Branch</span>
          <strong>{recognition.taxonomy.branch}</strong>
        </div>
        <div>
          <span>Variation</span>
          <strong>{recognition.variation ?? '—'}</strong>
        </div>
      </div>

      <div className={`opening-theory-state ${recognition.theoryEnded ? 'ended' : 'book'}`}>
        <strong>{recognition.theoryEnded ? 'Theory ended here · local book' : 'Inside local book'}</strong>
        <span>{recognition.coverageLabel}</span>
      </div>

      {recognition.pathSan.length > 0 && (
        <div className="opening-path">
          <span>Book path</span>
          <code>{recognition.pathSan.join(' ')}</code>
        </div>
      )}

      {recognition.deviation && (
        <div className="opening-deviation-card">
          <div>
            <span>Deviation</span>
            <strong>{recognition.deviation.moveNumber}{recognition.deviation.side === 'Black' ? '…' : '.'}{recognition.deviation.san}</strong>
          </div>
          <div className="opening-deviation-actions">
            <button
              type="button"
              onClick={() => onGoToTheoryEnd?.(recognition.deviation!.ply - 1)}
              disabled={disabled}
            >
              Go to theory end
            </button>
            <button
              type="button"
              className="primary-button"
              onClick={onTrainDeviation}
              disabled={disabled || recognition.alternatives.length === 0}
            >
              Train deviation
            </button>
          </div>
        </div>
      )}

      <div className="opening-alternatives-heading">
        <span>{recognition.theoryEnded ? 'Book alternatives at the deviation' : 'Common local continuations'}</span>
        <small>{OPENING_BOOK_LINE_COUNT} curated branches · offline</small>
      </div>

      {recognition.alternatives.length > 0 ? (
        <div className="opening-alternative-list">
          {recognition.alternatives.slice(0, 6).map((alternative) => (
            <div className="opening-alternative" key={alternative.uci}>
              <div className="opening-alt-main">
                <strong>{alternative.san}</strong>
                <span>{alternative.localShare}% local share</span>
              </div>
              <div className="opening-alt-name">
                <span>{alternative.targetEco}</span>
                <strong>{openingLabel(alternative)}</strong>
              </div>
              <div className="opening-alt-actions">
                <button
                  type="button"
                  className={preferredMoveUci === alternative.uci ? 'opening-preferred-button active' : 'opening-preferred-button'}
                  onClick={() => preferredMoveUci === alternative.uci
                    ? onForgetPreferred?.()
                    : onSaveAlternative?.(alternative)}
                  disabled={disabled}
                  title={preferredMoveUci === alternative.uci ? 'Remove from my repertoire' : 'Save as my repertoire move'}
                >
                  {preferredMoveUci === alternative.uci ? '★ My move' : '☆ Save'}
                </button>
                <button
                  type="button"
                  onClick={() => onStudyAlternative?.(alternative)}
                  disabled={disabled || alternative.continuationUci.length === 0}
                >
                  ▶ Study
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="opening-book-leaf">
          <strong>End of this bundled line.</strong>
          <p>Stockfish can continue the analysis; the local opening book simply has no deeper branch here yet.</p>
        </div>
      )}

      <p className="opening-book-note">
        “Local share” is a relative weight inside the bundled curated book, not a live master-database percentage.
      </p>
    </section>
  );
}
