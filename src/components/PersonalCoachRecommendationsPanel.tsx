import { useMemo, useState } from 'react';
import type { GameLibraryEntry, GameLibraryMemory } from '../lib/gameLibrary';
import { buildGameAnalyticsDrilldown } from '../lib/gameAnalytics';
import {
  buildPersonalCoachRecommendations,
  type PersonalCoachRecommendation,
} from '../lib/personalCoachRecommendations';

interface PersonalCoachRecommendationsPanelProps {
  memory: GameLibraryMemory;
  disabled?: boolean;
  onOpenMove(entry: GameLibraryEntry, ply: number): void;
  onTrain(recommendation: PersonalCoachRecommendation): void;
}

function phaseMoveLabel(ply: number, san: string): string {
  const moveNumber = Math.ceil(ply / 2);
  return `${ply % 2 === 1 ? `${moveNumber}.` : `${moveNumber}...`}${san}`;
}

export function PersonalCoachRecommendationsPanel({
  memory,
  disabled = false,
  onOpenMove,
  onTrain,
}: PersonalCoachRecommendationsPanelProps) {
  const [windowSize, setWindowSize] = useState<10 | 20 | 50>(20);
  const [whyId, setWhyId] = useState<string | null>(null);
  const [evidenceId, setEvidenceId] = useState<string | null>(null);
  const recommendations = useMemo(
    () => buildPersonalCoachRecommendations(memory, windowSize, 5),
    [memory, windowSize],
  );

  const evidenceRecommendation = recommendations.find((item) => item.id === evidenceId) ?? null;
  const evidence = useMemo(
    () => evidenceRecommendation
      ? buildGameAnalyticsDrilldown(memory, windowSize, evidenceRecommendation.evidenceRequest)
      : null,
    [memory, windowSize, evidenceRecommendation],
  );

  return (
    <section className="panel personal-coach-recommendations" id="coach-recommendations">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">Game-history coach</span>
          <h2>Ranked recommendations</h2>
        </div>
        <span className="coach-recommendation-count">{recommendations.length} actions</span>
      </div>

      <div className="coach-recommendation-window" aria-label="Recommendation game window">
        {([10, 20, 50] as const).map((size) => (
          <button
            type="button"
            key={size}
            className={windowSize === size ? 'active' : ''}
            aria-pressed={windowSize === size}
            onClick={() => { setWindowSize(size); setEvidenceId(null); setWhyId(null); }}
          >
            Last {size}
          </button>
        ))}
      </div>

      {recommendations.length === 0 ? (
        <div className="coach-recommendation-empty">
          <strong>Not enough repeated game-history evidence yet.</strong>
          <p>Review a few more saved games. The coach waits for repeated CPL, blunder, phase, color, or opening patterns rather than manufacturing a recommendation from one isolated position.</p>
        </div>
      ) : (
        <div className="coach-recommendation-list">
          {recommendations.map((recommendation) => {
            const trainable = recommendation.trainingCount;
            const whyOpen = whyId === recommendation.id;
            const evidenceOpen = evidenceId === recommendation.id;
            return (
              <article key={recommendation.id} className={`coach-recommendation-card priority-${recommendation.priority}`}>
                <div className="coach-recommendation-rank">#{recommendation.rank}</div>
                <div className="coach-recommendation-main">
                  <div className="coach-recommendation-heading">
                    <div>
                      <span>{recommendation.priority} priority</span>
                      <strong>{recommendation.title}</strong>
                    </div>
                    <b>{trainable} positions</b>
                  </div>
                  <p>{recommendation.summary}</p>
                  <small>{recommendation.action}</small>

                  <div className="coach-recommendation-actions">
                    <button type="button" onClick={() => setWhyId(whyOpen ? null : recommendation.id)}>
                      {whyOpen ? 'Hide why' : 'Why?'}
                    </button>
                    <button type="button" onClick={() => setEvidenceId(evidenceOpen ? null : recommendation.id)}>
                      {evidenceOpen ? 'Hide evidence' : 'Show evidence'}
                    </button>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => onTrain(recommendation)}
                      disabled={disabled || trainable === 0}
                    >
                      Train now
                    </button>
                  </div>

                  {whyOpen && (
                    <div className="coach-recommendation-why">
                      {recommendation.why.map((reason) => <p key={reason}>{reason}</p>)}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {evidenceRecommendation && evidence && (
        <div className="coach-recommendation-evidence">
          <div className="coach-recommendation-evidence-heading">
            <div>
              <span>Evidence · {evidenceRecommendation.title}</span>
              <strong>{evidence.reviewedMoves} matching moves across {evidence.games} games</strong>
            </div>
            <button type="button" onClick={() => setEvidenceId(null)}>Close</button>
          </div>
          <div className="coach-recommendation-evidence-list">
            {evidence.movesList.slice(0, 8).map((move) => {
              const entry = memory.entries.find((item) => item.id === move.gameId);
              if (!entry) return null;
              return (
                <article key={`${move.gameId}:${move.ply}`}>
                  <div>
                    <span>{entry.white} – {entry.black} · {entry.result}</span>
                    <strong>{phaseMoveLabel(move.ply, move.san)} · {move.verdict} · {Math.round(move.cpl)} cp</strong>
                    <small>{move.openingEco ?? '—'} {move.openingLabel}</small>
                  </div>
                  <button type="button" onClick={() => onOpenMove(entry, move.ply)} disabled={disabled}>Open move</button>
                </article>
              );
            })}
          </div>
          {evidence.movesList.length > 8 && <small className="coach-recommendation-more">Showing the 8 highest-cost matching moves; Analytics → Games retains the complete drill-down.</small>}
        </div>
      )}

      <p className="coach-recommendation-note">Recommendations are deterministic coaching priorities derived from saved reviewed games. They do not change Stockfish verdicts, and model/archived games remain excluded from personal performance statistics.</p>
    </section>
  );
}
