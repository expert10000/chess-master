import type { SpacedRepetitionMemory } from './spacedRepetition';
import type { TrainingAnalyticsEvent, TrainingAnalyticsMemory } from './trainingAnalytics';
import {
  weaknessProfileRows,
  type WeaknessMemory,
} from './weaknessProfile';

export const GOAL_PLAN_STORAGE_KEY = 'stockfish-coach.goal-plans.v1';

export type GoalPlanType = 'opening' | 'weakness' | 'rating';
export type GoalPlanDuration = 4 | 6 | 8;
export type GoalPlanStatus = 'active' | 'paused' | 'completed';

export interface GoalPlanBaseline {
  measuredAt: number;
  windowDays: number;
  attempts: number;
  accuracy: number | null;
  averagePoints: number | null;
  activeDays: number;
  stableCards: number;
  trainingReadiness: number | null;
}

export interface GoalPlanTargets {
  targetAccuracy: number | null;
  targetReadiness: number | null;
  weeklyAttempts: number;
  activeDaysPerWeek: number;
  stableCards: number;
}

export interface GoalPlanMilestone {
  week: number;
  phase: 'baseline' | 'focus' | 'application' | 'consolidation';
  title: string;
  description: string;
  weeklyAttempts: number;
  targetAccuracy: number | null;
}

export interface GoalPlan {
  id: string;
  type: GoalPlanType;
  title: string;
  targetLabel?: string;
  targetRating?: number;
  durationWeeks: GoalPlanDuration;
  createdAt: number;
  startAt: number;
  endAt: number;
  status: GoalPlanStatus;
  completedAt?: number;
  pausedAt?: number;
  baseline: GoalPlanBaseline;
  targets: GoalPlanTargets;
  milestones: GoalPlanMilestone[];
}

export interface GoalPlanMemory {
  version: 1;
  activeGoalId: string | null;
  goals: GoalPlan[];
}

export interface GoalPlanCreateInput {
  type: GoalPlanType;
  durationWeeks: GoalPlanDuration;
  targetLabel?: string;
  targetRating?: number;
}

export interface GoalProgress {
  goalId: string;
  currentWeek: number;
  elapsedDays: number;
  daysRemaining: number;
  planElapsedFraction: number;
  attempts: number;
  accuracy: number | null;
  averagePoints: number | null;
  activeDays: number;
  stableCards: number;
  currentReadiness: number | null;
  accuracyProgress: number;
  volumeProgress: number;
  activeDayProgress: number;
  retentionProgress: number;
  readinessProgress: number;
  overallProgress: number;
  expectedProgress: number;
  pace: 'ahead' | 'on-track' | 'behind' | 'insufficient';
  metricLabel: string;
  baselineMetric: number | null;
  currentMetric: number | null;
  targetMetric: number | null;
  currentMilestone: GoalPlanMilestone;
}

export interface GoalPriorityProfile {
  sourceGoalId: string | null;
  multipliers: Record<string, number>;
  reasons: Record<string, string>;
  labels: string[];
}

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const MAX_GOALS = 24;

export function emptyGoalPlanMemory(): GoalPlanMemory {
  return { version: 1, activeGoalId: null, goals: [] };
}

export function loadGoalPlanMemory(raw: string | null | undefined): GoalPlanMemory {
  if (!raw) return emptyGoalPlanMemory();

  try {
    const parsed = JSON.parse(raw) as Partial<GoalPlanMemory>;
    if (parsed.version !== 1 || !Array.isArray(parsed.goals)) return emptyGoalPlanMemory();
    const goals = parsed.goals
      .filter((goal): goal is GoalPlan => Boolean(
        goal?.id
        && ['opening', 'weakness', 'rating'].includes(goal.type)
        && [4, 6, 8].includes(goal.durationWeeks)
        && goal.baseline
        && goal.targets
        && Array.isArray(goal.milestones)
      ))
      .slice(-MAX_GOALS);
    const activeGoalId = goals.some((goal) => goal.id === parsed.activeGoalId && goal.status === 'active')
      ? parsed.activeGoalId ?? null
      : goals.find((goal) => goal.status === 'active')?.id ?? null;
    return { version: 1, activeGoalId, goals };
  } catch {
    return emptyGoalPlanMemory();
  }
}

export function serializeGoalPlanMemory(memory: GoalPlanMemory): string {
  return JSON.stringify(memory);
}

function localDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function eventsForGoal(
  type: GoalPlanType,
  targetLabel: string | undefined,
  events: TrainingAnalyticsEvent[],
): TrainingAnalyticsEvent[] {
  if (type === 'opening') return events.filter((event) => event.openingName === targetLabel);
  if (type === 'weakness') return events.filter((event) => event.weaknessLabel === targetLabel);
  return events;
}

function stableCardsForGoal(
  type: GoalPlanType,
  targetLabel: string | undefined,
  spaced: SpacedRepetitionMemory,
): number {
  return Object.values(spaced.items).filter((item) => {
    if (item.intervalDays < 14 || item.streak < 3 || item.lastResult !== 'correct') return false;
    if (type === 'opening') return item.exercise.openingName === targetLabel;
    if (type === 'weakness') return item.exercise.weaknessLabel === targetLabel;
    return true;
  }).length;
}

function trainingReadiness(
  analytics: TrainingAnalyticsMemory,
  spaced: SpacedRepetitionMemory,
  now: number,
): number | null {
  const cutoff = now - 30 * DAY_MS;
  const events = analytics.events.filter((event) => event.timestamp >= cutoff && event.timestamp <= now);
  if (events.length < 3) return null;

  const correct = events.filter((event) => event.accepted).length;
  const accuracy = correct / events.length;
  const averagePoints = events.reduce((sum, event) => sum + event.points, 0) / events.length;
  const activeDays = new Set(events.map((event) => localDateKey(event.timestamp))).size;
  const stable = Object.values(spaced.items).filter(
    (item) => item.intervalDays >= 14 && item.streak >= 3 && item.lastResult === 'correct',
  ).length;

  const score =
    accuracy * 55
    + Math.min(1, activeDays / 12) * 20
    + Math.min(1, averagePoints / 90) * 15
    + Math.min(1, stable / 16) * 10;
  return Math.max(0, Math.min(100, score));
}

function baselineForGoal(
  input: GoalPlanCreateInput,
  analytics: TrainingAnalyticsMemory,
  spaced: SpacedRepetitionMemory,
  now: number,
): GoalPlanBaseline {
  const windowDays = input.type === 'rating' ? 30 : 14;
  const cutoff = now - windowDays * DAY_MS;
  const relevant = eventsForGoal(
    input.type,
    input.targetLabel,
    analytics.events.filter((event) => event.timestamp >= cutoff && event.timestamp < now),
  );
  const correct = relevant.filter((event) => event.accepted).length;

  return {
    measuredAt: now,
    windowDays,
    attempts: relevant.length,
    accuracy: relevant.length ? correct / relevant.length : null,
    averagePoints: relevant.length
      ? relevant.reduce((sum, event) => sum + event.points, 0) / relevant.length
      : null,
    activeDays: new Set(relevant.map((event) => localDateKey(event.timestamp))).size,
    stableCards: stableCardsForGoal(input.type, input.targetLabel, spaced),
    trainingReadiness: input.type === 'rating'
      ? trainingReadiness(analytics, spaced, now)
      : null,
  };
}

function targetsForGoal(
  input: GoalPlanCreateInput,
  baseline: GoalPlanBaseline,
): GoalPlanTargets {
  if (input.type === 'opening') {
    const start = baseline.accuracy ?? 0.70;
    return {
      targetAccuracy: Math.min(0.95, Math.max(0.85, start + 0.12)),
      targetReadiness: null,
      weeklyAttempts: 8,
      activeDaysPerWeek: 3,
      stableCards: Math.max(4, baseline.stableCards + 2),
    };
  }

  if (input.type === 'weakness') {
    const start = baseline.accuracy ?? 0.65;
    return {
      targetAccuracy: Math.min(0.93, Math.max(0.82, start + 0.15)),
      targetReadiness: null,
      weeklyAttempts: 10,
      activeDaysPerWeek: 4,
      stableCards: Math.max(4, baseline.stableCards + 2),
    };
  }

  const start = baseline.trainingReadiness ?? 55;
  return {
    targetAccuracy: null,
    targetReadiness: Math.min(90, Math.max(78, start + 15)),
    weeklyAttempts: 18,
    activeDaysPerWeek: 4,
    stableCards: Math.max(12, baseline.stableCards + 4),
  };
}

function phaseForWeek(week: number, duration: GoalPlanDuration): GoalPlanMilestone['phase'] {
  if (week === 1) return 'baseline';
  const fraction = week / duration;
  if (fraction <= 0.45) return 'focus';
  if (fraction <= 0.78) return 'application';
  return 'consolidation';
}

function milestoneTitle(phase: GoalPlanMilestone['phase']): string {
  if (phase === 'baseline') return 'Baseline & diagnosis';
  if (phase === 'focus') return 'Focused repetition';
  if (phase === 'application') return 'Mixed application';
  return 'Consolidation';
}

function milestoneDescription(
  type: GoalPlanType,
  phase: GoalPlanMilestone['phase'],
  targetLabel?: string,
): string {
  const subject = type === 'rating'
    ? 'overall training readiness'
    : targetLabel ?? (type === 'opening' ? 'opening recall' : 'weakness training');

  if (phase === 'baseline') return `Establish a reliable baseline for ${subject} and identify the highest-friction positions.`;
  if (phase === 'focus') return `Increase deliberate repetition of ${subject} while keeping spaced-review failures in the loop.`;
  if (phase === 'application') return `Mix ${subject} with recent mistakes and other material so recall transfers outside isolated drills.`;
  return `Consolidate ${subject}, reduce hints, and finish with longer spaced intervals rather than extra novelty.`;
}

function buildMilestones(
  input: GoalPlanCreateInput,
  targets: GoalPlanTargets,
  baseline: GoalPlanBaseline,
): GoalPlanMilestone[] {
  return Array.from({ length: input.durationWeeks }, (_, index) => {
    const week = index + 1;
    const phase = phaseForWeek(week, input.durationWeeks);
    const fraction = week / input.durationWeeks;
    const baselineAccuracy = baseline.accuracy ?? (
      input.type === 'opening' ? 0.70 : input.type === 'weakness' ? 0.65 : 0
    );
    const targetAccuracy = targets.targetAccuracy === null
      ? null
      : Math.min(targets.targetAccuracy, baselineAccuracy + (targets.targetAccuracy - baselineAccuracy) * fraction);

    return {
      week,
      phase,
      title: milestoneTitle(phase),
      description: milestoneDescription(input.type, phase, input.targetLabel),
      weeklyAttempts: phase === 'baseline'
        ? Math.max(5, Math.round(targets.weeklyAttempts * 0.75))
        : targets.weeklyAttempts,
      targetAccuracy,
    };
  });
}

function goalTitle(input: GoalPlanCreateInput): string {
  if (input.type === 'opening') return `Improve ${input.targetLabel ?? 'opening recall'}`;
  if (input.type === 'weakness') return `Reduce ${input.targetLabel ?? 'recurring weakness'}`;
  return `Prepare toward ${Math.round(input.targetRating ?? 2200)}`;
}

export function createGoalPlan(
  memory: GoalPlanMemory,
  input: GoalPlanCreateInput,
  analytics: TrainingAnalyticsMemory,
  spaced: SpacedRepetitionMemory,
  now = Date.now(),
): GoalPlanMemory {
  const baseline = baselineForGoal(input, analytics, spaced, now);
  const targets = targetsForGoal(input, baseline);
  const goal: GoalPlan = {
    id: `goal:${input.type}:${now}`,
    type: input.type,
    title: goalTitle(input),
    targetLabel: input.targetLabel,
    targetRating: input.type === 'rating'
      ? Math.max(800, Math.min(3000, Math.round(input.targetRating ?? 2200)))
      : undefined,
    durationWeeks: input.durationWeeks,
    createdAt: now,
    startAt: now,
    endAt: now + input.durationWeeks * WEEK_MS,
    status: 'active',
    baseline,
    targets,
    milestones: buildMilestones(input, targets, baseline),
  };

  const goals = memory.goals
    .map((item) => item.status === 'active' ? { ...item, status: 'paused' as const, pausedAt: now } : item);
  return {
    version: 1,
    activeGoalId: goal.id,
    goals: [...goals, goal].slice(-MAX_GOALS),
  };
}

export function completeActiveGoal(
  memory: GoalPlanMemory,
  now = Date.now(),
): GoalPlanMemory {
  if (!memory.activeGoalId) return memory;
  return {
    version: 1,
    activeGoalId: null,
    goals: memory.goals.map((goal) =>
      goal.id === memory.activeGoalId
        ? { ...goal, status: 'completed' as const, completedAt: now }
        : goal
    ),
  };
}

export function pauseActiveGoal(
  memory: GoalPlanMemory,
  now = Date.now(),
): GoalPlanMemory {
  if (!memory.activeGoalId) return memory;
  return {
    version: 1,
    activeGoalId: null,
    goals: memory.goals.map((goal) =>
      goal.id === memory.activeGoalId
        ? { ...goal, status: 'paused' as const, pausedAt: now }
        : goal
    ),
  };
}

export function resumeGoal(
  memory: GoalPlanMemory,
  goalId: string,
  now = Date.now(),
): GoalPlanMemory {
  if (!memory.goals.some((goal) => goal.id === goalId)) return memory;
  return {
    version: 1,
    activeGoalId: goalId,
    goals: memory.goals.map((goal) => {
      if (goal.id === goalId) return { ...goal, status: 'active' as const, pausedAt: undefined };
      if (goal.status === 'active') return { ...goal, status: 'paused' as const, pausedAt: now };
      return goal;
    }),
  };
}

export function activeGoal(memory: GoalPlanMemory): GoalPlan | null {
  return memory.goals.find((goal) => goal.id === memory.activeGoalId && goal.status === 'active') ?? null;
}

function relevantEventsSinceStart(
  goal: GoalPlan,
  analytics: TrainingAnalyticsMemory,
  now: number,
): TrainingAnalyticsEvent[] {
  return eventsForGoal(
    goal.type,
    goal.targetLabel,
    analytics.events.filter((event) => event.timestamp >= goal.startAt && event.timestamp <= now),
  );
}

function normalizedProgress(current: number | null, baseline: number | null, target: number | null): number {
  if (current === null || target === null) return 0;
  if (baseline === null) return Math.max(0, Math.min(1, current / Math.max(0.01, target)));
  if (target <= baseline + 0.001) return current >= target ? 1 : 0;
  return Math.max(0, Math.min(1, (current - baseline) / (target - baseline)));
}

export function evaluateGoalProgress(
  goal: GoalPlan,
  analytics: TrainingAnalyticsMemory,
  spaced: SpacedRepetitionMemory,
  now = Date.now(),
): GoalProgress {
  const relevant = relevantEventsSinceStart(goal, analytics, now);
  const correct = relevant.filter((event) => event.accepted).length;
  const accuracy = relevant.length ? correct / relevant.length : null;
  const averagePoints = relevant.length
    ? relevant.reduce((sum, event) => sum + event.points, 0) / relevant.length
    : null;
  const activeDays = new Set(relevant.map((event) => localDateKey(event.timestamp))).size;
  const stableCards = stableCardsForGoal(goal.type, goal.targetLabel, spaced);
  const elapsedDays = Math.max(0, Math.floor((now - goal.startAt) / DAY_MS));
  const totalDays = goal.durationWeeks * 7;
  const daysRemaining = Math.max(0, Math.ceil((goal.endAt - now) / DAY_MS));
  const planElapsedFraction = Math.max(0, Math.min(1, elapsedDays / totalDays));
  const currentWeek = Math.max(1, Math.min(goal.durationWeeks, Math.floor(elapsedDays / 7) + 1));
  const totalAttemptTarget = goal.targets.weeklyAttempts * goal.durationWeeks;
  const totalActiveDayTarget = goal.targets.activeDaysPerWeek * goal.durationWeeks;
  const currentReadiness = goal.type === 'rating'
    ? trainingReadiness(analytics, spaced, now)
    : null;

  const accuracyProgress = normalizedProgress(
    accuracy,
    goal.baseline.accuracy,
    goal.targets.targetAccuracy,
  );
  const readinessProgress = normalizedProgress(
    currentReadiness === null ? null : currentReadiness / 100,
    goal.baseline.trainingReadiness === null ? null : goal.baseline.trainingReadiness / 100,
    goal.targets.targetReadiness === null ? null : goal.targets.targetReadiness / 100,
  );
  const volumeProgress = Math.max(0, Math.min(1, relevant.length / Math.max(1, totalAttemptTarget)));
  const activeDayProgress = Math.max(0, Math.min(1, activeDays / Math.max(1, totalActiveDayTarget)));
  const retentionProgress = Math.max(
    0,
    Math.min(
      1,
      (stableCards - goal.baseline.stableCards)
      / Math.max(1, goal.targets.stableCards - goal.baseline.stableCards),
    ),
  );

  const overallProgress = goal.type === 'rating'
    ? readinessProgress * 0.55 + volumeProgress * 0.25 + activeDayProgress * 0.15 + retentionProgress * 0.05
    : accuracyProgress * 0.50 + volumeProgress * 0.25 + activeDayProgress * 0.15 + retentionProgress * 0.10;
  const expectedProgress = Math.max(0.08, planElapsedFraction);

  let pace: GoalProgress['pace'];
  if (relevant.length < 3 && elapsedDays < 7) pace = 'insufficient';
  else if (overallProgress >= expectedProgress + 0.12) pace = 'ahead';
  else if (overallProgress + 0.12 < expectedProgress) pace = 'behind';
  else pace = 'on-track';

  const metricLabel = goal.type === 'rating' ? 'Training readiness' : 'Training accuracy';
  const baselineMetric = goal.type === 'rating'
    ? goal.baseline.trainingReadiness
    : goal.baseline.accuracy === null ? null : goal.baseline.accuracy * 100;
  const currentMetric = goal.type === 'rating'
    ? currentReadiness
    : accuracy === null ? null : accuracy * 100;
  const targetMetric = goal.type === 'rating'
    ? goal.targets.targetReadiness
    : goal.targets.targetAccuracy === null ? null : goal.targets.targetAccuracy * 100;

  return {
    goalId: goal.id,
    currentWeek,
    elapsedDays,
    daysRemaining,
    planElapsedFraction,
    attempts: relevant.length,
    accuracy,
    averagePoints,
    activeDays,
    stableCards,
    currentReadiness,
    accuracyProgress,
    volumeProgress,
    activeDayProgress,
    retentionProgress,
    readinessProgress,
    overallProgress: Math.max(0, Math.min(1, overallProgress)),
    expectedProgress,
    pace,
    metricLabel,
    baselineMetric,
    currentMetric,
    targetMetric,
    currentMilestone: goal.milestones[currentWeek - 1] ?? goal.milestones[goal.milestones.length - 1],
  };
}

export function goalPriorityProfile(
  memory: GoalPlanMemory,
  weaknessMemory: WeaknessMemory,
): GoalPriorityProfile {
  const goal = activeGoal(memory);
  if (!goal) return { sourceGoalId: null, multipliers: {}, reasons: {}, labels: [] };

  const multipliers: Record<string, number> = {};
  const reasons: Record<string, string> = {};

  if ((goal.type === 'opening' || goal.type === 'weakness') && goal.targetLabel) {
    multipliers[goal.targetLabel] = 1.70;
    reasons[goal.targetLabel] = `${goal.durationWeeks}-week goal: ${goal.title}.`;
  } else if (goal.type === 'rating') {
    const rows = weaknessProfileRows(weaknessMemory)
      .filter((row) => row.examples > 0)
      .slice(0, 3);
    rows.forEach((row, index) => {
      const multiplier = index === 0 ? 1.35 : index === 1 ? 1.25 : 1.15;
      multipliers[row.label] = multiplier;
      reasons[row.label] = `Rating-preparation goal toward ${goal.targetRating ?? 2200}: strengthen recurring weaknesses.`;
    });
  }

  return {
    sourceGoalId: goal.id,
    multipliers,
    reasons,
    labels: Object.keys(multipliers),
  };
}
