import type {
  DailyStudyDuration,
  DailyStudyPlan,
} from '../lib/dailyStudyPlanner';
import type { DailySessionReport } from '../lib/dailySessionReport';

interface DailyStudyPlannerPanelProps {
  plan: DailyStudyPlan;
  duration: DailyStudyDuration;
  disabled?: boolean;
  latestReport?: DailySessionReport | null;
  onDurationChange(duration: DailyStudyDuration): void;
  onStart(): void;
}

export function DailyStudyPlannerPanel({
  plan,
  duration,
  disabled = false,
  latestReport = null,
  onDurationChange,
  onStart,
}: DailyStudyPlannerPanelProps) {
  const full = plan.items.length >= plan.targetPositions;

  return (
    <section className="panel daily-study-planner-panel" id="coach-daily-study">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">Adaptive planner</span>
          <h2>Today’s study</h2>
        </div>
        <span className="daily-plan-date">{plan.dateKey}</span>
      </div>

      <div className="daily-duration-picker" aria-label="Daily study duration">
        {([15, 20, 30] as DailyStudyDuration[]).map((minutes) => (
          <button
            type="button"
            key={minutes}
            className={duration === minutes ? 'active' : ''}
            aria-pressed={duration === minutes}
            onClick={() => onDurationChange(minutes)}
            disabled={disabled}
          >
            {minutes} min
          </button>
        ))}
      </div>

      <div className="daily-plan-hero">
        <div>
          <span>{full ? 'Session ready' : 'Available today'}</span>
          <strong>{plan.items.length} positions</strong>
          <small>~{plan.estimatedMinutes} min estimated</small>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={onStart}
          disabled={disabled || plan.items.length === 0}
        >
          Start today’s study
        </button>
      </div>

      <div className="daily-plan-mix">
        <div className="due">
          <span>Due repertoire</span>
          <strong>{plan.counts.dueRepertoire}</strong>
        </div>
        <div className="weakness">
          <span>Weakest areas</span>
          <strong>{plan.counts.weakestAreas}</strong>
        </div>
        <div className="recent">
          <span>Recent mistakes</span>
          <strong>{plan.counts.recentMistakes}</strong>
        </div>
        <div className="new">
          <span>New material</span>
          <strong>{plan.counts.newMaterial}</strong>
        </div>
      </div>

      {plan.goalAdjusted && (
        <div className="daily-goal-adjustment">
          <span>Goal plan focus applied</span>
          <div>{plan.goalPriorityLabels.map((label) => <b key={label}>{label}</b>)}</div>
          <small>The active 4–8 week goal increases selection priority for relevant eligible positions without changing due dates.</small>
        </div>
      )}

      {plan.weeklyAdjusted && (
        <div className="daily-weekly-adjustment">
          <span>Weekly coach adjustment applied</span>
          <div>{plan.weeklyPriorityLabels.map((label) => <b key={label}>{label}</b>)}</div>
          <small>These areas are reordered by the previous completed weekly report; due dates still remain authoritative.</small>
        </div>
      )}

      {plan.weakestLabels.length > 0 && (
        <div className="daily-focus-list">
          <span>Priority focus</span>
          <div>
            {plan.weakestLabels.map((label) => <b key={label}>{label}</b>)}
          </div>
        </div>
      )}

      <div className="daily-plan-principles">
        <span><b>1</b> overdue repertoire first</span>
        <span><b>2</b> recurring weaknesses next</span>
        <span><b>3</b> recent game errors</span>
        <span><b>4</b> only a little new material</span>
      </div>

      <p className="daily-plan-summary">{plan.summary}</p>

      {latestReport && (
        <div className="daily-latest-recommendation">
          <span>From your last session</span>
          <strong>Tomorrow: {latestReport.tomorrow.durationMinutes} min · ~{latestReport.tomorrow.targetPositions} positions</strong>
          <small>{latestReport.tomorrow.reason}</small>
        </div>
      )}
    </section>
  );
}
