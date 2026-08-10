import type { MoveReview } from '../lib/chessCoach';
import type { OpeningRecognition } from '../lib/openingBook';
import {
  assessOpeningDeviation,
  deviationMemoryForRecognition,
  repertoireChoiceForFen,
  repertoireStats,
  sortedDeviationMemories,
  type OpeningDeviationMemory,
  type RepertoireMemory,
} from '../lib/repertoireMemory';

interface OpeningMemoryPanelProps {
  recognition: OpeningRecognition | null;
  memory: RepertoireMemory;
  deviationReview?: MoveReview;
  disabled?: boolean;
  onSaveTopBookMove?(): void;
  onKeepPlayedMove?(): void;
  onForgetCurrent?(): void;
  onTrainCurrentRepertoire?(): void;
  onTrainCurrentDeviation?(): void;
  onTrainRememberedDeviation?(deviation: OpeningDeviationMemory): void;
  onReviewDeviation?(): void;
}

function openingName(deviation: OpeningDeviationMemory): string {
  return deviation.variation
    ? `${deviation.openingName} · ${deviation.variation}`
    : deviation.openingName;
}

export function OpeningMemoryPanel({
  recognition,
  memory,
  deviationReview,
  disabled = false,
  onSaveTopBookMove,
  onKeepPlayedMove,
  onForgetCurrent,
  onTrainCurrentRepertoire,
  onTrainCurrentDeviation,
  onTrainRememberedDeviation,
  onReviewDeviation,
}: OpeningMemoryPanelProps) {
  const stats = repertoireStats(memory);
  const preference = recognition ? repertoireChoiceForFen(memory, recognition.explorerFen) : null;
  const deviationMemory = deviationMemoryForRecognition(memory, recognition);
  const assessment = recognition
    ? assessOpeningDeviation(recognition, preference, deviationMemory, deviationReview)
    : null;
  const repeated = sortedDeviationMemories(memory)
    .filter((entry) => entry.occurrences > 1)
    .slice(0, 3);

  return (
    <section className="panel opening-memory-panel" id="coach-opening-memory">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">Opening coach</span>
          <h2>My repertoire</h2>
        </div>
        <span className="repertoire-position-count">{stats.positions} saved</span>
      </div>

      <div className="repertoire-stats">
        <div><span>White</span><strong>{stats.whiteMoves}</strong></div>
        <div><span>Black</span><strong>{stats.blackMoves}</strong></div>
        <div><span>Deviations</span><strong>{stats.deviations}</strong></div>
        <div><span>Repeated</span><strong>{stats.repeatedDeviations}</strong></div>
      </div>

      {recognition ? (
        <>
          <div className="repertoire-current">
            <span>At this book position</span>
            {preference ? (
              <>
                <div className="repertoire-choice-row">
                  <div>
                    <strong>{preference.moveSan}</strong>
                    <small>{preference.source === 'book' ? 'Saved from local book' : 'Personal move'} · {preference.sideToMove === 'w' ? 'White' : 'Black'} to move</small>
                  </div>
                  <div className="repertoire-choice-actions">
                    <button type="button" onClick={onTrainCurrentRepertoire} disabled={disabled}>Train</button>
                    <button type="button" onClick={onForgetCurrent} disabled={disabled}>Forget</button>
                  </div>
                </div>
                <div className="repertoire-practice">
                  <span>Recall practice</span>
                  <strong>{preference.practiceSuccesses}/{preference.practiceAttempts}</strong>
                </div>
              </>
            ) : (
              <div className="repertoire-empty-choice">
                <p>No preferred move saved here yet.</p>
                <button
                  type="button"
                  onClick={onSaveTopBookMove}
                  disabled={disabled || recognition.alternatives.length === 0}
                >
                  ☆ Save top local move
                </button>
              </div>
            )}
          </div>

          {assessment && recognition.deviation && (
            <div className={`opening-mistake-assessment tone-${assessment.tone}`}>
              <div className="opening-assessment-heading">
                <span>{assessment.title}</span>
                {deviationMemory && <strong>seen {deviationMemory.occurrences}×</strong>}
              </div>
              <p>{assessment.summary}</p>
              <div className="opening-assessment-actions">
                {!deviationReview && (
                  <button type="button" onClick={onReviewDeviation} disabled={disabled}>Review with Stockfish</button>
                )}
                <button
                  type="button"
                  onClick={onTrainCurrentDeviation}
                  disabled={disabled || recognition.alternatives.length === 0}
                >
                  Train this position
                </button>
                {(!preference || preference.moveUci !== recognition.deviation.uci) && (
                  <button type="button" onClick={onKeepPlayedMove} disabled={disabled}>
                    Keep {recognition.deviation.san} as repertoire
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="repertoire-memory-note">
          <strong>Repertoire memory stays available.</strong>
          <p>Custom FEN positions do not have ECO recognition, but saved opening choices from normal games remain stored locally.</p>
        </div>
      )}

      {repeated.length > 0 && (
        <div className="repeated-deviations">
          <div className="repeated-heading">
            <span>Repeated deviations</span>
            <small>Positions worth revisiting</small>
          </div>
          <div className="repeated-deviation-list">
            {repeated.map((entry) => (
              <div key={entry.key} className="repeated-deviation-row">
                <div>
                  <strong>{entry.moveSan} · {openingName(entry)}</strong>
                  <span>{entry.side} · seen {entry.occurrences}×{entry.lastVerdict ? ` · last ${entry.lastVerdict}` : ''}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onTrainRememberedDeviation?.(entry)}
                  disabled={disabled || entry.alternatives.length === 0}
                >
                  Train
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="repertoire-local-note">
        Repertoire choices and deviation counts are saved only in this app’s local browser storage.
      </p>
    </section>
  );
}
