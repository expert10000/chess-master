import type { GameLibraryMemory } from './gameLibrary';
import type { CoachRecommendationKind } from './personalCoachRecommendations';
import {
  recommendationOutcomeEvaluations,
  type RecommendationOutcomeCheckpoint,
  type RecommendationOutcomeEvaluation,
  type RecommendationOutcomeMemory,
  type RecommendationOutcomeVerdict,
} from './recommendationOutcomes';

export type InterventionTrainingType =
  | 'phase-training'
  | 'opening-repair'
  | 'color-side-training'
  | 'blunder-drills'
  | 'overall-performance';

export interface InterventionHistoryRecord {
  interventionId: string;
  title: string;
  trainingType: InterventionTrainingType;
  trainingTypeLabel: string;
  completedAt: number;
  checkpointGames: 10 | 20;
  verdict: Exclude<RecommendationOutcomeVerdict, 'collecting'>;
  cplImprovement: number | null;
  blunderReduction: number | null;
  issueReduction: number | null;
  plannedPositions: number;
  attemptedPositions: number;
  solvedPositions: number;
  solveRate: number | null;
}

export interface InterventionTrainingTypeRow {
  trainingType: InterventionTrainingType;
  label: string;
  interventions: number;
  twentyGameOutcomes: number;
  tenGameCheckpoints: number;
  improved: number;
  mixed: number;
  stable: number;
  worse: number;
  improvedRate: number;
  avgCplImprovement: number | null;
  avgBlunderReduction: number | null;
  avgIssueReduction: number | null;
  avgSolveRate: number | null;
  rank: number;
  confidence: 'provisional' | 'developing' | 'established';
}

export interface InterventionHistoryAnalytics {
  measuredInterventions: number;
  collectingInterventions: number;
  rows: InterventionTrainingTypeRow[];
  history: InterventionHistoryRecord[];
  bestType: InterventionTrainingTypeRow | null;
}

export function interventionTrainingType(kind: CoachRecommendationKind): InterventionTrainingType {
  if (kind === 'phase-gap' || kind === 'phase-decline') return 'phase-training';
  if (kind === 'opening') return 'opening-repair';
  if (kind === 'color-gap') return 'color-side-training';
  if (kind === 'blunders') return 'blunder-drills';
  return 'overall-performance';
}

export function interventionTrainingTypeLabel(type: InterventionTrainingType): string {
  if (type === 'phase-training') return 'Phase training';
  if (type === 'opening-repair') return 'Opening repair';
  if (type === 'color-side-training') return 'White/Black side training';
  if (type === 'blunder-drills') return 'Blunder drills';
  return 'Overall performance';
}

function measuredCheckpoint(
  evaluation: RecommendationOutcomeEvaluation,
): RecommendationOutcomeCheckpoint | null {
  if (evaluation.next20.verdict !== 'collecting') return evaluation.next20;
  if (evaluation.next10.verdict !== 'collecting') return evaluation.next10;
  return null;
}

function improvement(delta: number | null): number | null {
  return delta === null ? null : -delta;
}

function average(values: Array<number | null>): number | null {
  const usable = values.filter((value): value is number => value !== null && Number.isFinite(value));
  return usable.length ? usable.reduce((sum, value) => sum + value, 0) / usable.length : null;
}

function confidence(count: number): InterventionTrainingTypeRow['confidence'] {
  if (count >= 5) return 'established';
  if (count >= 3) return 'developing';
  return 'provisional';
}

function historyRecord(evaluation: RecommendationOutcomeEvaluation): InterventionHistoryRecord | null {
  const checkpoint = measuredCheckpoint(evaluation);
  if (!checkpoint || checkpoint.verdict === 'collecting') return null;
  const intervention = evaluation.intervention;
  const type = interventionTrainingType(intervention.recommendationKind);
  return {
    interventionId: intervention.id,
    title: intervention.title,
    trainingType: type,
    trainingTypeLabel: interventionTrainingTypeLabel(type),
    completedAt: intervention.completedAt,
    checkpointGames: checkpoint.targetGames,
    verdict: checkpoint.verdict,
    cplImprovement: improvement(checkpoint.cplDelta),
    blunderReduction: improvement(checkpoint.blunderDelta),
    issueReduction: improvement(checkpoint.issueDelta),
    plannedPositions: intervention.plannedPositions,
    attemptedPositions: intervention.attemptedPositions,
    solvedPositions: intervention.solvedPositions,
    solveRate: intervention.plannedPositions > 0
      ? intervention.solvedPositions / intervention.plannedPositions
      : null,
  };
}

function rowFor(type: InterventionTrainingType, records: InterventionHistoryRecord[]): InterventionTrainingTypeRow {
  const matches = records.filter((record) => record.trainingType === type);
  const improved = matches.filter((record) => record.verdict === 'improved').length;
  const mixed = matches.filter((record) => record.verdict === 'mixed').length;
  const stable = matches.filter((record) => record.verdict === 'stable').length;
  const worse = matches.filter((record) => record.verdict === 'worse').length;
  return {
    trainingType: type,
    label: interventionTrainingTypeLabel(type),
    interventions: matches.length,
    twentyGameOutcomes: matches.filter((record) => record.checkpointGames === 20).length,
    tenGameCheckpoints: matches.filter((record) => record.checkpointGames === 10).length,
    improved,
    mixed,
    stable,
    worse,
    improvedRate: matches.length ? improved / matches.length : 0,
    avgCplImprovement: average(matches.map((record) => record.cplImprovement)),
    avgBlunderReduction: average(matches.map((record) => record.blunderReduction)),
    avgIssueReduction: average(matches.map((record) => record.issueReduction)),
    avgSolveRate: average(matches.map((record) => record.solveRate)),
    rank: 0,
    confidence: confidence(matches.length),
  };
}

function compareRows(a: InterventionTrainingTypeRow, b: InterventionTrainingTypeRow): number {
  // Transparent ranking: average CPL improvement first, then average blunder reduction,
  // then observed improved rate, then sample count.
  const aCpl = a.avgCplImprovement ?? Number.NEGATIVE_INFINITY;
  const bCpl = b.avgCplImprovement ?? Number.NEGATIVE_INFINITY;
  if (aCpl !== bCpl) return bCpl - aCpl;

  const aBlunder = a.avgBlunderReduction ?? Number.NEGATIVE_INFINITY;
  const bBlunder = b.avgBlunderReduction ?? Number.NEGATIVE_INFINITY;
  if (aBlunder !== bBlunder) return bBlunder - aBlunder;

  if (a.improvedRate !== b.improvedRate) return b.improvedRate - a.improvedRate;
  return b.interventions - a.interventions;
}

export function rankInterventionHistoryRecords(
  history: InterventionHistoryRecord[],
  collectingInterventions = 0,
): InterventionHistoryAnalytics {
  const sortedHistory = history.slice().sort((a, b) => b.completedAt - a.completedAt);
  const types: InterventionTrainingType[] = [
    'phase-training',
    'opening-repair',
    'color-side-training',
    'blunder-drills',
    'overall-performance',
  ];
  const rows = types
    .map((type) => rowFor(type, sortedHistory))
    .filter((row) => row.interventions > 0)
    .sort(compareRows)
    .map((row, index) => ({ ...row, rank: index + 1 }));

  return {
    measuredInterventions: sortedHistory.length,
    collectingInterventions,
    rows,
    history: sortedHistory,
    bestType: rows[0] ?? null,
  };
}

export function buildInterventionHistoryAnalytics(
  outcomeMemory: RecommendationOutcomeMemory,
  gameLibrary: GameLibraryMemory,
): InterventionHistoryAnalytics {
  const evaluations = recommendationOutcomeEvaluations(outcomeMemory, gameLibrary);
  const history = evaluations
    .map(historyRecord)
    .filter((record): record is InterventionHistoryRecord => Boolean(record));

  return rankInterventionHistoryRecords(
    history,
    evaluations.filter((evaluation) => measuredCheckpoint(evaluation) === null).length,
  );
}
