import { describe, expect, it } from 'vitest';
import type { TrainingAttempt } from '../src/lib/training';
import {
  appendDailySessionAttempt,
  beginDailyStudySession,
  buildDailySessionReport,
  dailySessionAttemptedCount,
  emptyDailySessionReportMemory,
  latestDailySessionReport,
  loadDailySessionReportMemory,
  saveDailySessionReport,
  serializeDailySessionReportMemory,
} from '../src/lib/dailySessionReport';
import type { DailyStudyPlan } from '../src/lib/dailyStudyPlanner';
import {
  emptySpacedRepetitionMemory,
  type SpacedItem,
  type SpacedRepetitionMemory,
} from '../src/lib/spacedRepetition';

const NOW = new Date(2026, 7, 10, 12, 0, 0).getTime();
const DAY = 86_400_000;
const FEN = '8/8/8/8/8/8/4K3/6k1 w - - 0 1';

function spacedItem(id: string, intervalDays = 3, dueAt = NOW): SpacedItem {
  return {
    id,
    sourceKind: 'repertoire',
    sourceId: id,
    signature: id,
    label: `Opening · ${id}`,
    detail: 'test',
    exercise: {
      beforeFen: FEN,
      ply: 1,
      originalMoveSan: 'Recall',
      originalVerdict: 'Good',
      originalLoss: 0,
      bestMoveUci: 'e2e3',
      bestMoveSan: 'Ke3',
      kind: 'opening',
      openingName: `Opening ${id}`,
      expectedMoves: ['e2e3'],
      expectedMoveSans: ['Ke3'],
    },
    createdAt: NOW - 20 * DAY,
    updatedAt: NOW,
    dueAt,
    intervalDays,
    ease: 2.35,
    streak: 2,
    lapses: 0,
    reviews: 2,
    correct: 2,
    lastReviewedAt: NOW - intervalDays * DAY,
    lastResult: 'correct',
  };
}

function plan(): DailyStudyPlan {
  return {
    dateKey: '2026-08-10',
    generatedAt: NOW,
    durationMinutes: 20,
    targetPositions: 2,
    estimatedMinutes: 3,
    counts: { dueRepertoire: 1, weakestAreas: 1, recentMistakes: 0, newMaterial: 0 },
    weakestLabels: ['Missed tactics'],
    summary: 'test',
    items: [
      {
        id: 'a',
        source: 'due-repertoire',
        sourceLabel: 'Due repertoire',
        reason: 'due',
        exercise: {
          key: 'daily-a',
          recordId: 1,
          ply: 1,
          beforeFen: FEN,
          originalMoveSan: 'Recall',
          originalVerdict: 'Good',
          originalLoss: 0,
          bestMoveUci: 'e2e3',
          bestMoveSan: 'Ke3',
          kind: 'opening',
          openingName: 'Test opening',
          expectedMoves: ['e2e3'],
          expectedMoveSans: ['Ke3'],
          spacedItemId: 'rep-a',
          spacedSource: 'repertoire',
          dailySource: 'due-repertoire',
          dailySourceLabel: 'Due repertoire',
          dailyReason: 'Due now',
        },
      },
      {
        id: 'b',
        source: 'weakest-area',
        sourceLabel: 'Missed tactics',
        reason: 'weak',
        exercise: {
          key: 'daily-b',
          recordId: 2,
          ply: 2,
          beforeFen: FEN,
          originalMoveSan: 'Kf2',
          originalVerdict: 'Mistake',
          originalLoss: 140,
          bestMoveUci: 'e2e3',
          bestMoveSan: 'Ke3',
          kind: 'weakness',
          weaknessLabel: 'Missed tactics',
          dailySource: 'weakest-area',
          dailySourceLabel: 'Missed tactics',
          dailyReason: 'Recurring weakness',
        },
      },
    ],
  };
}

function attempt(accepted: boolean, points: number, hintLevel = 0): TrainingAttempt {
  return {
    uci: 'e2e3',
    san: 'Ke3',
    accepted,
    points,
    hintLevel,
    review: {
      beforeFen: FEN,
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

describe('v0.9.7 daily session report', () => {
  it('summarizes clean solves, recovery and failures per planned position', () => {
    const spaced: SpacedRepetitionMemory = emptySpacedRepetitionMemory();
    spaced.items['rep-a'] = spacedItem('rep-a');
    let session = beginDailyStudySession(plan(), spaced, NOW);

    session = appendDailySessionAttempt(session, plan().items[0].exercise, attempt(true, 100), NOW + 1);
    session = appendDailySessionAttempt(session, plan().items[1].exercise, attempt(false, 10), NOW + 2);
    session = appendDailySessionAttempt(session, plan().items[1].exercise, attempt(true, 82, 1), NOW + 3);

    expect(dailySessionAttemptedCount(session)).toBe(2);

    const report = buildDailySessionReport(session, spaced, NOW + 4);
    expect(report.solvedPositions).toBe(2);
    expect(report.cleanFirstTry).toBe(1);
    expect(report.recoveredPositions).toBe(1);
    expect(report.hintAssisted).toBe(1);
    expect(report.failedPositions).toBe(0);
  });

  it('reports spaced schedule expansion from the session-start snapshot', () => {
    const spacedBefore: SpacedRepetitionMemory = emptySpacedRepetitionMemory();
    spacedBefore.items['rep-a'] = spacedItem('rep-a', 3, NOW);
    let session = beginDailyStudySession(plan(), spacedBefore, NOW);
    session = appendDailySessionAttempt(session, plan().items[0].exercise, attempt(true, 100), NOW + 1);

    const spacedAfter: SpacedRepetitionMemory = {
      version: 1,
      items: {
        ...spacedBefore.items,
        'rep-a': {
          ...spacedBefore.items['rep-a'],
          intervalDays: 7.1,
          dueAt: NOW + 7.1 * DAY,
          streak: 3,
          reviews: 3,
          correct: 3,
          lastReviewedAt: NOW,
          lastResult: 'correct',
        },
      },
    };

    const report = buildDailySessionReport(session, spacedAfter, NOW + 2);
    expect(report.scheduleChanges).toHaveLength(1);
    expect(report.scheduleChanges[0].result).toBe('expanded');
    expect(report.scheduleChanges[0].beforeIntervalDays).toBe(3);
    expect(report.scheduleChanges[0].afterIntervalDays).toBe(7.1);
  });

  it('recommends a longer tomorrow session after many failures', () => {
    const expandedPlan: DailyStudyPlan = {
      ...plan(),
      targetPositions: 6,
      items: Array.from({ length: 6 }, (_, index) => ({
        ...plan().items[1],
        id: `w-${index}`,
        exercise: {
          ...plan().items[1].exercise,
          key: `daily-w-${index}`,
          beforeFen: `${FEN} ${index}`,
        },
      })),
      counts: { dueRepertoire: 0, weakestAreas: 6, recentMistakes: 0, newMaterial: 0 },
    };
    let session = beginDailyStudySession(expandedPlan, emptySpacedRepetitionMemory(), NOW);
    for (const item of expandedPlan.items) {
      session = appendDailySessionAttempt(session, item.exercise, attempt(false, 10), NOW + 10);
    }

    const report = buildDailySessionReport(session, emptySpacedRepetitionMemory(), NOW + 20);
    expect(report.failedPositions).toBe(6);
    expect(report.tomorrow.durationMinutes).toBe(30);
    expect(report.tomorrow.newMaterialLimit).toBe(0);
    expect(report.tomorrow.focusLabels).toContain('Missed tactics');
  });

  it('recommends a light consolidation day after a strong session with low due load', () => {
    let session = beginDailyStudySession(plan(), emptySpacedRepetitionMemory(), NOW);
    session = {
      ...session,
      plannedCount: 5,
      plannedExerciseKeys: ['a','b','c','d','e'],
      plannedLabels: { a:'A', b:'B', c:'C', d:'D', e:'E' },
    };
    for (const key of session.plannedExerciseKeys) {
      session = appendDailySessionAttempt(
        session,
        {
          ...plan().items[1].exercise,
          key,
          dailySource: 'weakest-area',
          dailySourceLabel: 'Missed tactics',
        },
        attempt(true, 95),
        NOW + 1,
      );
    }

    const report = buildDailySessionReport(session, emptySpacedRepetitionMemory(), NOW + 2);
    expect(report.tomorrow.durationMinutes).toBe(15);
  });

  it('persists the most recent report locally', () => {
    let session = beginDailyStudySession(plan(), emptySpacedRepetitionMemory(), NOW);
    session = appendDailySessionAttempt(session, plan().items[1].exercise, attempt(true, 90), NOW + 1);
    const report = buildDailySessionReport(session, emptySpacedRepetitionMemory(), NOW + 2);

    const memory = saveDailySessionReport(emptyDailySessionReportMemory(), report);
    const restored = loadDailySessionReportMemory(serializeDailySessionReportMemory(memory));
    expect(latestDailySessionReport(restored)?.id).toBe(report.id);
  });
});
