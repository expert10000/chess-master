import { useMemo, useState } from 'react';
import type { GameLibraryMemory } from '../lib/gameLibrary';
import {
  buildInterventionHistoryAnalytics,
  type InterventionHistoryRecord,
} from '../lib/interventionHistoryAnalytics';
import type { RecommendationOutcomeMemory } from '../lib/recommendationOutcomes';

interface InterventionHistoryAnalyticsPanelProps {
  outcomeMemory: RecommendationOutcomeMemory;
  gameLibrary: GameLibraryMemory;
}

function value(value: number | null, digits = 0, suffix = ''): string {
  if (value === null) return '—';
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}${suffix}`;
}

function percent(value: number | null): string {
  return value === null ? '—' : `${Math.round(value * 100)}%`;
}

function outcomeClass(verdict: InterventionHistoryRecord['verdict']): string {
  return `outcome-${verdict}`;
}

export function InterventionHistoryAnalyticsPanel({
  outcomeMemory,
  gameLibrary,
}: InterventionHistoryAnalyticsPanelProps) {
  const [showHistory, setShowHistory] = useState(false);
  const analytics = useMemo(
    () => buildInterventionHistoryAnalytics(outcomeMemory, gameLibrary),
    [outcomeMemory, gameLibrary],
  );

  return (
    <section className="panel intervention-history-panel" id="coach-intervention-history">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">What actually works for you?</span>
          <h2>Intervention history analytics</h2>
        </div>
        <span className="intervention-history-count">{analytics.measuredInterventions} measured</span>
      </div>

      {analytics.measuredInterventions === 0 ? (
        <div className="intervention-history-empty">
          <strong>No measured interventions yet.</strong>
          <p>Complete recommendation training and collect at least a 10-game outcome. After several interventions, this panel ranks which training types have produced the strongest measured improvement for you.</p>
        </div>
      ) : (
        <>
          {analytics.bestType && (
            <div className="intervention-best-callout">
              <div>
                <span>Best measured training type</span>
                <strong>#{analytics.bestType.rank} · {analytics.bestType.label}</strong>
              </div>
              <div>
                <span>Avg CPL improvement</span>
                <strong>{value(analytics.bestType.avgCplImprovement, 0, ' cp')}</strong>
              </div>
              <div>
                <span>Avg blunder reduction</span>
                <strong>{value(analytics.bestType.avgBlunderReduction, 2, '/game')}</strong>
              </div>
              <small className={`confidence-${analytics.bestType.confidence}`}>
                {analytics.bestType.confidence} evidence · {analytics.bestType.interventions} intervention{analytics.bestType.interventions === 1 ? '' : 's'}
              </small>
            </div>
          )}

          <div className="intervention-ranking-list">
            {analytics.rows.map((row) => (
              <article key={row.trainingType} className="intervention-ranking-card">
                <div className="intervention-ranking-heading">
                  <span>#{row.rank}</span>
                  <div>
                    <strong>{row.label}</strong>
                    <small>{row.interventions} measured · {row.twentyGameOutcomes} at 20 games · {row.tenGameCheckpoints} at 10 games</small>
                  </div>
                  <span className={`intervention-confidence confidence-${row.confidence}`}>{row.confidence}</span>
                </div>

                <div className="intervention-ranking-metrics">
                  <div><span>Avg CPL improvement</span><strong>{value(row.avgCplImprovement, 0, ' cp')}</strong></div>
                  <div><span>Blunders reduced</span><strong>{value(row.avgBlunderReduction, 2, '/game')}</strong></div>
                  <div><span>Issues reduced</span><strong>{value(row.avgIssueReduction, 2, '/game')}</strong></div>
                  <div><span>Improved outcomes</span><strong>{percent(row.improvedRate)}</strong></div>
                  <div><span>Training solve rate</span><strong>{percent(row.avgSolveRate)}</strong></div>
                </div>

                <div className="intervention-outcome-mix" aria-label={`${row.label} outcome counts`}>
                  <span className="outcome-improved">Improved {row.improved}</span>
                  <span className="outcome-mixed">Mixed {row.mixed}</span>
                  <span className="outcome-stable">Stable {row.stable}</span>
                  <span className="outcome-worse">Worse {row.worse}</span>
                </div>
              </article>
            ))}
          </div>

          <div className="intervention-history-actions">
            <button type="button" onClick={() => setShowHistory((value) => !value)}>
              {showHistory ? 'Hide intervention history' : 'Show intervention history'}
            </button>
            {analytics.collectingInterventions > 0 && (
              <span>{analytics.collectingInterventions} intervention{analytics.collectingInterventions === 1 ? '' : 's'} still collecting 10-game evidence</span>
            )}
          </div>

          {showHistory && (
            <div className="intervention-history-list">
              {analytics.history.map((record) => (
                <article key={record.interventionId}>
                  <div>
                    <span>{new Date(record.completedAt).toLocaleDateString()} · {record.trainingTypeLabel}</span>
                    <strong>{record.title}</strong>
                  </div>
                  <span className={`intervention-history-verdict ${outcomeClass(record.verdict)}`}>{record.verdict}</span>
                  <div><span>{record.checkpointGames}-game CPL</span><strong>{value(record.cplImprovement, 0, ' cp')}</strong></div>
                  <div><span>Blunders</span><strong>{value(record.blunderReduction, 2, '/game')}</strong></div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      <p className="intervention-history-note">
        Ranking is intentionally transparent: average CPL improvement is the primary ordering, then average blunder reduction, improved-outcome rate, and sample count. Fewer than three measured interventions is marked provisional; this is personal observational evidence, not a statistical causal claim.
      </p>
    </section>
  );
}
