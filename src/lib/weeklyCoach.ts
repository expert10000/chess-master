import type {
  TrainingAnalyticsEvent,
  TrainingAnalyticsMemory,
} from './trainingAnalytics';

export const WEEKLY_COACH_STORAGE_KEY = 'stockfish-coach.weekly-coach.v1';

export type WeeklyTrendDomain = 'weakness' | 'opening';
export type WeeklyTrendStatus = 'improving' | 'declining' | 'stable' | 'new' | 'insufficient';
export type WeeklyPriorityAction = 'increase' | 'maintain' | 'reduce';

export interface WeeklyWindowSummary {
  startAt: number;
  endAt: number;
  attempts: number;
  correct: number;
  accuracy: number;
  averagePoints: number;
  activeDays: number;
}

export interface WeeklyTrendRow {
  domain: WeeklyTrendDomain;
  label: string;
  currentAttempts: number;
  previousAttempts: number;
  currentAccuracy: number;
  previousAccuracy: number;
  deltaAccuracy: number;
  currentAveragePoints: number;
  previousAveragePoints: number;
  status: WeeklyTrendStatus;
}

export interface WeeklyStudyPriority {
  domain: WeeklyTrendDomain;
  label: string;
  action: WeeklyPriorityAction;
  multiplier: number;
  score: number;
  reason: string;
}

export interface WeeklyCoachReport {
  id: string;
  mode: 'live' | 'completed';
  generatedAt: number;
  weekStartAt: number;
  weekEndAt: number;
  compareStartAt: number;
  compareEndAt: number;
  current: WeeklyWindowSummary;
  previous: WeeklyWindowSummary;
  overallDeltaAccuracy: number;
  overallStatus: 'improving' | 'declining' | 'steady' | 'insufficient';
  weaknessTrends: WeeklyTrendRow[];
  openingTrends: WeeklyTrendRow[];
  nextWeekStartAt: number;
  nextWeekEndAt: number;
  priorities: WeeklyStudyPriority[];
  summary: string;
}

export interface WeeklyCoachMemory {
  version: 1;
  reports: WeeklyCoachReport[];
}

export interface ActiveWeeklyPriorityProfile {
  sourceReportId: string | null;
  effectiveStartAt: number | null;
  effectiveEndAt: number | null;
  multipliers: Record<string, number>;
  reasons: Record<string, string>;
  labels: string[];
}

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;
const MAX_REPORTS = 52;

export function emptyWeeklyCoachMemory(): WeeklyCoachMemory {
  return { version: 1, reports: [] };
}

export function loadWeeklyCoachMemory(raw: string | null | undefined): WeeklyCoachMemory {
  if (!raw) return emptyWeeklyCoachMemory();

  try {
    const parsed = JSON.parse(raw) as Partial<WeeklyCoachMemory>;
    if (parsed.version !== 1 || !Array.isArray(parsed.reports)) return emptyWeeklyCoachMemory();
    return {
      version: 1,
      reports: parsed.reports
        .filter((report): report is WeeklyCoachReport => Boolean(
          report?.id
          && typeof report.weekStartAt === 'number'
          && typeof report.nextWeekStartAt === 'number'
          && Array.isArray(report.priorities)
        ))
        .slice(-MAX_REPORTS),
    };
  } catch {
    return emptyWeeklyCoachMemory();
  }
}

export function serializeWeeklyCoachMemory(memory: WeeklyCoachMemory): string {
  return JSON.stringify(memory);
}

export function startOfLocalWeek(timestamp: number): number {
  const date = new Date(timestamp);
  const day = date.getDay();
  const daysSinceMonday = (day + 6) % 7;
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() - daysSinceMonday,
    0, 0, 0, 0,
  ).getTime();
}

function localDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function eventsInWindow(
  memory: TrainingAnalyticsMemory,
  startAt: number,
  endAt: number,
): TrainingAnalyticsEvent[] {
  return memory.events.filter((event) => event.timestamp >= startAt && event.timestamp < endAt);
}

function summarizeWindow(events: TrainingAnalyticsEvent[], startAt: number, endAt: number): WeeklyWindowSummary {
  const correct = events.filter((event) => event.accepted).length;
  return {
    startAt,
    endAt,
    attempts: events.length,
    correct,
    accuracy: events.length ? correct / events.length : 0,
    averagePoints: events.length
      ? events.reduce((sum, event) => sum + event.points, 0) / events.length
      : 0,
    activeDays: new Set(events.map((event) => localDateKey(event.timestamp))).size,
  };
}

function trendStatus(
  currentAttempts: number,
  previousAttempts: number,
  currentAccuracy: number,
  previousAccuracy: number,
): WeeklyTrendStatus {
  if (currentAttempts < 2) return 'insufficient';
  if (previousAttempts < 2) return 'new';

  const delta = currentAccuracy - previousAccuracy;
  if (delta >= 0.12) return 'improving';
  if (delta <= -0.12) return 'declining';
  return 'stable';
}

function groupTrendRows(
  domain: WeeklyTrendDomain,
  currentEvents: TrainingAnalyticsEvent[],
  previousEvents: TrainingAnalyticsEvent[],
  labelOf: (event: TrainingAnalyticsEvent) => string | undefined,
): WeeklyTrendRow[] {
  const labels = new Set<string>();
  currentEvents.forEach((event) => {
    const label = labelOf(event);
    if (label) labels.add(label);
  });
  previousEvents.forEach((event) => {
    const label = labelOf(event);
    if (label) labels.add(label);
  });

  return [...labels]
    .map((label): WeeklyTrendRow => {
      const current = currentEvents.filter((event) => labelOf(event) === label);
      const previous = previousEvents.filter((event) => labelOf(event) === label);
      const currentCorrect = current.filter((event) => event.accepted).length;
      const previousCorrect = previous.filter((event) => event.accepted).length;
      const currentAccuracy = current.length ? currentCorrect / current.length : 0;
      const previousAccuracy = previous.length ? previousCorrect / previous.length : 0;

      return {
        domain,
        label,
        currentAttempts: current.length,
        previousAttempts: previous.length,
        currentAccuracy,
        previousAccuracy,
        deltaAccuracy: currentAccuracy - previousAccuracy,
        currentAveragePoints: current.length
          ? current.reduce((sum, event) => sum + event.points, 0) / current.length
          : 0,
        previousAveragePoints: previous.length
          ? previous.reduce((sum, event) => sum + event.points, 0) / previous.length
          : 0,
        status: trendStatus(current.length, previous.length, currentAccuracy, previousAccuracy),
      };
    })
    .sort((a, b) => {
      const rank: Record<WeeklyTrendStatus, number> = {
        declining: 0,
        new: 1,
        stable: 2,
        improving: 3,
        insufficient: 4,
      };
      return rank[a.status] - rank[b.status]
        || a.currentAccuracy - b.currentAccuracy
        || b.currentAttempts - a.currentAttempts
        || a.label.localeCompare(b.label);
    });
}

function priorityForTrend(row: WeeklyTrendRow): WeeklyStudyPriority | null {
  if (row.currentAttempts < 2) return null;

  let action: WeeklyPriorityAction = 'maintain';
  let multiplier = 1;
  let reason = `${row.label} is broadly steady.`;

  if (row.status === 'declining') {
    action = 'increase';
    multiplier = 1.55;
    reason = `${row.label} declined ${Math.round(Math.abs(row.deltaAccuracy) * 100)} percentage points week over week.`;
  } else if (row.currentAccuracy < 0.60) {
    action = 'increase';
    multiplier = 1.45;
    reason = `${row.label} is currently low at ${Math.round(row.currentAccuracy * 100)}% training accuracy.`;
  } else if (row.currentAccuracy < 0.75) {
    action = 'increase';
    multiplier = row.status === 'improving' ? 1.20 : 1.30;
    reason = row.status === 'improving'
      ? `${row.label} is improving but still needs consolidation at ${Math.round(row.currentAccuracy * 100)}%.`
      : `${row.label} remains below the 75% consolidation threshold.`;
  } else if (
    row.status === 'improving'
    && row.currentAccuracy >= 0.88
    && row.currentAttempts >= 3
  ) {
    action = 'reduce';
    multiplier = 0.85;
    reason = `${row.label} improved to ${Math.round(row.currentAccuracy * 100)}%; slightly less emphasis can preserve time for weaker areas.`;
  } else if (
    row.status === 'stable'
    && row.currentAccuracy >= 0.90
    && row.currentAttempts >= 3
  ) {
    action = 'reduce';
    multiplier = 0.80;
    reason = `${row.label} is stable at ${Math.round(row.currentAccuracy * 100)}%; maintain with lower frequency.`;
  } else if (row.status === 'new') {
    action = 'maintain';
    multiplier = 1.05;
    reason = `${row.label} is new this week; keep a normal sample until a trend is established.`;
  }

  const urgency = (1 - row.currentAccuracy) * 100
    + Math.max(0, -row.deltaAccuracy) * 100
    + Math.min(12, row.currentAttempts) * 0.7;
  const score = urgency * multiplier;

  return {
    domain: row.domain,
    label: row.label,
    action,
    multiplier,
    score,
    reason,
  };
}

function buildPriorities(rows: WeeklyTrendRow[]): WeeklyStudyPriority[] {
  return rows
    .map(priorityForTrend)
    .filter((priority): priority is WeeklyStudyPriority => Boolean(priority))
    .sort((a, b) => {
      const actionRank: Record<WeeklyPriorityAction, number> = { increase: 0, maintain: 1, reduce: 2 };
      return actionRank[a.action] - actionRank[b.action]
        || b.score - a.score
        || a.label.localeCompare(b.label);
    })
    .slice(0, 10);
}

function overallStatus(current: WeeklyWindowSummary, previous: WeeklyWindowSummary): WeeklyCoachReport['overallStatus'] {
  if (current.attempts < 3 || previous.attempts < 3) return 'insufficient';
  const delta = current.accuracy - previous.accuracy;
  if (delta >= 0.05) return 'improving';
  if (delta <= -0.05) return 'declining';
  return 'steady';
}

function reportSummary(
  mode: WeeklyCoachReport['mode'],
  current: WeeklyWindowSummary,
  previous: WeeklyWindowSummary,
  priorities: WeeklyStudyPriority[],
): string {
  if (current.attempts < 3) {
    return mode === 'live'
      ? 'Not enough training attempts this week yet for a reliable week-over-week trend.'
      : 'The completed week contains too few training attempts for strong trend conclusions.';
  }
  if (previous.attempts < 3) {
    return 'This week has training data, but the comparison week is too sparse for a reliable overall trend.';
  }

  const delta = Math.round((current.accuracy - previous.accuracy) * 100);
  const attention = priorities.filter((priority) => priority.action === 'increase').slice(0, 2).map((priority) => priority.label);
  return `${current.attempts} attempts at ${Math.round(current.accuracy * 100)}% accuracy (${delta >= 0 ? '+' : ''}${delta} pp vs last week)${attention.length ? ` · next priority: ${attention.join(', ')}` : ''}.`;
}

function buildReportForWindows(
  analytics: TrainingAnalyticsMemory,
  mode: WeeklyCoachReport['mode'],
  generatedAt: number,
  weekStartAt: number,
  weekEndAt: number,
  compareStartAt: number,
  compareEndAt: number,
): WeeklyCoachReport {
  const currentEvents = eventsInWindow(analytics, weekStartAt, weekEndAt);
  const previousEvents = eventsInWindow(analytics, compareStartAt, compareEndAt);
  const current = summarizeWindow(currentEvents, weekStartAt, weekEndAt);
  const previous = summarizeWindow(previousEvents, compareStartAt, compareEndAt);
  const weaknessTrends = groupTrendRows(
    'weakness',
    currentEvents,
    previousEvents,
    (event) => event.weaknessLabel,
  );
  const openingTrends = groupTrendRows(
    'opening',
    currentEvents,
    previousEvents,
    (event) => event.openingName,
  );
  const priorities = buildPriorities([...weaknessTrends, ...openingTrends]);
  const nextWeekStartAt = startOfLocalWeek(weekStartAt) + WEEK_MS;

  return {
    id: `${mode}:${localDateKey(weekStartAt)}`,
    mode,
    generatedAt,
    weekStartAt,
    weekEndAt,
    compareStartAt,
    compareEndAt,
    current,
    previous,
    overallDeltaAccuracy: current.accuracy - previous.accuracy,
    overallStatus: overallStatus(current, previous),
    weaknessTrends,
    openingTrends,
    nextWeekStartAt,
    nextWeekEndAt: nextWeekStartAt + WEEK_MS,
    priorities,
    summary: reportSummary(mode, current, previous, priorities),
  };
}

export function buildLiveWeeklyCoachReport(
  analytics: TrainingAnalyticsMemory,
  now = Date.now(),
): WeeklyCoachReport {
  const weekStartAt = startOfLocalWeek(now);
  const elapsed = Math.max(1, now - weekStartAt);
  const compareStartAt = weekStartAt - WEEK_MS;
  const compareEndAt = Math.min(weekStartAt, compareStartAt + elapsed);

  return buildReportForWindows(
    analytics,
    'live',
    now,
    weekStartAt,
    now + 1,
    compareStartAt,
    compareEndAt,
  );
}

export function buildCompletedWeeklyCoachReport(
  analytics: TrainingAnalyticsMemory,
  weekStartAt: number,
  generatedAt = Date.now(),
): WeeklyCoachReport {
  const normalizedStart = startOfLocalWeek(weekStartAt);
  return buildReportForWindows(
    analytics,
    'completed',
    generatedAt,
    normalizedStart,
    normalizedStart + WEEK_MS,
    normalizedStart - WEEK_MS,
    normalizedStart,
  );
}

export function syncWeeklyCoachMemory(
  memory: WeeklyCoachMemory,
  analytics: TrainingAnalyticsMemory,
  now = Date.now(),
): WeeklyCoachMemory {
  const currentWeekStart = startOfLocalWeek(now);
  const completedWeekStart = currentWeekStart - WEEK_MS;
  const id = `completed:${localDateKey(completedWeekStart)}`;
  if (memory.reports.some((report) => report.id === id)) return memory;

  const report = buildCompletedWeeklyCoachReport(analytics, completedWeekStart, now);
  return {
    version: 1,
    reports: [...memory.reports, report]
      .sort((a, b) => a.weekStartAt - b.weekStartAt)
      .slice(-MAX_REPORTS),
  };
}

export function activeWeeklyPriorityProfile(
  memory: WeeklyCoachMemory,
  now = Date.now(),
): ActiveWeeklyPriorityProfile {
  const report = memory.reports
    .filter((candidate) => now >= candidate.nextWeekStartAt && now < candidate.nextWeekEndAt)
    .sort((a, b) => b.weekStartAt - a.weekStartAt)[0];

  if (!report) {
    return {
      sourceReportId: null,
      effectiveStartAt: null,
      effectiveEndAt: null,
      multipliers: {},
      reasons: {},
      labels: [],
    };
  }

  const multipliers: Record<string, number> = {};
  const reasons: Record<string, string> = {};

  for (const priority of report.priorities) {
    multipliers[priority.label] = priority.multiplier;
    reasons[priority.label] = priority.reason;
  }

  return {
    sourceReportId: report.id,
    effectiveStartAt: report.nextWeekStartAt,
    effectiveEndAt: report.nextWeekEndAt,
    multipliers,
    reasons,
    labels: report.priorities
      .filter((priority) => priority.action === 'increase')
      .map((priority) => priority.label)
      .slice(0, 5),
  };
}
