import { describe, expect, it } from 'vitest';
import {
  interventionTrainingType,
  interventionTrainingTypeLabel,
  rankInterventionHistoryRecords,
  type InterventionHistoryRecord,
  type InterventionTrainingType,
} from '../src/lib/interventionHistoryAnalytics';

function record(
  id: string,
  type: InterventionTrainingType,
  completedAt: number,
  cplImprovement: number,
  blunderReduction: number,
  verdict: InterventionHistoryRecord['verdict'] = 'improved',
): InterventionHistoryRecord {
  return {
    interventionId: id,
    title: id,
    trainingType: type,
    trainingTypeLabel: interventionTrainingTypeLabel(type),
    completedAt,
    checkpointGames: 20,
    verdict,
    cplImprovement,
    blunderReduction,
    issueReduction: blunderReduction * 1.5,
    plannedPositions: 7,
    attemptedPositions: 7,
    solvedPositions: 6,
    solveRate: 6 / 7,
  };
}

describe('v1.0.8 intervention history analytics', () => {
  it('groups coach recommendation kinds into understandable training types', () => {
    expect(interventionTrainingType('phase-gap')).toBe('phase-training');
    expect(interventionTrainingType('phase-decline')).toBe('phase-training');
    expect(interventionTrainingType('opening')).toBe('opening-repair');
    expect(interventionTrainingType('color-gap')).toBe('color-side-training');
    expect(interventionTrainingType('blunders')).toBe('blunder-drills');
    expect(interventionTrainingType('overall-decline')).toBe('overall-performance');
  });

  it('ranks by average CPL improvement before secondary tie breakers', () => {
    const analytics = rankInterventionHistoryRecords([
      record('phase-1', 'phase-training', 100, 24, 0.20),
      record('phase-2', 'phase-training', 200, 18, 0.15),
      record('opening-1', 'opening-repair', 300, 11, 0.40),
      record('opening-2', 'opening-repair', 400, 13, 0.50),
    ]);

    expect(analytics.rows[0].trainingType).toBe('phase-training');
    expect(Math.round(analytics.rows[0].avgCplImprovement!)).toBe(21);
    expect(analytics.rows[1].trainingType).toBe('opening-repair');
  });

  it('uses blunder reduction as the next ranking criterion when CPL improvement ties', () => {
    const analytics = rankInterventionHistoryRecords([
      record('phase-1', 'phase-training', 100, 15, 0.10),
      record('opening-1', 'opening-repair', 200, 15, 0.35),
    ]);
    expect(analytics.rows[0].trainingType).toBe('opening-repair');
  });

  it('marks small samples as provisional and larger histories as developing/established', () => {
    const records = [
      record('p1', 'phase-training', 100, 10, 0.1),
      record('o1', 'opening-repair', 101, 8, 0.1),
      record('o2', 'opening-repair', 102, 8, 0.1),
      record('o3', 'opening-repair', 103, 8, 0.1),
      record('b1', 'blunder-drills', 104, 7, 0.1),
      record('b2', 'blunder-drills', 105, 7, 0.1),
      record('b3', 'blunder-drills', 106, 7, 0.1),
      record('b4', 'blunder-drills', 107, 7, 0.1),
      record('b5', 'blunder-drills', 108, 7, 0.1),
    ];
    const analytics = rankInterventionHistoryRecords(records, 2);
    expect(analytics.rows.find((row) => row.trainingType === 'phase-training')?.confidence).toBe('provisional');
    expect(analytics.rows.find((row) => row.trainingType === 'opening-repair')?.confidence).toBe('developing');
    expect(analytics.rows.find((row) => row.trainingType === 'blunder-drills')?.confidence).toBe('established');
    expect(analytics.collectingInterventions).toBe(2);
  });
});
