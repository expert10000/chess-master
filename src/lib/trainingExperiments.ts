import {
  rankInterventionHistoryRecords,
  type InterventionHistoryAnalytics,
  type InterventionHistoryRecord,
  type InterventionTrainingType,
} from './interventionHistoryAnalytics';

export interface TrainingExperimentArm {
  id: InterventionTrainingType;
  label: string;
  interventions: number;
  avgCplImprovement: number | null;
  avgBlunderReduction: number | null;
}

export interface TrainingExperiment {
  id: string;
  question: string;
  armA: TrainingExperimentArm;
  armB: TrainingExperimentArm;
  nextArm: 'A' | 'B';
  verdict: 'collecting' | 'favors-a' | 'favors-b' | 'too-close';
  confidence: 'insufficient' | 'developing' | 'grounded';
  explanation: string;
}

const EXPERIMENTS: Array<{ id: string; question: string; a: InterventionTrainingType; b: InterventionTrainingType }> = [
  {
    id: 'middlegame-method',
    question: 'What improves your middlegame more?',
    a: 'blunder-drills',
    b: 'phase-training',
  },
  {
    id: 'repair-method',
    question: 'Which repair method produces better game-quality gains?',
    a: 'opening-repair',
    b: 'color-side-training',
  },
];

function displayLabel(type: InterventionTrainingType): string {
  if (type === 'blunder-drills') return 'Tactical calculation drills';
  if (type === 'phase-training') return 'Positional decision exercises';
  if (type === 'opening-repair') return 'Opening repair drills';
  if (type === 'color-side-training') return 'Color-side decision exercises';
  return 'Overall performance review';
}

function arm(type: InterventionTrainingType, analytics: InterventionHistoryAnalytics): TrainingExperimentArm {
  const row = analytics.rows.find((candidate) => candidate.trainingType === type);
  return {
    id: type,
    label: displayLabel(type),
    interventions: row?.interventions ?? 0,
    avgCplImprovement: row?.avgCplImprovement ?? null,
    avgBlunderReduction: row?.avgBlunderReduction ?? null,
  };
}

function preferredArm(a: TrainingExperimentArm, b: TrainingExperimentArm): 'A' | 'B' | null {
  if (a.interventions < 2 || b.interventions < 2 || a.avgCplImprovement === null || b.avgCplImprovement === null) return null;
  const difference = a.avgCplImprovement - b.avgCplImprovement;
  if (Math.abs(difference) < 5) return null;
  return difference > 0 ? 'A' : 'B';
}

export function buildTrainingExperiments(history: InterventionHistoryRecord[]): TrainingExperiment[] {
  const analytics = rankInterventionHistoryRecords(history);
  return EXPERIMENTS.map((definition) => {
    const armA = arm(definition.a, analytics);
    const armB = arm(definition.b, analytics);
    const preference = preferredArm(armA, armB);
    const total = armA.interventions + armB.interventions;
    const confidence: TrainingExperiment['confidence'] = Math.min(armA.interventions, armB.interventions) >= 5
      ? 'grounded'
      : Math.min(armA.interventions, armB.interventions) >= 3
        ? 'developing'
        : 'insufficient';
    const nextArm: 'A' | 'B' = armA.interventions <= armB.interventions ? 'A' : 'B';
    const verdict: TrainingExperiment['verdict'] = preference === 'A'
      ? 'favors-a'
      : preference === 'B'
        ? 'favors-b'
        : total >= 4 && armA.interventions >= 2 && armB.interventions >= 2
          ? 'too-close'
          : 'collecting';
    const explanation = verdict === 'collecting'
      ? `Alternate the next intervention with ${nextArm === 'A' ? armA.label : armB.label}; each arm needs two measured outcomes before comparison.`
      : verdict === 'too-close'
        ? 'Current average CPL gains are within 5 cp. Continue alternating rather than declaring a winner.'
        : `Current evidence favors ${preference === 'A' ? armA.label : armB.label}; keep alternating to test whether the advantage persists.`;
    return { id: definition.id, question: definition.question, armA, armB, nextArm, verdict, confidence, explanation };
  });
}
