import type { DailySessionReport } from '../lib/dailySessionReport';

interface DailySessionReportPanelProps {
  report: DailySessionReport;
  compact?: boolean;
}

function dateTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function dueText(timestamp: number): string {
  return new Date(timestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function intervalText(days: number): string {
  if (days <= 0) return 'learning';
  if (days < 1) return `${Math.round(days * 24)}h`;
  return `${days.toFixed(days >= 10 ? 0 : 1)}d`;
}

export function DailySessionReportPanel({
  report,
  compact = false,
}: DailySessionReportPanelProps) {
  const completedAll = report.attemptedPositions >= report.plannedCount;
  const percent = report.attemptedPositions ? Math.round(report.accuracy * 100) : 0;

  return (
    <section className={`panel daily-session-report-panel ${compact ? 'compact-report' : ''}`}>
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">Post-session report</span>
          <h2>{report.dateKey} study</h2>
        </div>
        <span className={`daily-report-result ${percent >= 80 ? 'strong' : percent >= 60 ? 'mixed' : 'weak'}`}>
          {percent}% solved
        </span>
      </div>

      <div className="daily-report-summary">
        <div><span>Attempted</span><strong>{report.attemptedPositions}/{report.plannedCount}</strong></div>
        <div><span>Solved</span><strong>{report.solvedPositions}</strong></div>
        <div><span>Clean first try</span><strong>{report.cleanFirstTry}</strong></div>
        <div><span>Recovered</span><strong>{report.recoveredPositions}</strong></div>
        <div><span>Hint-assisted</span><strong>{report.hintAssisted}</strong></div>
        <div><span>Avg best score</span><strong>{report.averageBestPoints.toFixed(0)}</strong></div>
      </div>

      {!completedAll && (
        <p className="daily-report-incomplete">
          Session ended early: {report.plannedCount - report.attemptedPositions} planned position{report.plannedCount - report.attemptedPositions === 1 ? '' : 's'} were not attempted.
        </p>
      )}

      <div className="daily-report-source-grid">
        {report.sourceResults.map((row) => (
          <div key={row.source}>
            <span>{row.label}</span>
            <strong>{row.solved}/{row.attempted}</strong>
            <small>{Math.round(row.accuracy * 100)}%</small>
          </div>
        ))}
      </div>

      {!compact && (
        <>
          <div className="daily-report-two-column">
            <div className="daily-report-improved">
              <span>What improved</span>
              {report.improvements.length > 0
                ? <ul>{report.improvements.map((message) => <li key={message}>{message}</li>)}</ul>
                : <p>No clear improvement signal yet; more completed positions will make this more meaningful.</p>}
            </div>
            <div className="daily-report-failed">
              <span>What failed</span>
              {report.failures.length > 0
                ? <ul>{report.failures.map((message) => <li key={message}>{message}</li>)}</ul>
                : <p>No positions remained unsolved.</p>}
            </div>
          </div>

          <div className="daily-schedule-changes">
            <div className="daily-report-section-heading">
              <span>How schedules changed</span>
              <small>{report.scheduleChanges.length} spaced card{report.scheduleChanges.length === 1 ? '' : 's'} changed</small>
            </div>
            {report.scheduleChanges.length > 0 ? (
              <div>
                {report.scheduleChanges.slice(0, 8).map((change) => (
                  <div key={change.itemId} className={`schedule-change ${change.result}`}>
                    <span>{change.result}</span>
                    <div>
                      <strong>{change.label}</strong>
                      <small>
                        {intervalText(change.beforeIntervalDays)} → {intervalText(change.afterIntervalDays)}
                        {' · '}streak {change.beforeStreak} → {change.afterStreak}
                      </small>
                    </div>
                    <b>{dueText(change.afterDueAt)}</b>
                  </div>
                ))}
              </div>
            ) : (
              <p className="daily-report-empty">No spaced-repetition schedule changed in this session.</p>
            )}
          </div>
        </>
      )}

      <div className="tomorrow-recommendation">
        <div className="daily-report-section-heading">
          <span>Tomorrow recommendation</span>
          <small>{report.tomorrow.dateKey}</small>
        </div>
        <div className="tomorrow-hero">
          <strong>{report.tomorrow.durationMinutes} min</strong>
          <span>~{report.tomorrow.targetPositions} positions</span>
          <span>{report.tomorrow.dueByTomorrow} due by tomorrow night</span>
        </div>
        {report.tomorrow.focusLabels.length > 0 && (
          <div className="tomorrow-focus">
            <span>Focus</span>
            <div>{report.tomorrow.focusLabels.map((label) => <b key={label}>{label}</b>)}</div>
          </div>
        )}
        <p>{report.tomorrow.reason}</p>
        <small>
          New material recommendation: {report.tomorrow.newMaterialLimit === 0
            ? 'none; consolidate first'
            : `up to ${report.tomorrow.newMaterialLimit} item${report.tomorrow.newMaterialLimit === 1 ? '' : 's'}`}.
        </small>
      </div>

      <p className="daily-report-footer">
        Finished {dateTime(report.finishedAt)}. Tomorrow's load is a planner recommendation based on today's results and the scheduler's current due dates; later reviews can change it.
      </p>
    </section>
  );
}
