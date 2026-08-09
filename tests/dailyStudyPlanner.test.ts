import { describe, expect, it } from 'vitest';
import type { PlyRecord } from '../src/components/MoveList';
import type { MoveReview } from '../src/lib/chessCoach';
import {
  buildAdaptiveDailyStudyPlan,
  targetPositionsForDuration,
} from '../src/lib/dailyStudyPlanner';
import {
  emptySpacedRepetitionMemory,
  type SpacedItem,
  type SpacedRepetitionMemory,
} from '../src/lib/spacedRepetition';
import {
  emptyWeaknessMemory,
  type WeaknessMemory,
  type WeaknessTrainingSnapshot,
} from '../src/lib/weaknessProfile';

const NOW = new Date(2026, 7, 9, 12, 0, 0).getTime();
const FEN = '8/8/8/8/8/8/4K3/6k1 w - - 0 1';

function spacedItem(
  id: string,
  sourceKind: 'repertoire' | 'weakness',
  reviews: number,
  dueAt: number,
  suffix: number,
): SpacedItem {
  return {
    id,
    sourceKind,
    sourceId: id,
    signature: id,
    label: id,
    detail: 'test',
    exercise: {
      beforeFen: FEN.replace('4K3', `${suffix % 7 + 1}K${6 - suffix % 7}`),
      ply: 1,
      originalMoveSan: 'Kh3',
      originalVerdict: 'Mistake',
      originalLoss: 100,
      bestMoveUci: 'e2e3',
      bestMoveSan: 'Ke3',
      kind: sourceKind === 'repertoire' ? 'opening' : 'weakness',
      openingName: sourceKind === 'repertoire' ? `Opening ${suffix}` : undefined,
      weaknessLabel: sourceKind === 'weakness' ? 'Missed tactics' : undefined,
      expectedMoves: sourceKind === 'repertoire' ? ['e2e3'] : undefined,
      expectedMoveSans: sourceKind === 'repertoire' ? ['Ke3'] : undefined,
    },
    createdAt: NOW - suffix * 1000,
    updatedAt: NOW,
    dueAt,
    intervalDays: reviews ? 3 : 0,
    ease: 2.35,
    streak: reviews ? 2 : 0,
    lapses: 0,
    reviews,
    correct: reviews,
    lastReviewedAt: reviews ? NOW - 3 * 86_400_000 : null,
    lastResult: reviews ? 'correct' : null,
  };
}

function review(verdict: 'Inaccuracy' | 'Mistake' | 'Blunder' = 'Mistake'): MoveReview {
  return {
    beforeFen: FEN,
    playedUci: 'e2f2',
    bestMoveUci: 'e2e3',
    concepts: [],
    verdict,
    centipawnLoss: 140,
    title: 'test',
    summary: 'test',
    reasons: [],
    bestMoveSan: 'Ke3',
    playedLineSan: [],
    bestLineSan: [],
    playedLineUci: [],
    bestLineUci: [],
    bestEvaluation: '0.00',
    playedEvaluation: '-1.40',
    bestScoreCpWhite: 0,
    playedScoreCpWhite: -140,
    bestMateWhite: null,
    playedMateWhite: null,
  };
}

function recentRecord(id: number): PlyRecord {
  return {
    id,
    ply: id,
    beforeFen: FEN.replace('4K3', `${id % 7 + 1}K${6 - id % 7}`),
    afterFen: FEN,
    uci: 'e2f2',
    san: 'Kf2',
    color: 'w',
    review: review(),
  };
}

function weaknessMemory(count = 8): WeaknessMemory {
  const memory = emptyWeaknessMemory();
  const examples: WeaknessTrainingSnapshot[] = Array.from({ length: count }, (_, index) => ({
    id: `weak-${index}`,
    category: 'missed-tactics',
    createdAt: NOW - index * 1000,
    beforeFen: FEN.replace('4K3', `${index % 7 + 1}K${6 - index % 7}`),
    ply: index + 1,
    originalMoveSan: 'Kf2',
    originalVerdict: 'Mistake',
    originalLoss: 150,
    bestMoveUci: 'e2e3',
    bestMoveSan: 'Ke3',
    kind: 'weakness',
    weaknessLabel: 'Missed tactics',
  }));
  memory.categories['missed-tactics'] = {
    id: 'missed-tactics',
    occurrences: count,
    severity: count * 3,
    totalLossCp: count * 150,
    lastSeenAt: NOW,
    examples,
  };
  return memory;
}

describe('v0.9.6 adaptive daily study planner', () => {
  it('maps 15/20/30 minute sessions to bounded position targets', () => {
    expect(targetPositionsForDuration(15)).toBe(10);
    expect(targetPositionsForDuration(20)).toBe(13);
    expect(targetPositionsForDuration(30)).toBe(20);
  });

  it('keeps new material deliberately small in a 20-minute plan', () => {
    const spaced: SpacedRepetitionMemory = emptySpacedRepetitionMemory();
    for (let index = 0; index < 8; index += 1) {
      spaced.items[`rep-${index}`] = spacedItem(`rep-${index}`, 'repertoire', 3, NOW - 1000 - index, index);
    }
    for (let index = 0; index < 8; index += 1) {
      spaced.items[`new-${index}`] = spacedItem(`new-${index}`, 'weakness', 0, NOW, 20 + index);
    }

    const plan = buildAdaptiveDailyStudyPlan({
      durationMinutes: 20,
      now: NOW,
      spacedMemory: spaced,
      weaknessMemory: weaknessMemory(),
      records: [recentRecord(20), recentRecord(21), recentRecord(22)],
      humanColor: 'w',
    });

    expect(plan.targetPositions).toBe(13);
    expect(plan.items.length).toBeGreaterThan(8);
    expect(plan.counts.newMaterial).toBeLessThanOrEqual(1);
    expect(plan.counts.dueRepertoire).toBeGreaterThan(0);
    expect(plan.counts.weakestAreas).toBeGreaterThan(0);
  });

  it('prioritizes reviewed due repertoire rather than treating brand-new cards as overdue review', () => {
    const spaced: SpacedRepetitionMemory = emptySpacedRepetitionMemory();
    spaced.items.old = spacedItem('old', 'repertoire', 4, NOW - 86_400_000, 1);
    spaced.items.new = spacedItem('new', 'repertoire', 0, NOW, 2);

    const plan = buildAdaptiveDailyStudyPlan({
      durationMinutes: 15,
      now: NOW,
      spacedMemory: spaced,
      weaknessMemory: emptyWeaknessMemory(),
      records: [],
      humanColor: 'w',
    });

    expect(plan.counts.dueRepertoire).toBe(1);
    expect(plan.counts.newMaterial).toBe(1);
  });

  it('adds recent reviewed mistakes from the current game', () => {
    const plan = buildAdaptiveDailyStudyPlan({
      durationMinutes: 15,
      now: NOW,
      spacedMemory: emptySpacedRepetitionMemory(),
      weaknessMemory: emptyWeaknessMemory(),
      records: [recentRecord(9), recentRecord(10)],
      humanColor: 'w',
    });

    expect(plan.counts.recentMistakes).toBe(2);
    expect(plan.items.some((item) => item.source === 'recent-mistake')).toBe(true);
  });

  it('deduplicates the same position and answer across overlapping buckets', () => {
    const spaced: SpacedRepetitionMemory = emptySpacedRepetitionMemory();
    spaced.items.same = spacedItem('same', 'weakness', 0, NOW, 0);
    const weak = weaknessMemory(1);
    weak.categories['missed-tactics'].examples[0].beforeFen = spaced.items.same.exercise.beforeFen;
    weak.categories['missed-tactics'].examples[0].bestMoveUci = spaced.items.same.exercise.bestMoveUci;

    const plan = buildAdaptiveDailyStudyPlan({
      durationMinutes: 15,
      now: NOW,
      spacedMemory: spaced,
      weaknessMemory: weak,
      records: [],
      humanColor: 'w',
    });

    const fingerprints = plan.items.map((item) => `${item.exercise.beforeFen}|${item.exercise.bestMoveUci}`);
    expect(new Set(fingerprints).size).toBe(fingerprints.length);
  });

  it('returns a shorter honest plan when insufficient material exists', () => {
    const plan = buildAdaptiveDailyStudyPlan({
      durationMinutes: 30,
      now: NOW,
      spacedMemory: emptySpacedRepetitionMemory(),
      weaknessMemory: emptyWeaknessMemory(),
      records: [recentRecord(1)],
      humanColor: 'w',
    });

    expect(plan.items.length).toBe(1);
    expect(plan.estimatedMinutes).toBeLessThan(30);
    expect(plan.summary).toContain('available positions');
  });
});


describe('v0.9.8 weekly coach priority integration', () => {
  it('uses a weekly opening boost to order equally-due repertoire candidates', () => {
    const spaced: SpacedRepetitionMemory = emptySpacedRepetitionMemory();
    spaced.items.french = spacedItem('french', 'repertoire', 3, NOW - 1000, 1);
    spaced.items.najdorf = spacedItem('najdorf', 'repertoire', 3, NOW - 1000, 2);
    spaced.items.french.exercise.openingName = 'French Defense · Advance';
    spaced.items.najdorf.exercise.openingName = 'Sicilian Defense · Najdorf';

    const plan = buildAdaptiveDailyStudyPlan({
      durationMinutes: 15,
      now: NOW,
      spacedMemory: spaced,
      weaknessMemory: emptyWeaknessMemory(),
      records: [],
      humanColor: 'w',
      weeklyPriorityMultipliers: {
        'French Defense · Advance': 1.55,
        'Sicilian Defense · Najdorf': 0.80,
      },
      weeklyPriorityReasons: {
        'French Defense · Advance': 'Declining week-over-week recall.',
      },
    });

    const firstDue = plan.items.find((item) => item.source === 'due-repertoire')!;
    expect(firstDue.exercise.openingName).toBe('French Defense · Advance');
    expect(plan.weeklyAdjusted).toBe(true);
    expect(plan.weeklyPriorityLabels).toContain('French Defense · Advance');
  });
});
