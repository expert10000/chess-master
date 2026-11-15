import { describe, expect, it } from 'vitest';
import { buildTrainingExperiments } from '../src/lib/trainingExperiments';
import { interventionTrainingTypeLabel, type InterventionHistoryRecord, type InterventionTrainingType } from '../src/lib/interventionHistoryAnalytics';

function record(id: string, type: InterventionTrainingType, cpl: number): InterventionHistoryRecord {
  return { interventionId: id, title: id, trainingType: type, trainingTypeLabel: interventionTrainingTypeLabel(type), completedAt: Number(id.replace(/\D/g, '')) || 1, checkpointGames: 20, verdict: 'improved', cplImprovement: cpl, blunderReduction: 0.2, issueReduction: 0.3, plannedPositions: 5, attemptedPositions: 5, solvedPositions: 4, solveRate: 0.8 };
}

describe('v1.10.0 training experiments', () => {
  it('alternates toward the less-tested arm while evidence is collecting', () => {
    const experiment = buildTrainingExperiments([record('a1', 'blunder-drills', 21)])[0];
    expect(experiment.verdict).toBe('collecting');
    expect(experiment.nextArm).toBe('B');
    expect(experiment.confidence).toBe('insufficient');
  });
  it('favors a measured arm only after both arms have at least two outcomes and a material gap', () => {
    const experiment = buildTrainingExperiments([record('a1', 'blunder-drills', 9), record('a2', 'blunder-drills', 13), record('b1', 'phase-training', 24), record('b2', 'phase-training', 20)])[0];
    expect(experiment.verdict).toBe('favors-b');
    expect(experiment.armB.label).toBe('Positional decision exercises');
  });
  it('keeps close averages inconclusive', () => {
    const experiment = buildTrainingExperiments([record('a1', 'blunder-drills', 18), record('a2', 'blunder-drills', 20), record('b1', 'phase-training', 20), record('b2', 'phase-training', 21)])[0];
    expect(experiment.verdict).toBe('too-close');
  });
});
