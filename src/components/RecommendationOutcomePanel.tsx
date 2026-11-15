import { useMemo, useState } from 'react';
import type { GameLibraryEntry, GameLibraryMemory } from '../lib/gameLibrary';
import {
  recommendationOutcomeEvaluations,
  type RecommendationOutcomeMemory,
  type RecommendationOutcomeCheckpoint,
  type RecommendationOutcomeVerdict,
} from '../lib/recommendationOutcomes';

interface RecommendationOutcomePanelProps {
  memory: RecommendationOutcomeMemory;
  gameLibrary: GameLibraryMemory;
  disabled?: boolean;
  onOpenMove(entry: GameLibraryEntry, ply: number): void;
  onForget(interventionId: string): void;
}

function metric(value: number | null, suffix = ''): string {
  return value === null ? '—' : `${value.toFixed(suffix ? 0 : 2)}${suffix}`;
}

function cpl(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)} cp`;
}

function deltaText(value: number | null, digits = 0, suffix = ''): string {
  if (value === null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}${suffix}`;
}

function verdictLabel(verdict: RecommendationOutcomeVerdict): string {
  if (verdict === 'improved') return 'Improved';
  if (verdict === 'worse') return 'Worse';
  if (verdict === 'mixed') return 'Mixed';
  if (verdict === 'stable') return 'Stable';
  return 'Collecting';
}

function checkpointStatus(checkpoint: RecommendationOutcomeCheckpoint): string {
  if (checkpoint.verdict === 'collecting') return `${checkpoint.games}/${checkpoint.targetGames} games`;
  return verdictLabel(checkpoint.verdict);
}

function moveLabel(ply: number, san: string): string {
  const moveNumber = Math.ceil(ply / 2);
  return `${ply % 2 === 1 ? `${moveNumber}.` : `${moveNumber}...`}${san}`;
}

export function RecommendationOutcomePanel({
  memory,
  gameLibrary,
  disabled = false,
  onOpenMove,
  onForget,
}: RecommendationOutcomePanelProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const evaluations = useMemo(
    () => recommendationOutcomeEvaluations(memory, gameLibrary),
    [memory, gameLibrary],
  );

  return (
    <section className="panel recommendation-outcome-panel" id="coach-recommendation-outcomes">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">Closed-loop coaching</span>
          <h2>Recommendation outcomes</h2>
        </div>
        <span className="recommendation-outcome-count">{evaluations.length} interventions</span>
      </div>

      {evaluations.length === 0 ? (
        <div className="recommendation-outcome-empty">
          <strong>No completed recommendation intervention yet.</strong>
          <p>Use Train now on a Game-history coach recommendation, finish that recommendation session, then the coach will compare its baseline with your next 10 and 20 reviewed games.</p>
        </div>
      ) : (
        <div className="recommendation-outcome-list">
          {evaluations.map((evaluation) => {
            const item = evaluation.intervention;
            const expanded = expandedId === item.id;
            return (
              <article key={item.id} className={`recommendation-outcome-card outcome-${evaluation.finalVerdict}`}>
                <div className="recommendation-outcome-heading">
                  <div>
                    <span>{new Date(item.completedAt).toLocaleDateString()} · {item.windowSize}-game baseline</span>
                    <strong>{item.title}</strong>
                  </div>
                  <span className={`recommendation-outcome-badge outcome-${evaluation.finalVerdict}`}>
                    {verdictLabel(evaluation.finalVerdict)}
                  </span>
                </div>

                <p>{evaluation.headline}</p>
                <small>{evaluation.explanation}</small>

                <div className="recommendation-training-completion">
                  <div><span>Planned</span><strong>{item.plannedPositions}</strong></div>
                  <div><span>Attempted</span><strong>{item.attemptedPositions}</strong></div>
                  <div><span>Solved</span><strong>{item.solvedPositions}</strong></div>
                </div>

                <div className="recommendation-outcome-metric-grid">
                  <div className="recommendation-baseline-cell">
                    <span>Baseline</span>
                    <strong>{cpl(item.baseline.avgCpl)}</strong>
                    <small>{metric(item.baseline.blundersPerGame)} blunders/game</small>
                  </div>
                  <div>
                    <span>Next 10</span>
                    <strong>{evaluation.next10.metrics.avgCpl === null ? checkpointStatus(evaluation.next10) : cpl(evaluation.next10.metrics.avgCpl)}</strong>
                    <small>
                      {evaluation.next10.verdict === 'collecting'
                        ? `${evaluation.next10.games}/10 games collected`
                        : `${deltaText(evaluation.next10.cplDelta, 0, ' cp')} · ${deltaText(evaluation.next10.blunderDelta, 2)} blunders/game`}
                    </small>
                  </div>
                  <div>
                    <span>Next 20</span>
                    <strong>{evaluation.next20.metrics.avgCpl === null ? checkpointStatus(evaluation.next20) : cpl(evaluation.next20.metrics.avgCpl)}</strong>
                    <small>
                      {evaluation.next20.verdict === 'collecting'
                        ? `${evaluation.next20.games}/20 games collected`
                        : `${deltaText(evaluation.next20.cplDelta, 0, ' cp')} · ${deltaText(evaluation.next20.blunderDelta, 2)} blunders/game`}
                    </small>
                  </div>
                </div>

                <div className="recommendation-outcome-actions">
                  <button type="button" onClick={() => setExpandedId(expanded ? null : item.id)}>
                    {expanded ? 'Hide details' : 'Show details'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (window.confirm(`Forget outcome tracking for “${item.title}”?`)) onForget(item.id);
                    }}
                    disabled={disabled}
                  >
                    Forget
                  </button>
                </div>

                {expanded && (
                  <div className="recommendation-outcome-details">
                    <div className="recommendation-outcome-comparison">
                      <div>
                        <span>Baseline CPL</span>
                        <strong>{cpl(item.baseline.avgCpl)}</strong>
                        <small>{item.baseline.games} scoped games · {item.baseline.reviewedMoves} moves</small>
                      </div>
                      <div>
                        <span>10-game Δ</span>
                        <strong>{deltaText(evaluation.next10.cplDelta, 0, ' cp')}</strong>
                        <small>{deltaText(evaluation.next10.blunderDelta, 2)} blunders/game</small>
                      </div>
                      <div>
                        <span>20-game Δ</span>
                        <strong>{deltaText(evaluation.next20.cplDelta, 0, ' cp')}</strong>
                        <small>{deltaText(evaluation.next20.blunderDelta, 2)} blunders/game</small>
                      </div>
                    </div>

                    {evaluation.evidenceMoves.length > 0 && (
                      <div className="recommendation-outcome-evidence">
                        <div>
                          <span>Post-training issues in measured games</span>
                          <strong>{evaluation.evidenceMoves.length} matching positions</strong>
                        </div>
                        {evaluation.evidenceMoves.slice(0, 6).map((move) => {
                          const entry = gameLibrary.entries.find((candidate) => candidate.id === move.gameId);
                          if (!entry) return null;
                          return (
                            <article key={`${move.gameId}:${move.ply}`}>
                              <div>
                                <span>{entry.white} – {entry.black}</span>
                                <strong>{moveLabel(move.ply, move.san)} · {move.verdict} · {Math.round(move.cpl)} cp</strong>
                              </div>
                              <button type="button" onClick={() => onOpenMove(entry, move.ply)} disabled={disabled}>Open move</button>
                            </article>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}

      <p className="recommendation-outcome-note">
        Outcome tracking is observational: it compares the targeted metrics before the intervention with the first 10 and first 20 newly reviewed personal games added afterward. It does not prove causation, but it tells you whether the measured chess result moved in the intended direction.
      </p>
    </section>
  );
}
