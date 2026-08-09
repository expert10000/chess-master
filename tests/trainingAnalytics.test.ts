import { describe, expect, it } from 'vitest';
import type { TrainingAttempt, TrainingExercise } from '../src/lib/training';
import {
  dailyPractice,
  emptyTrainingAnalyticsMemory,
  forecastCount,
  openingAccuracy,
  recordTrainingAnalyticsEvent,
  retentionSummary,
  reviewLoadForecast,
  serializeTrainingAnalyticsMemory,
  loadTrainingAnalyticsMemory,
  stableKnowledge,
  weaknessAccuracy,
} from '../src/lib/trainingAnalytics';
import {
  emptySpacedRepetitionMemory,
  type SpacedItem,
  type SpacedRepetitionMemory,
} from '../src/lib/spacedRepetition';

const DAY = 86_400_000;
const NOW = new Date(2026, 7, 9, 12, 0, 0).getTime();

function exercise(overrides: Partial<TrainingExercise> = {}): TrainingExercise {
  return {
    key: 'x',
    recordId: 1,
    ply: 10,
    beforeFen: '8/8/8/8/8/8/4K3/6k1 w - - 0 1',
    originalMoveSan: 'Kh3',
    originalVerdict: 'Mistake',
    originalLoss: 120,
    bestMoveUci: 'e2e3',
    bestMoveSan: 'Ke3',
    kind: 'weakness',
    weaknessLabel: 'King safety',
    ...overrides,
  };
}

function attempt(accepted: boolean, points = accepted ? 88 : 15): TrainingAttempt {
  return {
    uci: 'e2e3',
    san: 'Ke3',
    accepted,
    points,
    hintLevel: 0,
    review: {
      beforeFen: '8/8/8/8/8/8/4K3/6k1 w - - 0 1',
      playedUci: 'e2e3',
      bestMoveUci: 'e2e3',
      concepts: [],
      verdict: accepted ? 'Excellent' : 'Mistake',
      centipawnLoss: accepted ? 0 : 120,
      title: 'test',
      summary: 'test',
      reasons: [],
      bestMoveSan: 'Ke3',
      playedLineSan: [],
      bestLineSan: [],
      playedLineUci: [],
      bestLineUci: [],
      bestEvaluation: '0.00',
      playedEvaluation: '0.00',
      bestScoreCpWhite: 0,
      playedScoreCpWhite: 0,
      bestMateWhite: null,
      playedMateWhite: null,
    },
  };
}

function spacedItem(id: string, overrides: Partial<SpacedItem> = {}): SpacedItem {
  return {
    id,
    sourceKind: 'weakness',
    sourceId: id,
    signature: id,
    label: id,
    detail: 'test',
    exercise: {
      beforeFen: '8/8/8/8/8/8/4K3/6k1 w - - 0 1',
      ply: 1,
      originalMoveSan: 'Kh3',
      originalVerdict: 'Mistake',
      originalLoss: 120,
      bestMoveUci: 'e2e3',
      bestMoveSan: 'Ke3',
      kind: 'weakness',
    },
    createdAt: NOW - 30 * DAY,
    updatedAt: NOW,
    dueAt: NOW + DAY,
    intervalDays: 14,
    ease: 2.4,
    streak: 4,
    lapses: 0,
    reviews: 4,
    correct: 4,
    lastReviewedAt: NOW - 2 * DAY,
    lastResult: 'correct',
    ...overrides,
  };
}

describe('v0.9.5 training analytics', () => {
  it('records and persists daily practice attempts', () => {
    let memory = emptyTrainingAnalyticsMemory();
    memory = recordTrainingAnalyticsEvent(memory, {
      source: 'weakness',
      exercise: exercise(),
      attempt: attempt(true),
      timestamp: NOW,
      eventId: 'a',
    });
    memory = recordTrainingAnalyticsEvent(memory, {
      source: 'weakness',
      exercise: exercise(),
      attempt: attempt(false),
      timestamp: NOW,
      eventId: 'b',
    });

    const restored = loadTrainingAnalyticsMemory(serializeTrainingAnalyticsMemory(memory));
    const today = dailyPractice(restored, 1, NOW)[0];
    expect(today.attempts).toBe(2);
    expect(today.correct).toBe(1);
    expect(today.accuracy).toBe(0.5);
  });

  it('aggregates accuracy by weakness and opening', () => {
    let memory = emptyTrainingAnalyticsMemory();
    memory = recordTrainingAnalyticsEvent(memory, {
      source: 'weakness',
      exercise: exercise({ weaknessLabel: 'Missed tactics' }),
      attempt: attempt(true),
      timestamp: NOW,
      eventId: 'w1',
    });
    memory = recordTrainingAnalyticsEvent(memory, {
      source: 'opening',
      exercise: exercise({
        kind: 'opening',
        weaknessLabel: undefined,
        openingName: 'Sicilian Defense · Najdorf',
      }),
      attempt: attempt(false),
      timestamp: NOW,
      eventId: 'o1',
    });

    expect(weaknessAccuracy(memory)[0].label).toBe('Missed tactics');
    expect(weaknessAccuracy(memory)[0].accuracy).toBe(1);
    expect(openingAccuracy(memory)[0].label).toContain('Najdorf');
    expect(openingAccuracy(memory)[0].accuracy).toBe(0);
  });

  it('forecasts the current 7/30-day due load from card due dates', () => {
    const spaced: SpacedRepetitionMemory = {
      version: 1,
      items: {
        a: spacedItem('a', { dueAt: NOW - DAY, sourceKind: 'repertoire' }),
        b: spacedItem('b', { dueAt: NOW + 3 * DAY }),
        c: spacedItem('c', { dueAt: NOW + 20 * DAY }),
      },
    };

    const forecast = reviewLoadForecast(spaced, 30, NOW);
    expect(forecastCount(forecast, 7)).toBe(2);
    expect(forecastCount(forecast, 30)).toBe(3);
    expect(forecast[0].count).toBe(1);
  });

  it('classifies well-learned cards as stable and exposes them as stable knowledge', () => {
    const spaced: SpacedRepetitionMemory = {
      version: 1,
      items: {
        stable: spacedItem('Stable Najdorf move', {
          intervalDays: 21,
          streak: 5,
          lastReviewedAt: NOW - 2 * DAY,
          dueAt: NOW + 19 * DAY,
        }),
      },
    };

    const summary = retentionSummary(spaced, NOW);
    expect(summary.stable).toBe(1);
    expect(summary.averageRetention).toBeGreaterThan(0.6);
    expect(stableKnowledge(spaced, NOW)[0].status).toBe('stable');
  });

  it('keeps new or failed cards outside the stable group', () => {
    const spaced: SpacedRepetitionMemory = {
      version: 1,
      items: {
        new: spacedItem('new', {
          intervalDays: 0,
          streak: 0,
          reviews: 0,
          correct: 0,
          lastReviewedAt: null,
          lastResult: null,
          dueAt: NOW,
        }),
        failed: spacedItem('failed', {
          intervalDays: 0,
          streak: 0,
          reviews: 3,
          correct: 1,
          lapses: 2,
          lastResult: 'incorrect',
          lastReviewedAt: NOW - 10 * 60_000,
          dueAt: NOW,
        }),
      },
    };

    const summary = retentionSummary(spaced, NOW);
    expect(summary.newItems).toBe(1);
    expect(summary.fragile).toBe(1);
    expect(summary.stable).toBe(0);
  });

  it('handles an empty scheduler cleanly', () => {
    const summary = retentionSummary(emptySpacedRepetitionMemory(), NOW);
    expect(summary.averageRetention).toBe(0);
    expect(summary.items).toHaveLength(0);
  });
});
