import { describe, expect, it } from 'vitest';
import type { TrainingAnalyticsEvent, TrainingAnalyticsMemory } from '../src/lib/trainingAnalytics';
import {
  activeWeeklyPriorityProfile,
  buildCompletedWeeklyCoachReport,
  buildLiveWeeklyCoachReport,
  emptyWeeklyCoachMemory,
  startOfLocalWeek,
  syncWeeklyCoachMemory,
} from '../src/lib/weeklyCoach';

const DAY = 86_400_000;
const NOW = new Date(2026, 7, 12, 12, 0, 0).getTime(); // Wednesday
const THIS_WEEK = startOfLocalWeek(NOW);

function event(
  id: string,
  timestamp: number,
  accepted: boolean,
  options: { weaknessLabel?: string; openingName?: string; points?: number } = {},
): TrainingAnalyticsEvent {
  return {
    id,
    timestamp,
    source: options.openingName ? 'opening' : 'weakness',
    exerciseKey: id,
    accepted,
    points: options.points ?? (accepted ? 90 : 30),
    hintLevel: 0,
    verdict: accepted ? 'Excellent' : 'Mistake',
    attemptedMoveSan: 'Nf3',
    weaknessLabel: options.weaknessLabel,
    openingName: options.openingName,
  };
}

function analytics(events: TrainingAnalyticsEvent[]): TrainingAnalyticsMemory {
  return { version: 1, events };
}

describe('v0.9.8 weekly coach report', () => {
  it('compares week-to-date with the same elapsed part of last week', () => {
    const memory = analytics([
      event('current-a', THIS_WEEK + DAY, true, { weaknessLabel: 'Missed tactics' }),
      event('current-b', THIS_WEEK + DAY + 1, true, { weaknessLabel: 'Missed tactics' }),
      event('previous-a', THIS_WEEK - 7 * DAY + DAY, false, { weaknessLabel: 'Missed tactics' }),
      event('previous-b', THIS_WEEK - 7 * DAY + DAY + 1, true, { weaknessLabel: 'Missed tactics' }),
    ]);

    const report = buildLiveWeeklyCoachReport(memory, NOW);
    expect(report.current.attempts).toBe(2);
    expect(report.previous.attempts).toBe(2);
    expect(report.weaknessTrends[0].label).toBe('Missed tactics');
    expect(report.weaknessTrends[0].status).toBe('improving');
  });

  it('detects declining opening recall and assigns an increased priority', () => {
    const currentStart = THIS_WEEK - 7 * DAY;
    const events: TrainingAnalyticsEvent[] = [
      event('c1', currentStart + DAY, false, { openingName: 'French Defense · Advance' }),
      event('c2', currentStart + DAY + 1, true, { openingName: 'French Defense · Advance' }),
      event('c3', currentStart + DAY + 2, false, { openingName: 'French Defense · Advance' }),
      event('p1', currentStart - 7 * DAY + DAY, true, { openingName: 'French Defense · Advance' }),
      event('p2', currentStart - 7 * DAY + DAY + 1, true, { openingName: 'French Defense · Advance' }),
      event('p3', currentStart - 7 * DAY + DAY + 2, true, { openingName: 'French Defense · Advance' }),
    ];

    const report = buildCompletedWeeklyCoachReport(analytics(events), currentStart, NOW);
    const trend = report.openingTrends.find((row) => row.label.includes('French'))!;
    const priority = report.priorities.find((row) => row.label.includes('French'))!;

    expect(trend.status).toBe('declining');
    expect(priority.action).toBe('increase');
    expect(priority.multiplier).toBeGreaterThan(1.4);
  });

  it('reduces emphasis for a stable very-high-accuracy area', () => {
    const currentStart = THIS_WEEK - 7 * DAY;
    const events: TrainingAnalyticsEvent[] = [];
    for (let index = 0; index < 4; index += 1) {
      events.push(event(`c${index}`, currentStart + DAY + index, true, { weaknessLabel: 'Development' }));
      events.push(event(`p${index}`, currentStart - 7 * DAY + DAY + index, true, { weaknessLabel: 'Development' }));
    }

    const report = buildCompletedWeeklyCoachReport(analytics(events), currentStart, NOW);
    const priority = report.priorities.find((row) => row.label === 'Development')!;
    expect(priority.action).toBe('reduce');
    expect(priority.multiplier).toBeLessThan(1);
  });

  it('freezes the previous completed week and activates its priorities for the current week', () => {
    const completedWeekStart = THIS_WEEK - 7 * DAY;
    const events = [
      event('c1', completedWeekStart + DAY, false, { weaknessLabel: 'King safety' }),
      event('c2', completedWeekStart + DAY + 1, false, { weaknessLabel: 'King safety' }),
      event('p1', completedWeekStart - 7 * DAY + DAY, true, { weaknessLabel: 'King safety' }),
      event('p2', completedWeekStart - 7 * DAY + DAY + 1, true, { weaknessLabel: 'King safety' }),
    ];

    const synced = syncWeeklyCoachMemory(emptyWeeklyCoachMemory(), analytics(events), NOW);
    expect(synced.reports).toHaveLength(1);

    const active = activeWeeklyPriorityProfile(synced, NOW);
    expect(active.sourceReportId).not.toBeNull();
    expect(active.multipliers['King safety']).toBeGreaterThan(1);
    expect(active.labels).toContain('King safety');
  });

  it('does not call one isolated attempt a reliable trend', () => {
    const report = buildLiveWeeklyCoachReport(
      analytics([event('one', THIS_WEEK + DAY, false, { weaknessLabel: 'Pawn structure' })]),
      NOW,
    );
    expect(report.weaknessTrends[0].status).toBe('insufficient');
    expect(report.priorities.some((row) => row.label === 'Pawn structure')).toBe(false);
  });
});
