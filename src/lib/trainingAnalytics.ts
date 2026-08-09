import type { TrainingAttempt, TrainingExercise, TrainingSource } from './training';
import type { SpacedItem, SpacedRepetitionMemory } from './spacedRepetition';

export const TRAINING_ANALYTICS_STORAGE_KEY = 'stockfish-coach.training-analytics.v1';

export interface TrainingAnalyticsEvent {
  id: string;
  timestamp: number;
  source: TrainingSource;
  exerciseKey: string;
  accepted: boolean;
  points: number;
  hintLevel: number;
  verdict: string;
  attemptedMoveSan: string;
  weaknessLabel?: string;
  openingName?: string;
  spacedSource?: 'repertoire' | 'weakness';
  spacedItemId?: string;
}

export interface TrainingAnalyticsMemory {
  version: 1;
  events: TrainingAnalyticsEvent[];
}

export interface DailyPractice {
  dateKey: string;
  timestamp: number;
  attempts: number;
  correct: number;
  accuracy: number;
  averagePoints: number;
}

export interface AccuracyRow {
  label: string;
  attempts: number;
  correct: number;
  accuracy: number;
  averagePoints: number;
}

export interface ReviewLoadDay {
  dateKey: string;
  timestamp: number;
  count: number;
  repertoire: number;
  weakness: number;
}

export type RetentionStatus = 'stable' | 'growing' | 'fragile' | 'new';

export interface RetentionItem {
  id: string;
  label: string;
  sourceKind: SpacedItem['sourceKind'];
  retention: number;
  status: RetentionStatus;
  intervalDays: number;
  streak: number;
  dueAt: number;
  lastReviewedAt: number | null;
}

export interface RetentionSummary {
  averageRetention: number;
  stable: number;
  growing: number;
  fragile: number;
  newItems: number;
  items: RetentionItem[];
}

const DAY_MS = 86_400_000;
const MAX_EVENTS = 6000;

export function emptyTrainingAnalyticsMemory(): TrainingAnalyticsMemory {
  return { version: 1, events: [] };
}

export function loadTrainingAnalyticsMemory(raw: string | null | undefined): TrainingAnalyticsMemory {
  if (!raw) return emptyTrainingAnalyticsMemory();

  try {
    const parsed = JSON.parse(raw) as Partial<TrainingAnalyticsMemory>;
    if (parsed.version !== 1 || !Array.isArray(parsed.events)) {
      return emptyTrainingAnalyticsMemory();
    }

    const events = parsed.events
      .filter((event): event is TrainingAnalyticsEvent => Boolean(
        event
        && typeof event.id === 'string'
        && typeof event.timestamp === 'number'
        && typeof event.accepted === 'boolean'
      ))
      .slice(-MAX_EVENTS);

    return { version: 1, events };
  } catch {
    return emptyTrainingAnalyticsMemory();
  }
}

export function serializeTrainingAnalyticsMemory(memory: TrainingAnalyticsMemory): string {
  return JSON.stringify(memory);
}

export function recordTrainingAnalyticsEvent(
  memory: TrainingAnalyticsMemory,
  input: {
    source: TrainingSource;
    exercise: TrainingExercise;
    attempt: TrainingAttempt;
    timestamp?: number;
    eventId?: string;
  },
): TrainingAnalyticsMemory {
  const timestamp = input.timestamp ?? Date.now();
  const event: TrainingAnalyticsEvent = {
    id: input.eventId ?? `${timestamp}:${input.exercise.key}:${input.attempt.uci}:${memory.events.length}`,
    timestamp,
    source: input.source,
    exerciseKey: input.exercise.key,
    accepted: input.attempt.accepted,
    points: input.attempt.points,
    hintLevel: input.attempt.hintLevel,
    verdict: input.attempt.review.verdict,
    attemptedMoveSan: input.attempt.san,
    weaknessLabel: input.exercise.weaknessLabel,
    openingName: input.exercise.openingName,
    spacedSource: input.exercise.spacedSource,
    spacedItemId: input.exercise.spacedItemId,
  };

  const events = [...memory.events, event].slice(-MAX_EVENTS);
  return { version: 1, events };
}

function startOfLocalDay(timestamp: number): number {
  const date = new Date(timestamp);
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function localDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function dailyPractice(
  memory: TrainingAnalyticsMemory,
  days = 56,
  now = Date.now(),
): DailyPractice[] {
  const count = Math.max(1, Math.trunc(days));
  const today = startOfLocalDay(now);
  const byDay = new Map<string, TrainingAnalyticsEvent[]>();

  for (const event of memory.events) {
    const key = localDateKey(event.timestamp);
    byDay.set(key, [...(byDay.get(key) ?? []), event]);
  }

  const result: DailyPractice[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    const timestamp = today - offset * DAY_MS;
    const key = localDateKey(timestamp);
    const events = byDay.get(key) ?? [];
    const correct = events.filter((event) => event.accepted).length;
    result.push({
      dateKey: key,
      timestamp,
      attempts: events.length,
      correct,
      accuracy: events.length ? correct / events.length : 0,
      averagePoints: events.length
        ? events.reduce((sum, event) => sum + event.points, 0) / events.length
        : 0,
    });
  }

  return result;
}

function accuracyRows(
  events: TrainingAnalyticsEvent[],
  labelOf: (event: TrainingAnalyticsEvent) => string | undefined,
): AccuracyRow[] {
  const groups = new Map<string, TrainingAnalyticsEvent[]>();

  for (const event of events) {
    const label = labelOf(event);
    if (!label) continue;
    groups.set(label, [...(groups.get(label) ?? []), event]);
  }

  return [...groups.entries()]
    .map(([label, group]) => {
      const correct = group.filter((event) => event.accepted).length;
      return {
        label,
        attempts: group.length,
        correct,
        accuracy: group.length ? correct / group.length : 0,
        averagePoints: group.reduce((sum, event) => sum + event.points, 0) / group.length,
      };
    })
    .sort((a, b) => b.attempts - a.attempts || a.accuracy - b.accuracy || a.label.localeCompare(b.label));
}

export function weaknessAccuracy(memory: TrainingAnalyticsMemory): AccuracyRow[] {
  return accuracyRows(memory.events, (event) => event.weaknessLabel);
}

export function openingAccuracy(memory: TrainingAnalyticsMemory): AccuracyRow[] {
  return accuracyRows(memory.events, (event) => event.openingName);
}

export function sourceAccuracy(memory: TrainingAnalyticsMemory): AccuracyRow[] {
  return accuracyRows(memory.events, (event) => {
    if (event.spacedSource === 'repertoire') return 'Spaced repertoire';
    if (event.spacedSource === 'weakness') return 'Spaced weakness';
    if (event.source === 'opening') return 'Opening deviation';
    if (event.source === 'weakness') return 'Targeted weakness';
    if (event.source === 'mistakes') return 'My mistakes';
    if (event.source === 'reviewed') return 'All reviewed';
    if (event.source === 'due') return 'Due review';
    if (event.source === 'daily') return 'Daily study';
    return event.source;
  });
}

export function recentTrainingSummary(
  memory: TrainingAnalyticsMemory,
  days: number,
  now = Date.now(),
): { attempts: number; correct: number; accuracy: number; activeDays: number; averagePoints: number } {
  const cutoff = now - Math.max(1, days) * DAY_MS;
  const events = memory.events.filter((event) => event.timestamp >= cutoff && event.timestamp <= now);
  const correct = events.filter((event) => event.accepted).length;
  const activeDays = new Set(events.map((event) => localDateKey(event.timestamp))).size;
  return {
    attempts: events.length,
    correct,
    accuracy: events.length ? correct / events.length : 0,
    activeDays,
    averagePoints: events.length
      ? events.reduce((sum, event) => sum + event.points, 0) / events.length
      : 0,
  };
}

export function reviewLoadForecast(
  spaced: SpacedRepetitionMemory,
  days = 30,
  now = Date.now(),
): ReviewLoadDay[] {
  const count = Math.max(1, Math.trunc(days));
  const today = startOfLocalDay(now);
  const result: ReviewLoadDay[] = Array.from({ length: count }, (_, index) => {
    const timestamp = today + index * DAY_MS;
    return {
      dateKey: localDateKey(timestamp),
      timestamp,
      count: 0,
      repertoire: 0,
      weakness: 0,
    };
  });

  for (const item of Object.values(spaced.items)) {
    const effectiveDue = Math.max(today, startOfLocalDay(item.dueAt));
    const index = Math.floor((effectiveDue - today) / DAY_MS);
    if (index < 0 || index >= result.length) continue;
    result[index].count += 1;
    if (item.sourceKind === 'repertoire') result[index].repertoire += 1;
    else result[index].weakness += 1;
  }

  return result;
}

export function forecastCount(forecast: ReviewLoadDay[], days: number): number {
  return forecast
    .slice(0, Math.max(0, Math.trunc(days)))
    .reduce((sum, day) => sum + day.count, 0);
}

function retentionForItem(item: SpacedItem, now: number): number {
  if (item.reviews === 0 || !item.lastReviewedAt) return 0.35;
  if (item.lastResult === 'incorrect') return 0.28;

  const intervalMs = Math.max(0.5, item.intervalDays) * DAY_MS;
  const ageRatio = Math.max(0, now - item.lastReviewedAt) / intervalMs;
  const maturity = Math.min(1, Math.log2(item.intervalDays + 1) / 4.5);
  const streakBonus = Math.min(0.16, item.streak * 0.035);
  const easeBonus = Math.max(-0.05, Math.min(0.08, (item.ease - 2.1) * 0.07));
  const decay = 0.24 * Math.min(2, ageRatio);
  return Math.max(0.12, Math.min(0.98, 0.70 + maturity * 0.16 + streakBonus + easeBonus - decay));
}

function retentionStatus(item: SpacedItem, retention: number): RetentionStatus {
  if (item.reviews === 0) return 'new';
  if (item.lastResult === 'incorrect' || retention < 0.52 || item.lapses > item.correct) return 'fragile';
  if (item.intervalDays >= 14 && item.streak >= 3 && retention >= 0.62) return 'stable';
  if (item.intervalDays >= 3 && item.streak >= 2) return 'growing';
  return 'fragile';
}

export function retentionSummary(
  spaced: SpacedRepetitionMemory,
  now = Date.now(),
): RetentionSummary {
  const items = Object.values(spaced.items)
    .map((item): RetentionItem => {
      const retention = retentionForItem(item, now);
      return {
        id: item.id,
        label: item.label,
        sourceKind: item.sourceKind,
        retention,
        status: retentionStatus(item, retention),
        intervalDays: item.intervalDays,
        streak: item.streak,
        dueAt: item.dueAt,
        lastReviewedAt: item.lastReviewedAt,
      };
    })
    .sort((a, b) => {
      const order: Record<RetentionStatus, number> = { stable: 0, growing: 1, fragile: 2, new: 3 };
      return order[a.status] - order[b.status] || b.retention - a.retention;
    });

  const reviewed = items.filter((item) => item.status !== 'new');
  return {
    averageRetention: reviewed.length
      ? reviewed.reduce((sum, item) => sum + item.retention, 0) / reviewed.length
      : 0,
    stable: items.filter((item) => item.status === 'stable').length,
    growing: items.filter((item) => item.status === 'growing').length,
    fragile: items.filter((item) => item.status === 'fragile').length,
    newItems: items.filter((item) => item.status === 'new').length,
    items,
  };
}

export function stableKnowledge(
  spaced: SpacedRepetitionMemory,
  now = Date.now(),
  limit = 6,
): RetentionItem[] {
  const summary = retentionSummary(spaced, now);
  return summary.items
    .filter((item) => item.status === 'stable' || item.status === 'growing')
    .sort((a, b) => {
      const stabilityA = (a.status === 'stable' ? 100 : 0) + a.intervalDays + a.streak * 2 + a.retention * 10;
      const stabilityB = (b.status === 'stable' ? 100 : 0) + b.intervalDays + b.streak * 2 + b.retention * 10;
      return stabilityB - stabilityA;
    })
    .slice(0, Math.max(1, limit));
}
