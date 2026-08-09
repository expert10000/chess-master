import type { DailyStudyDuration, DailyStudyPlan, DailyStudySource } from './dailyStudyPlanner';
import type { SpacedRepetitionMemory } from './spacedRepetition';
import type { TrainingAttempt, TrainingExercise } from './training';

export const DAILY_SESSION_REPORT_STORAGE_KEY = 'stockfish-coach.daily-session-reports.v1';

export interface ScheduleSnapshot {
  itemId: string;
  label: string;
  dueAt: number;
  intervalDays: number;
  streak: number;
  lapses: number;
}

export interface DailySessionAttemptEvent {
  id: string;
  timestamp: number;
  exerciseKey: string;
  source: DailyStudySource;
  sourceLabel: string;
  reason: string;
  attemptedMoveSan: string;
  accepted: boolean;
  points: number;
  hintLevel: number;
  verdict: string;
  weaknessLabel?: string;
  openingName?: string;
  spacedItemId?: string;
}

export interface ActiveDailyStudySession {
  id: string;
  dateKey: string;
  startedAt: number;
  durationMinutes: DailyStudyDuration;
  plannedCount: number;
  planCounts: DailyStudyPlan['counts'];
  plannedExerciseKeys: string[];
  plannedLabels: Record<string, string>;
  scheduleBefore: Record<string, ScheduleSnapshot>;
  attempts: DailySessionAttemptEvent[];
}

export interface DailySessionPositionResult {
  exerciseKey: string;
  label: string;
  attempts: number;
  solved: boolean;
  firstTry: boolean;
  recovered: boolean;
  usedHints: boolean;
  bestPoints: number;
  lastVerdict: string;
  source: DailyStudySource;
  sourceLabel: string;
  weaknessLabel?: string;
  openingName?: string;
}

export interface DailyScheduleChange {
  itemId: string;
  label: string;
  result: 'expanded' | 'shortened' | 'relearning' | 'unchanged';
  beforeIntervalDays: number;
  afterIntervalDays: number;
  beforeDueAt: number;
  afterDueAt: number;
  beforeStreak: number;
  afterStreak: number;
}

export interface TomorrowRecommendation {
  dateKey: string;
  durationMinutes: DailyStudyDuration;
  targetPositions: number;
  dueByTomorrow: number;
  carryoverFailures: number;
  focusLabels: string[];
  newMaterialLimit: number;
  reason: string;
}

export interface DailySessionReport {
  id: string;
  dateKey: string;
  startedAt: number;
  finishedAt: number;
  durationMinutes: DailyStudyDuration;
  plannedCount: number;
  attemptedPositions: number;
  solvedPositions: number;
  cleanFirstTry: number;
  recoveredPositions: number;
  hintAssisted: number;
  failedPositions: number;
  accuracy: number;
  averageBestPoints: number;
  sourceResults: Array<{
    source: DailyStudySource;
    label: string;
    attempted: number;
    solved: number;
    accuracy: number;
  }>;
  positions: DailySessionPositionResult[];
  improvements: string[];
  failures: string[];
  scheduleChanges: DailyScheduleChange[];
  tomorrow: TomorrowRecommendation;
}

export interface DailySessionReportMemory {
  version: 1;
  reports: DailySessionReport[];
}

const DAY_MS = 86_400_000;

export function emptyDailySessionReportMemory(): DailySessionReportMemory {
  return { version: 1, reports: [] };
}

export function loadDailySessionReportMemory(raw: string | null | undefined): DailySessionReportMemory {
  if (!raw) return emptyDailySessionReportMemory();

  try {
    const parsed = JSON.parse(raw) as Partial<DailySessionReportMemory>;
    if (parsed.version !== 1 || !Array.isArray(parsed.reports)) return emptyDailySessionReportMemory();
    return {
      version: 1,
      reports: parsed.reports
        .filter((report): report is DailySessionReport => Boolean(report?.id && report?.finishedAt))
        .slice(-60),
    };
  } catch {
    return emptyDailySessionReportMemory();
  }
}

export function serializeDailySessionReportMemory(memory: DailySessionReportMemory): string {
  return JSON.stringify(memory);
}

export function saveDailySessionReport(
  memory: DailySessionReportMemory,
  report: DailySessionReport,
): DailySessionReportMemory {
  return {
    version: 1,
    reports: [
      ...memory.reports.filter((item) => item.id !== report.id),
      report,
    ].slice(-60),
  };
}

export function latestDailySessionReport(memory: DailySessionReportMemory): DailySessionReport | null {
  return memory.reports.length ? memory.reports[memory.reports.length - 1] : null;
}

function localDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function beginDailyStudySession(
  plan: DailyStudyPlan,
  spaced: SpacedRepetitionMemory,
  now = Date.now(),
): ActiveDailyStudySession {
  const scheduleBefore: Record<string, ScheduleSnapshot> = {};
  const plannedLabels: Record<string, string> = {};

  for (const item of plan.items) {
    plannedLabels[item.exercise.key] = item.sourceLabel;
    const spacedItemId = item.exercise.spacedItemId;
    if (!spacedItemId || scheduleBefore[spacedItemId]) continue;
    const spacedItem = spaced.items[spacedItemId];
    if (!spacedItem) continue;
    scheduleBefore[spacedItemId] = {
      itemId: spacedItemId,
      label: spacedItem.label,
      dueAt: spacedItem.dueAt,
      intervalDays: spacedItem.intervalDays,
      streak: spacedItem.streak,
      lapses: spacedItem.lapses,
    };
  }

  return {
    id: `daily:${plan.dateKey}:${now}`,
    dateKey: plan.dateKey,
    startedAt: now,
    durationMinutes: plan.durationMinutes,
    plannedCount: plan.items.length,
    planCounts: plan.counts,
    plannedExerciseKeys: plan.items.map((item) => item.exercise.key),
    plannedLabels,
    scheduleBefore,
    attempts: [],
  };
}

export function appendDailySessionAttempt(
  session: ActiveDailyStudySession,
  exercise: TrainingExercise,
  attempt: TrainingAttempt,
  now = Date.now(),
): ActiveDailyStudySession {
  if (!exercise.dailySource) return session;

  const event: DailySessionAttemptEvent = {
    id: `${session.id}:${exercise.key}:${now}:${session.attempts.length}`,
    timestamp: now,
    exerciseKey: exercise.key,
    source: exercise.dailySource,
    sourceLabel: exercise.dailySourceLabel ?? exercise.dailySource,
    reason: exercise.dailyReason ?? 'Selected by adaptive daily study.',
    attemptedMoveSan: attempt.san,
    accepted: attempt.accepted,
    points: attempt.points,
    hintLevel: attempt.hintLevel,
    verdict: attempt.review.verdict,
    weaknessLabel: exercise.weaknessLabel,
    openingName: exercise.openingName,
    spacedItemId: exercise.spacedItemId,
  };

  return {
    ...session,
    attempts: [...session.attempts, event],
  };
}

export function dailySessionAttemptedCount(session: ActiveDailyStudySession | null): number {
  if (!session) return 0;
  return new Set(session.attempts.map((attempt) => attempt.exerciseKey)).size;
}

function positionResults(session: ActiveDailyStudySession): DailySessionPositionResult[] {
  return session.plannedExerciseKeys
    .map((exerciseKey) => {
      const attempts = session.attempts.filter((attempt) => attempt.exerciseKey === exerciseKey);
      if (!attempts.length) return null;

      const acceptedAttempts = attempts.filter((attempt) => attempt.accepted);
      const first = attempts[0];
      const last = attempts[attempts.length - 1];
      const solved = acceptedAttempts.length > 0;
      const firstTry = first.accepted;
      const recovered = !first.accepted && solved;
      const bestPoints = Math.max(...attempts.map((attempt) => attempt.points));

      return {
        exerciseKey,
        label: session.plannedLabels[exerciseKey] ?? first.sourceLabel,
        attempts: attempts.length,
        solved,
        firstTry,
        recovered,
        usedHints: attempts.some((attempt) => attempt.hintLevel > 0),
        bestPoints,
        lastVerdict: last.verdict,
        source: first.source,
        sourceLabel: first.sourceLabel,
        weaknessLabel: first.weaknessLabel,
        openingName: first.openingName,
      } satisfies DailySessionPositionResult;
    })
    .filter((result): result is DailySessionPositionResult => Boolean(result));
}

function scheduleChange(
  before: ScheduleSnapshot,
  spaced: SpacedRepetitionMemory,
): DailyScheduleChange | null {
  const after = spaced.items[before.itemId];
  if (!after) return null;

  let result: DailyScheduleChange['result'] = 'unchanged';
  if (after.lastResult === 'incorrect' && after.streak === 0) result = 'relearning';
  else if (after.intervalDays > before.intervalDays + 0.05) result = 'expanded';
  else if (after.intervalDays + 0.05 < before.intervalDays) result = 'shortened';

  return {
    itemId: before.itemId,
    label: after.label,
    result,
    beforeIntervalDays: before.intervalDays,
    afterIntervalDays: after.intervalDays,
    beforeDueAt: before.dueAt,
    afterDueAt: after.dueAt,
    beforeStreak: before.streak,
    afterStreak: after.streak,
  };
}

function sourceSummary(positions: DailySessionPositionResult[]): DailySessionReport['sourceResults'] {
  const sources: Array<{ source: DailyStudySource; label: string }> = [
    { source: 'due-repertoire', label: 'Due repertoire' },
    { source: 'weakest-area', label: 'Weakest areas' },
    { source: 'recent-mistake', label: 'Recent mistakes' },
    { source: 'new-material', label: 'New material' },
  ];

  return sources
    .map(({ source, label }) => {
      const group = positions.filter((position) => position.source === source);
      const solved = group.filter((position) => position.solved).length;
      return {
        source,
        label,
        attempted: group.length,
        solved,
        accuracy: group.length ? solved / group.length : 0,
      };
    })
    .filter((row) => row.attempted > 0);
}

function focusFailures(positions: DailySessionPositionResult[]): string[] {
  const counts = new Map<string, number>();
  for (const position of positions.filter((item) => !item.solved)) {
    const label = position.weaknessLabel
      ?? position.openingName
      ?? position.sourceLabel
      ?? position.label;
    counts.set(label, (counts.get(label) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([label]) => label);
}

function tomorrowRecommendation(
  session: ActiveDailyStudySession,
  positions: DailySessionPositionResult[],
  spaced: SpacedRepetitionMemory,
  finishedAt: number,
): TomorrowRecommendation {
  const tomorrow = finishedAt + DAY_MS;
  const tomorrowDate = new Date(tomorrow);
  const tomorrowEnd = new Date(
    tomorrowDate.getFullYear(),
    tomorrowDate.getMonth(),
    tomorrowDate.getDate(),
    23, 59, 59, 999,
  ).getTime();

  const dueByTomorrow = Object.values(spaced.items)
    .filter((item) => item.dueAt <= tomorrowEnd)
    .length;
  const failed = positions.filter((position) => !position.solved).length;
  const attempted = positions.length;
  const accuracy = attempted ? (attempted - failed) / attempted : 0;

  let durationMinutes: DailyStudyDuration = 20;
  if (dueByTomorrow >= 12 || failed >= 4 || (attempted >= 6 && accuracy < 0.7)) {
    durationMinutes = 30;
  } else if (dueByTomorrow <= 5 && failed === 0 && attempted >= 5 && accuracy >= 0.88) {
    durationMinutes = 15;
  }

  const focusLabels = focusFailures(positions).slice(0, 3);
  const targetPositions = durationMinutes === 15 ? 10 : durationMinutes === 20 ? 13 : 20;
  const newMaterialLimit = failed > 0 || dueByTomorrow >= 10
    ? 0
    : durationMinutes === 30 ? 2 : 1;

  let reason: string;
  if (durationMinutes === 30) {
    reason = `Use a longer session because ${failed ? `${failed} position${failed === 1 ? '' : 's'} remained unsolved` : 'review load is high'} and ${dueByTomorrow} cards are due by tomorrow night.`;
  } else if (durationMinutes === 15) {
    reason = `A lighter consolidation session is enough: today was strong and only ${dueByTomorrow} cards are due by tomorrow night.`;
  } else {
    reason = `Keep the normal 20-minute load: ${dueByTomorrow} cards are due by tomorrow night${failed ? ` and ${failed} failed position${failed === 1 ? '' : 's'} should return` : ''}.`;
  }

  return {
    dateKey: localDateKey(tomorrow),
    durationMinutes,
    targetPositions,
    dueByTomorrow,
    carryoverFailures: failed,
    focusLabels,
    newMaterialLimit,
    reason,
  };
}

function improvementMessages(positions: DailySessionPositionResult[]): string[] {
  const messages: string[] = [];
  const clean = positions.filter((position) => position.firstTry && !position.usedHints);
  const recovered = positions.filter((position) => position.recovered);
  const strongAreas = new Map<string, { solved: number; total: number }>();

  for (const position of positions) {
    const label = position.weaknessLabel ?? position.openingName ?? position.sourceLabel;
    const current = strongAreas.get(label) ?? { solved: 0, total: 0 };
    current.total += 1;
    if (position.solved) current.solved += 1;
    strongAreas.set(label, current);
  }

  if (clean.length) messages.push(`${clean.length} clean first-try solve${clean.length === 1 ? '' : 's'} without hints.`);
  if (recovered.length) messages.push(`${recovered.length} position${recovered.length === 1 ? '' : 's'} recovered after an initial miss.`);

  const bestArea = [...strongAreas.entries()]
    .filter(([, value]) => value.total >= 2 && value.solved === value.total)
    .sort((a, b) => b[1].total - a[1].total)[0];
  if (bestArea) messages.push(`${bestArea[0]} was fully solved (${bestArea[1].solved}/${bestArea[1].total}).`);

  return messages.slice(0, 4);
}

function failureMessages(positions: DailySessionPositionResult[]): string[] {
  return positions
    .filter((position) => !position.solved)
    .sort((a, b) => b.attempts - a.attempts || a.label.localeCompare(b.label))
    .slice(0, 5)
    .map((position) => `${position.weaknessLabel ?? position.openingName ?? position.sourceLabel}: ${position.label} remained unsolved after ${position.attempts} attempt${position.attempts === 1 ? '' : 's'}.`);
}

export function buildDailySessionReport(
  session: ActiveDailyStudySession,
  spaced: SpacedRepetitionMemory,
  finishedAt = Date.now(),
): DailySessionReport {
  const positions = positionResults(session);
  const solvedPositions = positions.filter((position) => position.solved).length;
  const cleanFirstTry = positions.filter((position) => position.firstTry && !position.usedHints).length;
  const recoveredPositions = positions.filter((position) => position.recovered).length;
  const hintAssisted = positions.filter((position) => position.solved && position.usedHints).length;
  const failedPositions = positions.filter((position) => !position.solved).length;
  const scheduleChanges = Object.values(session.scheduleBefore)
    .map((before) => scheduleChange(before, spaced))
    .filter((change): change is DailyScheduleChange => Boolean(change))
    .filter((change) =>
      change.result !== 'unchanged'
      || change.beforeDueAt !== change.afterDueAt
      || change.beforeStreak !== change.afterStreak
    )
    .sort((a, b) => {
      const rank = { relearning: 0, shortened: 1, expanded: 2, unchanged: 3 };
      return rank[a.result] - rank[b.result] || a.label.localeCompare(b.label);
    });

  return {
    id: `${session.id}:report:${finishedAt}`,
    dateKey: session.dateKey,
    startedAt: session.startedAt,
    finishedAt,
    durationMinutes: session.durationMinutes,
    plannedCount: session.plannedCount,
    attemptedPositions: positions.length,
    solvedPositions,
    cleanFirstTry,
    recoveredPositions,
    hintAssisted,
    failedPositions,
    accuracy: positions.length ? solvedPositions / positions.length : 0,
    averageBestPoints: positions.length
      ? positions.reduce((sum, position) => sum + position.bestPoints, 0) / positions.length
      : 0,
    sourceResults: sourceSummary(positions),
    positions,
    improvements: improvementMessages(positions),
    failures: failureMessages(positions),
    scheduleChanges,
    tomorrow: tomorrowRecommendation(session, positions, spaced, finishedAt),
  };
}
