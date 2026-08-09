import type {
  ActiveWeeklyPriorityProfile,
  WeeklyCoachReport,
  WeeklyStudyPriority,
  WeeklyTrendRow,
} from '../lib/weeklyCoach';

interface WeeklyCoachPanelProps {
  report: WeeklyCoachReport;
  activePriorities: ActiveWeeklyPriorityProfile;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function pp(value: number): string {
  const rounded = Math.round(value * 100);
  return `${rounded > 0 ? '+' : ''}${rounded} pp`;
}

function weekDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function TrendRows({ rows }: { rows: WeeklyTrendRow[] }) {
  const visible = rows.filter((row) => row.status !== 'insufficient').slice(0, 5);
  if (!visible.length) return <p className="weekly-empty">Not enough repeated attempts yet to establish a trend.</p>;

  return (
    <div className="weekly-trend-list">
      {visible.map((row) => (
        <div key={`${row.domain}:${row.label}`}>
          <span className={`weekly-trend-status ${row.status}`}>{row.status}</span>
          <div>
            <strong>{row.label}</strong>
            <small>{row.previousAttempts} → {row.currentAttempts} attempts</small>
          </div>
          <div className="weekly-trend-score">
            <strong>{pct(row.previousAccuracy)} → {pct(row.currentAccuracy)}</strong>
            <small>{pp(row.deltaAccuracy)}</small>
          </div>
        </div>
      ))}
    </div>
  );
}

function PriorityRows({ priorities }: { priorities: WeeklyStudyPriority[] }) {
  const visible = priorities.slice(0, 6);
  if (!visible.length) return <p className="weekly-empty">No automatic priority change is justified yet.</p>;

  return (
    <div className="weekly-priority-list">
      {visible.map((priority) => (
        <div key={`${priority.domain}:${priority.label}`}>
          <span className={`weekly-priority-action ${priority.action}`}>{priority.action}</span>
          <div>
            <strong>{priority.label}</strong>
            <small>{priority.reason}</small>
          </div>
          <b>×{priority.multiplier.toFixed(2)}</b>
        </div>
      ))}
    </div>
  );
}

export function WeeklyCoachPanel({
  report,
  activePriorities,
}: WeeklyCoachPanelProps) {
  const currentAccuracy = report.current.attempts ? pct(report.current.accuracy) : '—';
  const previousAccuracy = report.previous.attempts ? pct(report.previous.accuracy) : '—';
  const hasActive = Boolean(activePriorities.sourceReportId);

  return (
    <section className="panel weekly-coach-panel">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">Weekly coach</span>
          <h2>Trend report</h2>
        </div>
        <span className={`weekly-overall-badge ${report.overallStatus}`}>{report.overallStatus}</span>
      </div>

      <div className="weekly-window-label">
        <span>This week to date</span>
        <strong>{weekDate(report.weekStartAt)} → now</strong>
        <small>compared with the same elapsed part of last week</small>
      </div>

      <div className="weekly-summary-grid">
        <div>
          <span>Attempts</span>
          <strong>{report.current.attempts}</strong>
          <small>last week {report.previous.attempts}</small>
        </div>
        <div>
          <span>Accuracy</span>
          <strong>{currentAccuracy}</strong>
          <small>last week {previousAccuracy}</small>
        </div>
        <div>
          <span>Change</span>
          <strong>{report.current.attempts && report.previous.attempts ? pp(report.overallDeltaAccuracy) : '—'}</strong>
          <small>accuracy percentage points</small>
        </div>
        <div>
          <span>Active days</span>
          <strong>{report.current.activeDays}</strong>
          <small>last week {report.previous.activeDays}</small>
        </div>
      </div>

      <p className="weekly-summary-copy">{report.summary}</p>

      <div className="weekly-trend-columns">
        <div>
          <div className="weekly-section-heading">
            <span>Weakness trends</span>
            <small>this week vs last week</small>
          </div>
          <TrendRows rows={report.weaknessTrends} />
        </div>
        <div>
          <div className="weekly-section-heading">
            <span>Opening trends</span>
            <small>training recall</small>
          </div>
          <TrendRows rows={report.openingTrends} />
        </div>
      </div>

      <div className="weekly-next-priorities">
        <div className="weekly-section-heading">
          <span>Next week priority preview</span>
          <small>automatic planner multipliers</small>
        </div>
        <PriorityRows priorities={report.priorities} />
      </div>

      <div className={`weekly-active-priorities ${hasActive ? 'active' : ''}`}>
        <div>
          <span>Current week automatic adjustment</span>
          <strong>{hasActive ? 'Applied to Daily Study' : 'Baseline planner'}</strong>
        </div>
        {hasActive && activePriorities.labels.length > 0 ? (
          <div className="weekly-active-tags">
            {activePriorities.labels.map((label) => <b key={label}>{label}</b>)}
          </div>
        ) : (
          <small>
            {hasActive
              ? 'The previous completed weekly report has no areas requiring extra emphasis.'
              : 'A completed prior week is needed before automatic week-level adjustments can activate.'}
          </small>
        )}
      </div>

      <p className="weekly-note">
        Live trends are a preview. At the weekly rollover the completed report is frozen locally; its multipliers automatically reorder the following week’s Daily Study candidates without overriding due dates or Stockfish grading.
      </p>
    </section>
  );
}
