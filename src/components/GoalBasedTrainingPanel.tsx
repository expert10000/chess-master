import { useEffect, useMemo, useState } from 'react';
import type { SpacedRepetitionMemory } from '../lib/spacedRepetition';
import type { TrainingAnalyticsMemory } from '../lib/trainingAnalytics';
import type { WeaknessMemory } from '../lib/weaknessProfile';
import {
  activeGoal,
  evaluateGoalProgress,
  type GoalPlanCreateInput,
  type GoalPlanDuration,
  type GoalPlanMemory,
  type GoalPlanType,
} from '../lib/goalPlans';

interface GoalBasedTrainingPanelProps {
  memory: GoalPlanMemory;
  analytics: TrainingAnalyticsMemory;
  spacedMemory: SpacedRepetitionMemory;
  weaknessMemory: WeaknessMemory;
  openingOptions: string[];
  weaknessOptions: string[];
  now: number;
  disabled?: boolean;
  onCreate(input: GoalPlanCreateInput): void;
  onPause(): void;
  onComplete(): void;
  onResume(goalId: string): void;
}

function metricText(value: number | null): string {
  return value === null ? '—' : `${Math.round(value)}%`;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function GoalBasedTrainingPanel({
  memory,
  analytics,
  spacedMemory,
  weaknessMemory,
  openingOptions,
  weaknessOptions,
  now,
  disabled = false,
  onCreate,
  onPause,
  onComplete,
  onResume,
}: GoalBasedTrainingPanelProps) {
  const current = activeGoal(memory);
  const progress = current
    ? evaluateGoalProgress(current, analytics, spacedMemory, now)
    : null;
  const [type, setType] = useState<GoalPlanType>('opening');
  const [durationWeeks, setDurationWeeks] = useState<GoalPlanDuration>(6);
  const [targetLabel, setTargetLabel] = useState('');
  const [targetRating, setTargetRating] = useState(2200);

  const options = type === 'opening' ? openingOptions : weaknessOptions;
  useEffect(() => {
    if (type === 'rating') return;
    if (!options.length) {
      setTargetLabel('');
      return;
    }
    if (!options.includes(targetLabel)) setTargetLabel(options[0]);
  }, [type, options.join('|')]);

  const canCreate = type === 'rating'
    ? targetRating >= 800 && targetRating <= 3000
    : Boolean(targetLabel);

  const previousGoals = useMemo(
    () => memory.goals.filter((goal) => goal.id !== current?.id).slice().reverse().slice(0, 4),
    [memory.goals, current?.id],
  );

  function create(): void {
    if (!canCreate) return;
    onCreate({
      type,
      durationWeeks,
      targetLabel: type === 'rating' ? undefined : targetLabel,
      targetRating: type === 'rating' ? targetRating : undefined,
    });
  }

  return (
    <section className="panel goal-based-training-panel" id="coach-goal-plan">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">Long-term coach</span>
          <h2>Goal-based plan</h2>
        </div>
        <span className={`goal-status-badge ${current ? 'active' : 'idle'}`}>
          {current ? `week ${progress?.currentWeek}/${current.durationWeeks}` : 'no active goal'}
        </span>
      </div>

      {current && progress ? (
        <>
          <div className="goal-active-hero">
            <div>
              <span>{current.type === 'rating' ? 'Rating preparation' : current.type === 'opening' ? 'Opening goal' : 'Weakness goal'}</span>
              <strong>{current.title}</strong>
              <small>{formatDate(current.startAt)} → {formatDate(current.endAt)} · {progress.daysRemaining} days remaining</small>
            </div>
            <span className={`goal-pace ${progress.pace}`}>{progress.pace}</span>
          </div>

          <div className="goal-progress-block">
            <div className="goal-progress-heading">
              <span>Overall plan progress</span>
              <strong>{Math.round(progress.overallProgress * 100)}%</strong>
            </div>
            <div className="goal-progress-track">
              <span style={{ width: `${Math.max(2, progress.overallProgress * 100)}%` }} />
              <i style={{ left: `${Math.min(100, progress.expectedProgress * 100)}%` }} title="Expected progress by time elapsed" />
            </div>
            <small>Marker = expected pace from elapsed calendar time.</small>
          </div>

          <div className="goal-metric-grid">
            <div>
              <span>{progress.metricLabel}</span>
              <strong>{metricText(progress.currentMetric)}</strong>
              <small>baseline {metricText(progress.baselineMetric)} → target {metricText(progress.targetMetric)}</small>
            </div>
            <div>
              <span>Goal attempts</span>
              <strong>{progress.attempts}</strong>
              <small>{current.targets.weeklyAttempts}/week target</small>
            </div>
            <div>
              <span>Active days</span>
              <strong>{progress.activeDays}</strong>
              <small>{current.targets.activeDaysPerWeek}/week target</small>
            </div>
            <div>
              <span>Stable cards</span>
              <strong>{progress.stableCards}</strong>
              <small>target {current.targets.stableCards}</small>
            </div>
          </div>

          <div className="goal-current-milestone">
            <span>Week {progress.currentWeek} · {progress.currentMilestone.title}</span>
            <strong>{progress.currentMilestone.weeklyAttempts} focused attempts this week</strong>
            <p>{progress.currentMilestone.description}</p>
          </div>

          <div className="goal-milestones">
            {current.milestones.map((milestone) => (
              <div
                key={milestone.week}
                className={`${milestone.week === progress.currentWeek ? 'current' : ''} ${milestone.week < progress.currentWeek ? 'past' : ''}`}
              >
                <b>{milestone.week}</b>
                <div>
                  <strong>{milestone.title}</strong>
                  <small>{milestone.weeklyAttempts} attempts{milestone.targetAccuracy !== null ? ` · ${Math.round(milestone.targetAccuracy * 100)}% trajectory` : ''}</small>
                </div>
              </div>
            ))}
          </div>

          {current.type === 'rating' && (
            <p className="goal-rating-note">
              “Prepare toward {current.targetRating}” measures training readiness, consistency, retention, and exercise accuracy. It does not claim or predict an actual Elo rating.
            </p>
          )}

          <div className="goal-actions">
            <button type="button" onClick={onPause} disabled={disabled}>Pause plan</button>
            <button type="button" className="primary-button" onClick={onComplete} disabled={disabled}>Complete & archive</button>
          </div>
        </>
      ) : (
        <div className="goal-empty">
          <strong>Choose one primary 4–8 week target.</strong>
          <p>The active goal will influence Daily Study selection and create an explicit baseline, milestones, and measurable end target.</p>
        </div>
      )}

      <div className="goal-builder">
        <div className="goal-builder-heading">
          <span>{current ? 'Start a different goal' : 'Create plan'}</span>
          <small>starting a new goal pauses the current one</small>
        </div>

        <div className="goal-type-picker">
          <button type="button" className={type === 'opening' ? 'active' : ''} onClick={() => setType('opening')}>Improve opening</button>
          <button type="button" className={type === 'weakness' ? 'active' : ''} onClick={() => setType('weakness')}>Reduce weakness</button>
          <button type="button" className={type === 'rating' ? 'active' : ''} onClick={() => setType('rating')}>Rating preparation</button>
        </div>

        {type !== 'rating' ? (
          <label className="goal-target-field">
            Target
            <select value={targetLabel} onChange={(event) => setTargetLabel(event.target.value)} disabled={!options.length}>
              {options.length
                ? options.map((option) => <option value={option} key={option}>{option}</option>)
                : <option value="">No trained {type === 'opening' ? 'openings' : 'weaknesses'} available yet</option>}
            </select>
          </label>
        ) : (
          <label className="goal-target-field">
            Prepare toward rating
            <input
              type="number"
              min={800}
              max={3000}
              step={50}
              value={targetRating}
              onChange={(event) => setTargetRating(Number(event.target.value))}
            />
          </label>
        )}

        <div className="goal-duration-picker">
          {([4, 6, 8] as GoalPlanDuration[]).map((weeks) => (
            <button
              type="button"
              key={weeks}
              className={durationWeeks === weeks ? 'active' : ''}
              onClick={() => setDurationWeeks(weeks)}
            >
              {weeks} weeks
            </button>
          ))}
        </div>

        <button type="button" className="primary-button goal-create-button" onClick={create} disabled={disabled || !canCreate}>
          Create {durationWeeks}-week plan
        </button>
      </div>

      {previousGoals.length > 0 && (
        <div className="goal-history">
          <span>Recent plans</span>
          {previousGoals.map((goal) => (
            <div key={goal.id}>
              <div>
                <strong>{goal.title}</strong>
                <small>{goal.durationWeeks} weeks · {goal.status}</small>
              </div>
              {goal.status === 'paused' && (
                <button type="button" onClick={() => onResume(goal.id)} disabled={disabled}>Resume</button>
              )}
            </div>
          ))}
        </div>
      )}

      <p className="goal-note">
        Goal progress is based on actual Training attempts logged since v0.9.5. Goal priority changes which eligible positions Daily Study selects; it never changes Stockfish grading or spaced-repetition due dates.
      </p>
    </section>
  );
}
