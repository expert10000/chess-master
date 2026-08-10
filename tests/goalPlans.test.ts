import { describe, expect, it } from 'vitest';
import type { TrainingAnalyticsEvent, TrainingAnalyticsMemory } from '../src/lib/trainingAnalytics';
import {
  activeGoal,
  completeActiveGoal,
  createGoalPlan,
  emptyGoalPlanMemory,
  evaluateGoalProgress,
  goalPriorityProfile,
  pauseActiveGoal,
  resumeGoal,
} from '../src/lib/goalPlans';
import {
  emptySpacedRepetitionMemory,
  type SpacedItem,
  type SpacedRepetitionMemory,
} from '../src/lib/spacedRepetition';
import { emptyWeaknessMemory, type WeaknessMemory } from '../src/lib/weaknessProfile';

const DAY = 86_400_000;
const NOW = new Date(2026, 7, 10, 12, 0, 0).getTime();
const FEN = '8/8/8/8/8/8/4K3/6k1 w - - 0 1';

function event(
  id: string,
  timestamp: number,
  accepted: boolean,
  options: { openingName?: string; weaknessLabel?: string; points?: number } = {},
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
    openingName: options.openingName,
    weaknessLabel: options.weaknessLabel,
  };
}

function analytics(events: TrainingAnalyticsEvent[]): TrainingAnalyticsMemory {
  return { version: 1, events };
}

function spacedCard(id: string, options: { openingName?: string; weaknessLabel?: string; stable?: boolean } = {}): SpacedItem {
  return {
    id,
    sourceKind: options.openingName ? 'repertoire' : 'weakness',
    sourceId: id,
    signature: id,
    label: id,
    detail: 'test',
    exercise: {
      beforeFen: FEN,
      ply: 1,
      originalMoveSan: 'x',
      originalVerdict: 'Mistake',
      originalLoss: 100,
      bestMoveUci: 'e2e3',
      bestMoveSan: 'Ke3',
      kind: options.openingName ? 'opening' : 'weakness',
      openingName: options.openingName,
      weaknessLabel: options.weaknessLabel,
    },
    createdAt: NOW - 30 * DAY,
    updatedAt: NOW,
    dueAt: NOW + DAY,
    intervalDays: options.stable ? 21 : 3,
    ease: 2.35,
    streak: options.stable ? 4 : 2,
    lapses: 0,
    reviews: 3,
    correct: 3,
    lastReviewedAt: NOW - DAY,
    lastResult: 'correct',
  };
}

describe('v0.9.9 goal-based plans', () => {
  it('creates a six-week opening goal with baseline and milestones', () => {
    const name = 'French Defense · Advance';
    const memory = createGoalPlan(
      emptyGoalPlanMemory(),
      { type: 'opening', durationWeeks: 6, targetLabel: name },
      analytics([
        event('a', NOW - 5 * DAY, true, { openingName: name }),
        event('b', NOW - 4 * DAY, false, { openingName: name }),
      ]),
      emptySpacedRepetitionMemory(),
      NOW,
    );

    const goal = activeGoal(memory)!;
    expect(goal.title).toContain('French');
    expect(goal.durationWeeks).toBe(6);
    expect(goal.baseline.accuracy).toBe(0.5);
    expect(goal.targets.targetAccuracy).toBeGreaterThanOrEqual(0.85);
    expect(goal.milestones).toHaveLength(6);
  });

  it('measures progress only from relevant post-start training attempts', () => {
    const name = 'Missed tactics';
    let memory = createGoalPlan(
      emptyGoalPlanMemory(),
      { type: 'weakness', durationWeeks: 4, targetLabel: name },
      analytics([]),
      emptySpacedRepetitionMemory(),
      NOW,
    );
    const goal = activeGoal(memory)!;
    const progress = evaluateGoalProgress(
      goal,
      analytics([
        event('right-1', NOW + DAY, true, { weaknessLabel: name }),
        event('right-2', NOW + DAY + 1, true, { weaknessLabel: name }),
        event('other', NOW + DAY + 2, false, { weaknessLabel: 'King safety' }),
      ]),
      emptySpacedRepetitionMemory(),
      NOW + 2 * DAY,
    );

    expect(progress.attempts).toBe(2);
    expect(progress.accuracy).toBe(1);
    expect(progress.currentMetric).toBe(100);
  });

  it('creates a rating-preparation goal using readiness rather than claiming Elo progress', () => {
    const events = Array.from({ length: 10 }, (_, index) =>
      event(`e-${index}`, NOW - index * DAY, index < 8, { weaknessLabel: 'Missed tactics', points: 80 })
    );
    const spaced: SpacedRepetitionMemory = { version: 1, items: {} };
    for (let index = 0; index < 5; index += 1) {
      spaced.items[`stable-${index}`] = spacedCard(`stable-${index}`, { weaknessLabel: 'Missed tactics', stable: true });
    }

    const memory = createGoalPlan(
      emptyGoalPlanMemory(),
      { type: 'rating', durationWeeks: 8, targetRating: 2200 },
      analytics(events),
      spaced,
      NOW,
    );
    const goal = activeGoal(memory)!;
    expect(goal.title).toContain('2200');
    expect(goal.baseline.trainingReadiness).not.toBeNull();
    expect(goal.targets.targetReadiness).toBeGreaterThan(goal.baseline.trainingReadiness!);
    expect(goal.targets.targetAccuracy).toBeNull();
  });

  it('boosts the exact opening or weakness used by the active goal', () => {
    const memory = createGoalPlan(
      emptyGoalPlanMemory(),
      { type: 'weakness', durationWeeks: 6, targetLabel: 'King safety' },
      analytics([]),
      emptySpacedRepetitionMemory(),
      NOW,
    );
    const profile = goalPriorityProfile(memory, emptyWeaknessMemory());
    expect(profile.multipliers['King safety']).toBe(1.70);
    expect(profile.labels).toContain('King safety');
  });

  it('rating preparation boosts the current top recurring weaknesses', () => {
    const weakness: WeaknessMemory = emptyWeaknessMemory();
    weakness.categories['missed-tactics'] = {
      id: 'missed-tactics',
      occurrences: 8,
      severity: 24,
      totalLossCp: 1200,
      lastSeenAt: NOW,
      examples: [{
        id: 'x',
        category: 'missed-tactics',
        createdAt: NOW,
        beforeFen: FEN,
        ply: 1,
        originalMoveSan: 'x',
        originalVerdict: 'Mistake',
        originalLoss: 150,
        bestMoveUci: 'e2e3',
        bestMoveSan: 'Ke3',
        kind: 'weakness',
        weaknessLabel: 'Missed tactics',
      }],
    };
    const memory = createGoalPlan(
      emptyGoalPlanMemory(),
      { type: 'rating', durationWeeks: 8, targetRating: 2200 },
      analytics([]),
      emptySpacedRepetitionMemory(),
      NOW,
    );
    const profile = goalPriorityProfile(memory, weakness);
    expect(profile.multipliers['Missed tactics']).toBeGreaterThan(1);
  });

  it('supports pause, resume and complete lifecycle', () => {
    let memory = createGoalPlan(
      emptyGoalPlanMemory(),
      { type: 'opening', durationWeeks: 4, targetLabel: 'French Defense' },
      analytics([]),
      emptySpacedRepetitionMemory(),
      NOW,
    );
    const id = activeGoal(memory)!.id;
    memory = pauseActiveGoal(memory, NOW + 1);
    expect(activeGoal(memory)).toBeNull();
    memory = resumeGoal(memory, id, NOW + 2);
    expect(activeGoal(memory)?.id).toBe(id);
    memory = completeActiveGoal(memory, NOW + 3);
    expect(activeGoal(memory)).toBeNull();
    expect(memory.goals.find((goal) => goal.id === id)?.status).toBe('completed');
  });
});
