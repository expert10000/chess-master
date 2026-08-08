import { useState } from 'react';
import type { CoachAnswer, CoachQuestion, ConversationAnswer, MoveReview } from '../lib/chessCoach';
import type { AnalyseResult } from '../types/engine';
import type { OllamaStatus } from '../types/ollama';
import { formatEvaluation, uciLineToSan } from '../lib/chessCoach';
import { analyzePositionConcepts, type ChessConcept } from '../lib/chessConcepts';
import type { BoardIdeaExplanation } from '../lib/boardIdeas';

interface CoachPanelProps {
  review: MoveReview | null;
  loading: boolean;
  error: string | null;
  currentAnalysis: AnalyseResult | null;
  currentFen: string;
  coachAnswer?: CoachAnswer | null;
  alternativeReview?: MoveReview | null;
  trainerLoading?: boolean;
  trainerError?: string | null;
  onAsk?(question: CoachQuestion): void;
  onCompareAlternative?(move: string): void;
  chatTurns?: Array<{ id: number; question: string; answer: ConversationAnswer | null; error: string | null }>;
  chatLoading?: boolean;
  onChatSubmit?(question: string): void;
  ollamaStatus?: OllamaStatus | null;
  ollamaEnabled?: boolean;
  ollamaModel?: string;
  ollamaChecking?: boolean;
  onOllamaToggle?(enabled: boolean): void;
  onOllamaModelChange?(model: string): void;
  onRefreshOllama?(): void;
  onPlayLine?(fen: string, uciLine: string[], label: string): void;
  boardIdeaExplanation?: BoardIdeaExplanation | null;
  onClearBoardIdea?(): void;
  onAskBoardIdea?(question: string): void;
}

function ConceptStrip({ concepts }: { concepts: ChessConcept[] }) {
  if (!concepts.length) return null;
  return (
    <div className="concept-strip" aria-label="Detected chess concepts">
      {concepts.slice(0, 8).map((concept) => (
        <span
          className={`concept-chip concept-${concept.category}`}
          title={`${concept.detail} · ${concept.confidence} confidence`}
          key={concept.id}
        >
          {concept.label}
        </span>
      ))}
    </div>
  );
}

export function CoachPanel({
  review,
  loading,
  error,
  currentAnalysis,
  currentFen,
  coachAnswer = null,
  alternativeReview = null,
  trainerLoading = false,
  trainerError = null,
  onAsk,
  onCompareAlternative,
  chatTurns = [],
  chatLoading = false,
  onChatSubmit,
  ollamaStatus = null,
  ollamaEnabled = false,
  ollamaModel = '',
  ollamaChecking = false,
  onOllamaToggle,
  onOllamaModelChange,
  onRefreshOllama,
  onPlayLine,
  boardIdeaExplanation = null,
  onClearBoardIdea,
  onAskBoardIdea,
}: CoachPanelProps) {
  const [alternativeMove, setAlternativeMove] = useState('');
  const [chatQuestion, setChatQuestion] = useState('');
  const positionConcepts = currentFen ? analyzePositionConcepts(currentFen) : [];

  const boardExplanationCard = boardIdeaExplanation ? (
    <div className={`board-explanation-card explanation-${boardIdeaExplanation.category}`} aria-live="polite">
      <div className="board-explanation-heading">
        <div>
          <span>Board explanation</span>
          <strong>{boardIdeaExplanation.title}</strong>
        </div>
        <button type="button" onClick={() => onClearBoardIdea?.()} aria-label="Close board explanation">×</button>
      </div>
      <p>{boardIdeaExplanation.text}</p>
      {boardIdeaExplanation.bullets.length > 0 && (
        <ul>{boardIdeaExplanation.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
      )}
      <button
        type="button"
        className="board-explanation-ask"
        onClick={() => onAskBoardIdea?.(boardIdeaExplanation.suggestedQuestion)}
        disabled={chatLoading}
      >
        {chatLoading ? 'Coach is busy…' : 'Ask conversational coach about this'}
      </button>
    </div>
  ) : null;

  const conversationCoach = (
    <div className="conversation-coach">
      <div className="conversation-heading">
        <div>
          <span>Conversational coach</span>
          <strong>Ask in normal language</strong>
        </div>
        <small>{ollamaEnabled ? `Local · Stockfish + ${ollamaModel || 'Ollama'}` : 'Local · Stockfish-grounded · deterministic prose'}</small>
      </div>

      <div className="ollama-control" aria-label="Local Ollama explanation mode">
        <div className="ollama-status-copy">
          <span className={`ollama-dot ${ollamaStatus?.available ? 'online' : ''}`} />
          <div>
            <strong>{ollamaStatus?.available ? 'Ollama detected' : 'Ollama optional'}</strong>
            <small>
              {ollamaChecking
                ? 'Checking localhost:11434…'
                : ollamaStatus?.available
                  ? ollamaStatus.models.length
                    ? `${ollamaStatus.models.length} local model${ollamaStatus.models.length === 1 ? '' : 's'} available. GPU not required.`
                    : 'Ollama is running, but no local models were found.'
                  : 'Rules mode works without Ollama. Start Ollama locally for more natural wording.'}
            </small>
          </div>
        </div>
        <div className="ollama-actions">
          <label className="ollama-toggle">
            <input
              type="checkbox"
              checked={ollamaEnabled}
              disabled={!ollamaStatus?.available || ollamaStatus.models.length === 0 || ollamaChecking}
              onChange={(event) => onOllamaToggle?.(event.target.checked)}
            />
            <span>Use Ollama</span>
          </label>
          <select
            value={ollamaModel}
            disabled={!ollamaStatus?.available || ollamaStatus.models.length === 0 || ollamaChecking}
            onChange={(event) => onOllamaModelChange?.(event.target.value)}
            aria-label="Ollama model"
          >
            {ollamaStatus?.models.length ? ollamaStatus.models.map((model) => <option value={model} key={model}>{model}</option>) : <option value="">No models</option>}
          </select>
          <button type="button" onClick={() => onRefreshOllama?.()} disabled={ollamaChecking}>{ollamaChecking ? 'Checking…' : 'Refresh'}</button>
        </div>
        {ollamaStatus?.error && <small className="ollama-error">{ollamaStatus.error}</small>}
      </div>

      <div className="conversation-suggestions" aria-label="Example coach questions">
        {['What is the plan?', 'What tactical motifs are here?', 'What pawn weaknesses are here?', 'Why is the best move stronger?'].map((question) => (
          <button type="button" key={question} disabled={chatLoading} onClick={() => onChatSubmit?.(question)}>{question}</button>
        ))}
      </div>

      {chatTurns.length > 0 && (
        <div className="conversation-thread" aria-live="polite">
          {chatTurns.slice(-6).map((turn) => (
            <div className="conversation-turn" key={turn.id}>
              <div className="conversation-question"><span>You</span><p>{turn.question}</p></div>
              {turn.answer && (
                <div className="conversation-answer">
                  <span>Coach</span>
                  <strong>{turn.answer.title}</strong>
                  <p>{turn.answer.text}</p>
                  <ConceptStrip concepts={turn.answer.concepts ?? []} />
                  {turn.answer.bullets.length > 0 && <ul>{turn.answer.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>}
                  {turn.answer.lineSan.length > 0 && <code>{turn.answer.lineSan.join(' ')}</code>}
                  <small>{turn.answer.confidenceNote}</small>
                </div>
              )}
              {turn.error && <div className="conversation-error">Coach: {turn.error}</div>}
              {!turn.answer && !turn.error && <div className="conversation-pending"><span className="mini-spinner" />Checking engine evidence…</div>}
            </div>
          ))}
        </div>
      )}

      <form
        className="conversation-form"
        onSubmit={(event) => {
          event.preventDefault();
          const question = chatQuestion.trim();
          if (!question || chatLoading) return;
          onChatSubmit?.(question);
          setChatQuestion('');
        }}
      >
        <input
          value={chatQuestion}
          onChange={(event) => setChatQuestion(event.target.value)}
          placeholder="e.g. Why can't I play Nf3?"
          disabled={chatLoading}
          aria-label="Ask the chess coach"
        />
        <button type="submit" disabled={chatLoading || !chatQuestion.trim()}>{chatLoading ? 'Thinking…' : 'Ask'}</button>
      </form>
      <p className="conversation-help">Try SAN/UCI moves too: “What if Nf3?”, “Why not g1f3?”, “What happens after Qh4?” — or ask about forks, pins, outposts, open files, pawn weaknesses, material, development, and king safety.</p>
    </div>
  );

  if (loading) {
    return (
      <section className="panel coach-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Local coach</span>
            <h2>Stockfish is comparing moves…</h2>
          </div>
          <span className="spinner" aria-label="Loading" />
        </div>
        <div className="analysis-skeleton" />
        <div className="analysis-skeleton short" />
      </section>
    );
  }

  if (error) {
    return (
      <section className="panel coach-panel">
        <span className="eyebrow">Local coach</span>
        <h2>Analysis could not finish</h2>
        <p className="error-text">{error}</p>
      </section>
    );
  }

  if (review) {
    return (
      <section className="panel coach-panel">
        <div className="panel-heading">
          <div>
            <span className="eyebrow">Why this move?</span>
            <h2>{review.title}</h2>
          </div>
          <span className={`verdict verdict-${review.verdict.toLowerCase()}`}>{review.verdict}</span>
        </div>

        {boardExplanationCard}

        <p className="coach-summary">{review.summary}</p>
        <ConceptStrip concepts={review.concepts} />

        <div className="evaluation-comparison">
          <div>
            <span>Best play</span>
            <strong>{review.bestEvaluation}</strong>
          </div>
          <div>
            <span>Played move</span>
            <strong>{review.playedEvaluation}</strong>
          </div>
          <div>
            <span>Loss</span>
            <strong>{(review.centipawnLoss / 100).toFixed(2)}</strong>
          </div>
        </div>

        <ul className="reason-list">
          {review.reasons.map((reason) => <li key={reason}>{reason}</li>)}
        </ul>

        <div className="coach-question-grid" aria-label="Ask the coach">
          <button type="button" onClick={() => onAsk?.('why-move')}>Why this move?</button>
          <button type="button" onClick={() => onAsk?.('why-best')} disabled={!review.bestMoveSan}>Why is best stronger?</button>
          <button type="button" onClick={() => onAsk?.('what-threat')}>What is the threat?</button>
          <button type="button" onClick={() => onAsk?.('show-line')}>Show calculation</button>
        </div>

        {coachAnswer && (
          <div className="coach-answer-box">
            <span>Coach answer</span>
            <strong>{coachAnswer.title}</strong>
            <p>{coachAnswer.text}</p>
            <ConceptStrip concepts={coachAnswer.concepts ?? []} />
            {coachAnswer.bullets.length > 0 && (
              <ul>{coachAnswer.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul>
            )}
            {coachAnswer.lineSan.length > 0 && <code>{coachAnswer.lineSan.join(' ')}</code>}
          </div>
        )}

        <div className="why-not-box">
          <div>
            <span>Why not another move?</span>
            <small>Enter SAN or UCI, for example Nf3 or g1f3.</small>
          </div>
          <form
            className="why-not-form"
            onSubmit={(event) => {
              event.preventDefault();
              if (alternativeMove.trim()) onCompareAlternative?.(alternativeMove.trim());
            }}
          >
            <input
              value={alternativeMove}
              onChange={(event) => setAlternativeMove(event.target.value)}
              placeholder="e.g. Nf3"
              aria-label="Alternative move"
              disabled={trainerLoading}
            />
            <button type="submit" disabled={trainerLoading || !alternativeMove.trim()}>
              {trainerLoading ? 'Comparing…' : 'Compare'}
            </button>
          </form>
          {trainerError && <p className="trainer-error">{trainerError}</p>}
        </div>

        {alternativeReview && (
          <div className="alternative-review-box">
            <div className="alternative-review-heading">
              <div>
                <span>Alternative move</span>
                <strong>{alternativeReview.title}</strong>
              </div>
              <span className={`verdict verdict-${alternativeReview.verdict.toLowerCase()}`}>{alternativeReview.verdict}</span>
            </div>
            <p>{alternativeReview.summary}</p>
            <ConceptStrip concepts={alternativeReview.concepts} />
            <div className="alternative-metrics">
              <span>Eval <strong>{alternativeReview.playedEvaluation}</strong></span>
              <span>Loss <strong>{(alternativeReview.centipawnLoss / 100).toFixed(2)}</strong></span>
              {alternativeReview.bestMoveSan && <span>Best <strong>{alternativeReview.bestMoveSan}</strong></span>}
            </div>
            {alternativeReview.bestLineSan.length > 0 && (
              <div className="variation-heading-row">
                <code>{alternativeReview.bestLineSan.join(' ')}</code>
                {alternativeReview.bestLineUci?.length ? (
                  <button
                    type="button"
                    className="play-line-button"
                    onClick={() => onPlayLine?.(alternativeReview.beforeFen, alternativeReview.bestLineUci ?? [], 'Alternative best line')}
                  >▶ Play</button>
                ) : null}
              </div>
            )}
          </div>
        )}

        {review.bestLineSan.length > 0 && (
          <div className="variation-box">
            <div className="variation-heading-row">
              <span>Best line</span>
              {review.bestLineUci?.length ? (
                <button
                  type="button"
                  className="play-line-button"
                  onClick={() => onPlayLine?.(review.beforeFen, review.bestLineUci ?? [], 'Best line')}
                >▶ Play line</button>
              ) : null}
            </div>
            <code>{review.bestLineSan.join(' ')}</code>
          </div>
        )}
        {review.playedLineSan.length > 0 && (
          <div className="variation-box muted">
            <div className="variation-heading-row">
              <span>After the played move</span>
              {review.playedLineUci?.length ? (
                <button
                  type="button"
                  className="play-line-button"
                  onClick={() => onPlayLine?.(review.beforeFen, review.playedLineUci ?? [], 'Played-move line')}
                >▶ Play line</button>
              ) : null}
            </div>
            <code>{review.playedLineSan.join(' ')}</code>
          </div>
        )}

        {conversationCoach}
      </section>
    );
  }

  if (currentAnalysis?.lines.length) {
    return (
      <section className="panel coach-panel">
        <span className="eyebrow">Position analysis</span>
        <h2>Candidate moves</h2>
        {boardExplanationCard}
        <ConceptStrip concepts={positionConcepts} />
        <div className="candidate-list">
          {currentAnalysis.lines.map((line) => {
            const san = uciLineToSan(currentFen, line.pv, 7);
            return (
              <div className="candidate" key={line.multipv}>
                <div className="candidate-heading-row">
                  <strong>{line.pv[0] ? san[0] ?? line.pv[0] : '—'}</strong>
                  {line.pv.length > 0 && (
                    <button type="button" onClick={() => onPlayLine?.(currentFen, line.pv, `Candidate ${line.multipv}`)}>▶ Play</button>
                  )}
                </div>
                <span>{formatEvaluation(line)}</span>
                <code>{san.join(' ')}</code>
              </div>
            );
          })}
        </div>
        {conversationCoach}
      </section>
    );
  }

  return (
    <section className="panel coach-panel">
      <span className="eyebrow">Local coach</span>
      <h2>Play a move or select one from history</h2>
      {boardExplanationCard}
      <p className="coach-summary">
        The app compares the move with Stockfish’s best continuation, measures the evaluation loss,
        and lets you ask why the move worked, why the best move is stronger, what the concrete idea is,
        or compare a move you are considering.
      </p>
      {conversationCoach}
    </section>
  );
}
