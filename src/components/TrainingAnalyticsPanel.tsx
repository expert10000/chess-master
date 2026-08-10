import {
  dailyPractice,
  forecastCount,
  openingAccuracy,
  recentTrainingSummary,
  retentionSummary,
  reviewLoadForecast,
  stableKnowledge,
  weaknessAccuracy,
  type DailyPractice,
  type TrainingAnalyticsMemory,
} from '../lib/trainingAnalytics';
import type { SpacedRepetitionMemory } from '../lib/spacedRepetition';

interface TrainingAnalyticsPanelProps {
  memory: TrainingAnalyticsMemory;
  spacedMemory: SpacedRepetitionMemory;
  now: number;
}

function accuracyText(value: number, attempts: number): string {
  return attempts ? `${Math.round(value * 100)}%` : '—';
}

function activityLevel(day: DailyPractice, maxAttempts: number): number {
  if (!day.attempts) return 0;
  const ratio = day.attempts / Math.max(1, maxAttempts);
  if (ratio >= 0.8) return 4;
  if (ratio >= 0.55) return 3;
  if (ratio >= 0.3) return 2;
  return 1;
}

function shortDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function TrainingAnalyticsPanel({
  memory,
  spacedMemory,
  now,
}: TrainingAnalyticsPanelProps) {
  const days = dailyPractice(memory, 56, now);
  const maxAttempts = Math.max(1, ...days.map((day) => day.attempts));
  const seven = recentTrainingSummary(memory, 7, now);
  const thirty = recentTrainingSummary(memory, 30, now);
  const weaknessRows = weaknessAccuracy(memory).slice(0, 5);
  const openingRows = openingAccuracy(memory).slice(0, 5);
  const forecast = reviewLoadForecast(spacedMemory, 30, now);
  const load7 = forecastCount(forecast, 7);
  const load30 = forecastCount(forecast, 30);
  const maxLoad = Math.max(1, ...forecast.slice(0, 14).map((day) => day.count));
  const retention = retentionSummary(spacedMemory, now);
  const stable = stableKnowledge(spacedMemory, now, 6);

  return (
    <section className="panel training-analytics-panel" id="coach-training-analytics">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">Training analytics</span>
          <h2>Practice & retention</h2>
        </div>
        <span className="analytics-event-count">{memory.events.length} attempts logged</span>
      </div>

      <div className="analytics-summary-grid">
        <div>
          <span>Last 7 days</span>
          <strong>{seven.attempts}</strong>
          <small>{accuracyText(seven.accuracy, seven.attempts)} · {seven.activeDays} active days</small>
        </div>
        <div>
          <span>Last 30 days</span>
          <strong>{thirty.attempts}</strong>
          <small>{accuracyText(thirty.accuracy, thirty.attempts)} · avg {thirty.averagePoints.toFixed(0)} pts</small>
        </div>
        <div>
          <span>Next 7 days</span>
          <strong>{load7}</strong>
          <small>currently scheduled reviews</small>
        </div>
        <div>
          <span>Next 30 days</span>
          <strong>{load30}</strong>
          <small>current review load</small>
        </div>
      </div>

      <div className="analytics-section">
        <div className="analytics-section-heading">
          <span>Practice heatmap</span>
          <small>last 8 weeks · darker = more attempts</small>
        </div>
        <div className="practice-heatmap" role="img" aria-label="Training activity for the last eight weeks">
          {days.map((day) => (
            <span
              key={day.dateKey}
              className={`practice-day level-${activityLevel(day, maxAttempts)} ${day.attempts && day.accuracy >= 0.8 ? 'high-accuracy' : ''}`}
              title={`${day.dateKey}: ${day.attempts} attempt${day.attempts === 1 ? '' : 's'}, ${accuracyText(day.accuracy, day.attempts)} correct`}
            />
          ))}
        </div>
        <div className="practice-heatmap-legend">
          <span>8 weeks ago</span>
          <span>today</span>
        </div>
      </div>

      <div className="analytics-section">
        <div className="analytics-section-heading">
          <span>Scheduled review load</span>
          <small>first 14 days shown · totals above cover 7/30 days</small>
        </div>
        <div className="review-load-chart">
          {forecast.slice(0, 14).map((day) => (
            <div key={day.dateKey} title={`${day.dateKey}: ${day.count} reviews (${day.repertoire} repertoire, ${day.weakness} weakness)`}>
              <span className="review-load-bar" style={{ height: `${day.count ? Math.max(8, day.count / maxLoad * 100) : 3}%` }} />
              <small>{new Date(day.timestamp).getDate()}</small>
            </div>
          ))}
        </div>
      </div>

      <div className="analytics-breakdowns">
        <div>
          <div className="analytics-section-heading">
            <span>Accuracy by weakness</span>
            <small>training attempts</small>
          </div>
          {weaknessRows.length ? (
            <div className="analytics-row-list">
              {weaknessRows.map((row) => (
                <div key={row.label}>
                  <span>{row.label}</span>
                  <strong>{accuracyText(row.accuracy, row.attempts)}</strong>
                  <small>{row.correct}/{row.attempts}</small>
                </div>
              ))}
            </div>
          ) : <p className="analytics-empty-copy">No weakness training attempts logged yet.</p>}
        </div>

        <div>
          <div className="analytics-section-heading">
            <span>Accuracy by opening</span>
            <small>opening/repertoire attempts</small>
          </div>
          {openingRows.length ? (
            <div className="analytics-row-list">
              {openingRows.map((row) => (
                <div key={row.label}>
                  <span>{row.label}</span>
                  <strong>{accuracyText(row.accuracy, row.attempts)}</strong>
                  <small>{row.correct}/{row.attempts}</small>
                </div>
              ))}
            </div>
          ) : <p className="analytics-empty-copy">No opening/repertoire attempts logged yet.</p>}
        </div>
      </div>

      <div className="analytics-section retention-section">
        <div className="analytics-section-heading">
          <span>Retention forecast</span>
          <small>scheduler-derived teaching estimate</small>
        </div>
        <div className="retention-summary-grid">
          <div><span>Estimated retention</span><strong>{retention.averageRetention ? `${Math.round(retention.averageRetention * 100)}%` : '—'}</strong></div>
          <div><span>Stable</span><strong>{retention.stable}</strong></div>
          <div><span>Growing</span><strong>{retention.growing}</strong></div>
          <div><span>Fragile</span><strong>{retention.fragile}</strong></div>
          <div><span>New</span><strong>{retention.newItems}</strong></div>
        </div>

        {stable.length > 0 ? (
          <div className="stable-knowledge-list">
            <span>Knowledge becoming stable</span>
            {stable.map((item) => (
              <div key={item.id}>
                <span className={`retention-status ${item.status}`}>{item.status}</span>
                <div>
                  <strong>{item.label}</strong>
                  <small>{item.sourceKind} · {item.intervalDays.toFixed(1)}d interval · streak {item.streak}</small>
                </div>
                <span>{Math.round(item.retention * 100)}%</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="analytics-empty-copy">No cards are stable yet. Two or three successful spaced recalls will start moving knowledge into the growing/stable groups.</p>
        )}
      </div>

      <p className="analytics-note">
        Detailed daily history starts with v0.9.5. Review-load counts use the cards' current due dates; future answers will reschedule them. Retention percentages are transparent scheduler-based estimates, not measured memory probabilities.
      </p>
    </section>
  );
}
