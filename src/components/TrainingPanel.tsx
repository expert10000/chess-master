import type { TrainingAttempt, TrainingExercise, TrainingSource } from '../lib/training';
import { buildTrainingHints, exerciseTitle } from '../lib/training';

interface TrainingPanelProps {
  source: TrainingSource;
  mistakeCount: number;
  reviewedCount: number;
  exercise: TrainingExercise | null;
  exerciseIndex: number;
  exerciseCount: number;
  hintLevel: number;
  attempt: TrainingAttempt | null;
  loading: boolean;
  sessionAttempts: number;
  sessionSolved: number;
  sessionScore: number;
  onSourceChange(source: TrainingSource): void;
  onHint(): void;
  onShowAnswer(): void;
  onRetry(): void;
  onPrevious(): void;
  onNext(): void;
}

function verdictClass(verdict: string): string {
  return `training-verdict verdict-${verdict.toLowerCase()}`;
}

export function TrainingPanel({
  source,
  mistakeCount,
  reviewedCount,
  exercise,
  exerciseIndex,
  exerciseCount,
  hintLevel,
  attempt,
  loading,
  sessionAttempts,
  sessionSolved,
  sessionScore,
  onSourceChange,
  onHint,
  onShowAnswer,
  onRetry,
  onPrevious,
  onNext,
}: TrainingPanelProps) {
  const hints = exercise ? buildTrainingHints(exercise) : [];

  return (
    <section className="panel training-panel">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">Training</span>
          <h2>Find the best move</h2>
        </div>
        <span className="training-position-count">{exerciseCount ? `${exerciseIndex + 1}/${exerciseCount}` : '0/0'}</span>
      </div>

      <div className="training-source-row">
        <label>
          Exercise source
          <select value={source} onChange={(event) => onSourceChange(event.target.value as TrainingSource)} disabled={loading}>
            <option value="mistakes">My mistakes ({mistakeCount})</option>
            <option value="reviewed">All reviewed moves ({reviewedCount})</option>
          </select>
        </label>
      </div>

      {!exercise ? (
        <div className="training-empty">
          <strong>No training positions yet.</strong>
          <p>
            {source === 'mistakes'
              ? 'Play and review a game first. Inaccuracies, mistakes and blunders will automatically become exercises.'
              : 'Review moves in Play & Coach first, then return here.'}
          </p>
        </div>
      ) : (
        <>
          <div className="training-exercise-card">
            <span>{exerciseTitle(exercise)}</span>
            <strong>Find a stronger move.</strong>
            <p>Your original move was <b>{exercise.originalMoveSan}</b> — {exercise.originalVerdict} ({(exercise.originalLoss / 100).toFixed(2)} pawn loss).</p>
          </div>

          <div className="training-instruction">
            {loading ? <><span className="mini-spinner" aria-hidden="true" /> Stockfish is checking your attempt…</> : attempt ? 'Attempt evaluated.' : 'Play your answer directly on the board.'}
          </div>

          {hintLevel > 0 && (
            <div className="training-hints">
              {hints.slice(0, hintLevel).map((hint, index) => (
                <div key={hint} className={index === 3 ? 'training-answer-hint' : ''}>
                  <span>{index === 3 ? 'Answer' : `Hint ${index + 1}`}</span>
                  <p>{hint}</p>
                </div>
              ))}
            </div>
          )}

          {!attempt && (
            <div className="training-actions">
              <button type="button" onClick={onHint} disabled={loading || hintLevel >= 3}>Hint</button>
              <button type="button" onClick={onShowAnswer} disabled={loading || hintLevel >= 4}>Show answer</button>
            </div>
          )}

          {attempt && (
            <div className="training-result">
              <div className="training-result-heading">
                <div>
                  <span>Your move</span>
                  <strong>{attempt.san}</strong>
                </div>
                <span className={verdictClass(attempt.review.verdict)}>{attempt.review.verdict}</span>
              </div>
              <div className="training-score-line">
                <strong>{attempt.points} pts</strong>
                <span>{attempt.review.centipawnLoss} cp loss</span>
              </div>
              <p>{attempt.review.summary}</p>
              <ul>
                {attempt.review.reasons.slice(0, 4).map((reason) => <li key={reason}>{reason}</li>)}
              </ul>
              {attempt.review.bestMoveSan && (
                <div className="training-best-line">
                  <span>Best move</span>
                  <strong>{attempt.review.bestMoveSan}</strong>
                  {attempt.review.bestLineSan.length > 0 && <code>{attempt.review.bestLineSan.slice(0, 6).join(' ')}</code>}
                </div>
              )}
              <div className="training-actions">
                <button type="button" onClick={onRetry} disabled={loading}>Try again</button>
                <button type="button" className="primary-button" onClick={onNext} disabled={loading || exerciseCount < 2}>Next exercise</button>
              </div>
            </div>
          )}

          <div className="training-navigation">
            <button type="button" onClick={onPrevious} disabled={loading || exerciseCount < 2}>‹ Previous</button>
            <button type="button" onClick={onNext} disabled={loading || exerciseCount < 2}>Next ›</button>
          </div>
        </>
      )}

      <div className="training-session-stats">
        <div><span>Attempts</span><strong>{sessionAttempts}</strong></div>
        <div><span>Solved</span><strong>{sessionSolved}</strong></div>
        <div><span>Score</span><strong>{sessionScore}</strong></div>
      </div>
    </section>
  );
}
