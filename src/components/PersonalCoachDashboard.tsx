import type { DailySessionReport } from '../lib/dailySessionReport';
import type { DailyStudyPlan } from '../lib/dailyStudyPlanner';
import { activeGoal, evaluateGoalProgress, type GoalPlanMemory } from '../lib/goalPlans';
import { repertoireStats, type RepertoireMemory } from '../lib/repertoireMemory';
import { spacedStats, type SpacedRepetitionMemory } from '../lib/spacedRepetition';
import type { TrainingAnalyticsMemory } from '../lib/trainingAnalytics';
import type { WeaknessMemory } from '../lib/weaknessProfile';
import { weaknessProfileRows } from '../lib/weaknessProfile';
import type { WeeklyCoachReport } from '../lib/weeklyCoach';
import type { InterventionHistoryAnalytics } from '../lib/interventionHistoryAnalytics';
import type { GameAnalyticsSummary } from '../lib/gameAnalytics';

interface PersonalCoachDashboardProps {
  weaknessMemory: WeaknessMemory;
  repertoireMemory: RepertoireMemory;
  spacedMemory: SpacedRepetitionMemory;
  analytics: TrainingAnalyticsMemory;
  goalMemory: GoalPlanMemory;
  weeklyReport: WeeklyCoachReport;
  dailyPlan: DailyStudyPlan;
  latestDailyReport: DailySessionReport | null;
  interventionAnalytics: InterventionHistoryAnalytics;
  gameAnalytics: GameAnalyticsSummary;
  now: number;
  disabled?: boolean;
  onStartDaily(): void;
  onJump(sectionId: string): void;
}

function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

function deltaText(value: number): string {
  const points = Math.round(value * 100);
  return `${points > 0 ? '+' : ''}${points} pp`;
}

export function PersonalCoachDashboard({
  weaknessMemory,
  repertoireMemory,
  spacedMemory,
  analytics,
  goalMemory,
  weeklyReport,
  dailyPlan,
  latestDailyReport,
  interventionAnalytics,
  gameAnalytics,
  now,
  disabled = false,
  onStartDaily,
  onJump,
}: PersonalCoachDashboardProps) {
  const spaced = spacedStats(spacedMemory, now);
  const repertoire = repertoireStats(repertoireMemory);
  const topWeakness = weaknessProfileRows(weaknessMemory)
    .find((row) => row.occurrences > 0 && row.examples > 0) ?? null;
  const goal = activeGoal(goalMemory);
  const goalProgress = goal ? evaluateGoalProgress(goal, analytics, spacedMemory, now) : null;
  const effectiveMethod = interventionAnalytics.bestType;
  const recentQuality = gameAnalytics.current;
  const latestOutcome = interventionAnalytics.history[0] ?? null;

  let recommendation = 'Review a game or save repertoire moves to give the personal coach more material.';
  if (spaced.due > 0) {
    recommendation = `${spaced.due} spaced card${spaced.due === 1 ? ' is' : 's are'} due. Start Today’s Study so due memory is mixed with your weakest current areas.`;
  } else if (goal && goalProgress?.pace === 'behind') {
    recommendation = `${goal.title} is behind expected pace. Today’s Study will give the goal extra selection priority.`;
  } else if (topWeakness) {
    recommendation = `${topWeakness.label} is currently the highest-priority recurring weakness. Keep it in the next adaptive session.`;
  } else if (dailyPlan.items.length > 0) {
    recommendation = `Today’s adaptive session is ready with ${dailyPlan.items.length} positions.`;
  }

  return (
    <section className="panel personal-coach-dashboard" id="personal-coach-dashboard">
      <div className="panel-heading compact">
        <div>
          <span className="eyebrow">Unified personal coach 2.0</span>
          <h2>Today’s home</h2>
        </div>
        <span className="stable-release-badge">1.1</span>
      </div>

      <div className="coach-dashboard-primary">
        <div>
          <span>What should I do today?</span>
          <strong>{recommendation}</strong>
        </div>
        <button
          type="button"
          className="primary-button"
          onClick={onStartDaily}
          disabled={disabled || dailyPlan.items.length === 0}
        >
          {dailyPlan.items.length ? 'Start today’s plan' : 'Add training material'}
        </button>
      </div>

      <div className="coach-dashboard-grid">
        <button type="button" onClick={() => onJump('coach-daily-study')}>
          <span>Today’s plan</span>
          <strong>{dailyPlan.items.length} positions</strong>
          <small>~{dailyPlan.estimatedMinutes} min · {spaced.due} due memory</small>
        </button>

        <button type="button" onClick={() => onJump('coach-weakness-profile')}>
          <span>Weakest area</span>
          <strong>{topWeakness?.shortLabel ?? '—'}</strong>
          <small>{topWeakness ? `${topWeakness.occurrences} occurrences · ${Math.round(topWeakness.averageLossCp)} cp avg` : 'No recurring issue yet'}</small>
        </button>

        <button type="button" onClick={() => onJump('coach-intervention-history')}>
          <span>Most effective method</span>
          <strong>{effectiveMethod?.label ?? 'Collecting evidence'}</strong>
          <small>{effectiveMethod?.avgCplImprovement !== null && effectiveMethod?.avgCplImprovement !== undefined
            ? `+${effectiveMethod.avgCplImprovement.toFixed(1)} cp · ${effectiveMethod.confidence}`
            : 'Complete interventions to measure this'}</small>
        </button>

        <button type="button" onClick={() => onJump('coach-game-analytics')}>
          <span>Recent game quality</span>
          <strong>{recentQuality.avgCpl === null ? '—' : `${Math.round(recentQuality.avgCpl)} CPL`}</strong>
          <small>{recentQuality.games} reviewed games · {recentQuality.blundersPerGame === null ? 'no blunder data' : `${recentQuality.blundersPerGame.toFixed(1)} blunders/game`}</small>
        </button>

        <button type="button" onClick={() => onJump('coach-recommendation-outcomes')}>
          <span>Current intervention outcome</span>
          <strong>{latestOutcome ? latestOutcome.verdict : 'Collecting'}</strong>
          <small>{latestOutcome ? `${latestOutcome.trainingTypeLabel} · ${latestOutcome.checkpointGames}-game check` : `${interventionAnalytics.collectingInterventions} awaiting evidence`}</small>
        </button>

        <button type="button" onClick={() => onJump('coach-goal-plan')}>
          <span>Active goal</span>
          <strong>{goalProgress ? `${Math.round(goalProgress.overallProgress * 100)}%` : '—'}</strong>
          <small>{goal ? `${goal.title} · ${goalProgress?.pace ?? 'insufficient'}` : 'No 4–8 week goal'}</small>
        </button>

        <button type="button" onClick={() => onJump('coach-weekly-report')}>
          <span>Training this week</span>
          <strong>{weeklyReport.current.attempts ? pct(weeklyReport.current.accuracy) : '—'}</strong>
          <small>{weeklyReport.current.attempts} attempts · {weeklyReport.previous.attempts ? deltaText(weeklyReport.overallDeltaAccuracy) : 'no comparison yet'}</small>
        </button>
      </div>

      <div className="coach-dashboard-footer">
        <button type="button" onClick={() => onJump('coach-recommendations')}>Coach actions</button>
        <button type="button" onClick={() => onJump('coach-recommendation-outcomes')}>Outcomes</button>
        <button type="button" onClick={() => onJump('coach-intervention-history')}>What works</button>
        <button type="button" onClick={() => onJump('coach-game-library')}>Game library</button>
        <button type="button" onClick={() => onJump('coach-game-analytics')}>Game analytics</button>
        <button type="button" onClick={() => onJump('coach-daily-study')}>Daily planner</button>
        <button type="button" onClick={() => onJump('coach-training-analytics')}>Training analytics</button>
        <button type="button" onClick={() => onJump('coach-data-backup')}>Backup</button>
      </div>
    </section>
  );
}
