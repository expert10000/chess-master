import {
  buildGameAnalyticsDrilldown,
  type GameAnalyticsDrilldownRequest,
  type GameAnalyticsDrilldownResult,
  type GameAnalyticsEvidenceMove,
  type WindowMetric,
} from './gameAnalytics';
import type { GameLibraryEntry, GameLibraryMemory } from './gameLibrary';
import type { PersonalCoachRecommendation } from './personalCoachRecommendations';

export const RECOMMENDATION_OUTCOME_STORAGE_KEY = 'stockfish-coach.recommendation-outcomes.v1';

export type RecommendationOutcomeVerdict =
  | 'collecting'
  | 'improved'
  | 'mixed'
  | 'stable'
  | 'worse';

export interface RecommendationOutcomeMetrics extends WindowMetric {
  gameIds: string[];
}

export interface RecommendationOutcomeCheckpoint {
  games: number;
  targetGames: 10 | 20;
  metrics: RecommendationOutcomeMetrics;
  cplDelta: number | null;
  blunderDelta: number | null;
  issueDelta: number | null;
  verdict: RecommendationOutcomeVerdict;
  label: string;
}

export interface RecommendationIntervention {
  id: string;
  recommendationId: string;
  recommendationKind: PersonalCoachRecommendation['kind'];
  title: string;
  summary: string;
  windowSize: 10 | 20 | 50;
  completedAt: number;
  plannedPositions: number;
  attemptedPositions: number;
  solvedPositions: number;
  scope: Omit<GameAnalyticsDrilldownRequest, 'window' | 'metric'>;
  baselineGameIds: string[];
  baseline: RecommendationOutcomeMetrics;
}

export interface RecommendationOutcomeMemory {
  version: 1;
  interventions: RecommendationIntervention[];
}

export interface RecommendationOutcomeEvaluation {
  intervention: RecommendationIntervention;
  newReviewedGames: GameLibraryEntry[];
  next10: RecommendationOutcomeCheckpoint;
  next20: RecommendationOutcomeCheckpoint;
  finalVerdict: RecommendationOutcomeVerdict;
  headline: string;
  explanation: string;
  evidenceMoves: GameAnalyticsEvidenceMove[];
}

const MAX_INTERVENTIONS = 40;

export function emptyRecommendationOutcomeMemory(): RecommendationOutcomeMemory {
  return { version: 1, interventions: [] };
}

function validIntervention(value: unknown): value is RecommendationIntervention {
  const item = value as Partial<RecommendationIntervention> | null;
  return Boolean(
    item
    && typeof item.id === 'string'
    && typeof item.recommendationId === 'string'
    && typeof item.title === 'string'
    && typeof item.completedAt === 'number'
    && Array.isArray(item.baselineGameIds)
    && item.baseline
    && typeof item.baseline.games === 'number'
    && Array.isArray(item.baseline.gameIds)
  );
}

export function loadRecommendationOutcomeMemory(raw: string | null | undefined): RecommendationOutcomeMemory {
  if (!raw) return emptyRecommendationOutcomeMemory();
  try {
    const parsed = JSON.parse(raw) as Partial<RecommendationOutcomeMemory>;
    if (parsed.version !== 1 || !Array.isArray(parsed.interventions)) {
      return emptyRecommendationOutcomeMemory();
    }
    return {
      version: 1,
      interventions: parsed.interventions
        .filter(validIntervention)
        .sort((a, b) => b.completedAt - a.completedAt)
        .slice(0, MAX_INTERVENTIONS),
    };
  } catch {
    return emptyRecommendationOutcomeMemory();
  }
}

export function serializeRecommendationOutcomeMemory(memory: RecommendationOutcomeMemory): string {
  return JSON.stringify(memory);
}

function eligiblePersonalGames(memory: GameLibraryMemory): GameLibraryEntry[] {
  return memory.entries
    .filter((entry) => entry.reviewedHumanMoves > 0 && !entry.archived && !entry.modelGame)
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt || a.updatedAt - b.updatedAt);
}

function scopeFromRecommendation(
  recommendation: PersonalCoachRecommendation,
): Omit<GameAnalyticsDrilldownRequest, 'window' | 'metric'> {
  const request = recommendation.evidenceRequest;
  return {
    ...(request.color ? { color: request.color } : {}),
    ...(request.phase ? { phase: request.phase } : {}),
    ...(request.openingKey ? { openingKey: request.openingKey } : {}),
    ...(request.label ? { label: request.label } : {}),
  };
}

function metricRequest(
  scope: RecommendationIntervention['scope'],
  metric: GameAnalyticsDrilldownRequest['metric'] = 'cpl',
  window: GameAnalyticsDrilldownRequest['window'] = 'all',
): GameAnalyticsDrilldownRequest {
  return {
    window,
    metric,
    ...(scope.color ? { color: scope.color } : {}),
    ...(scope.phase ? { phase: scope.phase } : {}),
    ...(scope.openingKey ? { openingKey: scope.openingKey } : {}),
    ...(scope.label ? { label: scope.label } : {}),
  };
}

function metricsFromResult(
  result: GameAnalyticsDrilldownResult,
  gameIds: string[],
): RecommendationOutcomeMetrics {
  return {
    games: result.games,
    reviewedMoves: result.reviewedMoves,
    avgCpl: result.avgCpl,
    blundersPerGame: result.blundersPerGame,
    issuesPerGame: result.issuesPerGame,
    gameIds,
  };
}

function selectedMemory(entries: GameLibraryEntry[]): GameLibraryMemory {
  return { version: 1, entries };
}

function scopedMetrics(
  entries: GameLibraryEntry[],
  scope: RecommendationIntervention['scope'],
): RecommendationOutcomeMetrics {
  if (!entries.length) {
    return {
      games: 0,
      reviewedMoves: 0,
      avgCpl: null,
      blundersPerGame: null,
      issuesPerGame: null,
      gameIds: [],
    };
  }
  const result = buildGameAnalyticsDrilldown(
    selectedMemory(entries),
    50,
    metricRequest(scope, 'cpl', 'all'),
  );
  return metricsFromResult(result, result.gamesList.map((row) => row.entry.id));
}

function baselineMetrics(
  memory: GameLibraryMemory,
  recommendation: PersonalCoachRecommendation,
  scope: RecommendationIntervention['scope'],
): RecommendationOutcomeMetrics {
  const result = buildGameAnalyticsDrilldown(
    memory,
    recommendation.windowSize,
    metricRequest(scope, 'cpl', 'current'),
  );
  return metricsFromResult(result, result.gamesList.map((row) => row.entry.id));
}

function delta(after: number | null, before: number | null): number | null {
  return after !== null && before !== null ? after - before : null;
}

function checkpointVerdict(
  baseline: RecommendationOutcomeMetrics,
  after: RecommendationOutcomeMetrics,
  enoughGames: boolean,
): RecommendationOutcomeVerdict {
  if (!enoughGames) return 'collecting';

  const cplDelta = delta(after.avgCpl, baseline.avgCpl);
  const blunderDelta = delta(after.blundersPerGame, baseline.blundersPerGame);
  if (cplDelta === null && blunderDelta === null) return 'stable';

  const cplImproved = cplDelta !== null && cplDelta <= -8;
  const cplWorse = cplDelta !== null && cplDelta >= 8;
  const blunderImproved = blunderDelta !== null && blunderDelta <= -0.15;
  const blunderWorse = blunderDelta !== null && blunderDelta >= 0.15;

  const anyImproved = cplImproved || blunderImproved;
  const anyWorse = cplWorse || blunderWorse;

  if (anyImproved && anyWorse) return 'mixed';
  if (anyImproved) return 'improved';
  if (anyWorse) return 'worse';
  return 'stable';
}

function checkpoint(
  baseline: RecommendationOutcomeMetrics,
  entries: GameLibraryEntry[],
  scope: RecommendationIntervention['scope'],
  targetGames: 10 | 20,
): RecommendationOutcomeCheckpoint {
  const slice = entries.slice(0, targetGames);
  const metrics = scopedMetrics(slice, scope);
  const enoughGames = entries.length >= targetGames;
  const verdict = checkpointVerdict(baseline, metrics, enoughGames);
  return {
    games: Math.min(entries.length, targetGames),
    targetGames,
    metrics,
    cplDelta: delta(metrics.avgCpl, baseline.avgCpl),
    blunderDelta: delta(metrics.blundersPerGame, baseline.blundersPerGame),
    issueDelta: delta(metrics.issuesPerGame, baseline.issuesPerGame),
    verdict,
    label: targetGames === 10 ? '10-game checkpoint' : '20-game outcome',
  };
}

function resultHeadline(
  intervention: RecommendationIntervention,
  next10: RecommendationOutcomeCheckpoint,
  next20: RecommendationOutcomeCheckpoint,
): { verdict: RecommendationOutcomeVerdict; headline: string; explanation: string } {
  const selected = next20.verdict !== 'collecting' ? next20 : next10;
  if (selected.verdict === 'collecting') {
    const count = next10.games;
    return {
      verdict: 'collecting',
      headline: `Collecting post-training evidence · ${count}/10 games`,
      explanation: `The coach will give an early result after 10 newly reviewed relevant games and a more stable outcome after 20. ${intervention.title} remains under measurement.`,
    };
  }

  const checkpointName = selected.targetGames === 20 ? '20-game outcome' : '10-game checkpoint';
  if (selected.verdict === 'improved') {
    return {
      verdict: 'improved',
      headline: `${checkpointName}: improvement detected`,
      explanation: 'The targeted post-training metrics improved enough to clear the coach’s practical change threshold.',
    };
  }
  if (selected.verdict === 'worse') {
    return {
      verdict: 'worse',
      headline: `${checkpointName}: results worsened`,
      explanation: 'The targeted post-training metrics moved in the wrong direction enough to clear the coach’s practical change threshold.',
    };
  }
  if (selected.verdict === 'mixed') {
    return {
      verdict: 'mixed',
      headline: `${checkpointName}: mixed result`,
      explanation: 'One targeted metric improved while another worsened, so the intervention does not yet have a single clear outcome.',
    };
  }
  return {
    verdict: 'stable',
    headline: `${checkpointName}: no clear change`,
    explanation: 'The measured changes are still inside the coach’s stability band; more focused work or a different intervention may be more useful.',
  };
}

export function recordCompletedRecommendationIntervention(
  memory: RecommendationOutcomeMemory,
  recommendation: PersonalCoachRecommendation,
  gameLibrary: GameLibraryMemory,
  input: {
    plannedPositions: number;
    attemptedPositions: number;
    solvedPositions: number;
    completedAt?: number;
  },
): RecommendationOutcomeMemory {
  const completedAt = input.completedAt ?? Date.now();
  const scope = scopeFromRecommendation(recommendation);
  const personalGames = eligiblePersonalGames(gameLibrary);
  const intervention: RecommendationIntervention = {
    id: `outcome:${completedAt}:${recommendation.id}:${Math.random().toString(36).slice(2, 7)}`,
    recommendationId: recommendation.id,
    recommendationKind: recommendation.kind,
    title: recommendation.title,
    summary: recommendation.summary,
    windowSize: recommendation.windowSize,
    completedAt,
    plannedPositions: Math.max(0, Math.trunc(input.plannedPositions)),
    attemptedPositions: Math.max(0, Math.trunc(input.attemptedPositions)),
    solvedPositions: Math.max(0, Math.trunc(input.solvedPositions)),
    scope,
    baselineGameIds: personalGames.map((entry) => entry.id),
    baseline: baselineMetrics(gameLibrary, recommendation, scope),
  };

  return {
    version: 1,
    interventions: [
      intervention,
      ...memory.interventions.filter((item) => item.id !== intervention.id),
    ].slice(0, MAX_INTERVENTIONS),
  };
}

export function recommendationOutcomeEvaluation(
  intervention: RecommendationIntervention,
  gameLibrary: GameLibraryMemory,
): RecommendationOutcomeEvaluation {
  const baselineIds = new Set(intervention.baselineGameIds);
  const newReviewedGames = eligiblePersonalGames(gameLibrary)
    .filter((entry) => !baselineIds.has(entry.id) && entry.createdAt >= intervention.completedAt)
    .filter((entry) => scopedMetrics([entry], intervention.scope).reviewedMoves > 0)
    .slice(0, 20);

  const next10 = checkpoint(intervention.baseline, newReviewedGames, intervention.scope, 10);
  const next20 = checkpoint(intervention.baseline, newReviewedGames, intervention.scope, 20);
  const result = resultHeadline(intervention, next10, next20);

  const evidenceEntries = next20.verdict !== 'collecting'
    ? newReviewedGames.slice(0, 20)
    : newReviewedGames.slice(0, 10);
  const evidence = buildGameAnalyticsDrilldown(
    selectedMemory(evidenceEntries),
    50,
    metricRequest(intervention.scope, 'issues', 'all'),
  );

  return {
    intervention,
    newReviewedGames,
    next10,
    next20,
    finalVerdict: result.verdict,
    headline: result.headline,
    explanation: result.explanation,
    evidenceMoves: evidence.movesList,
  };
}

export function recommendationOutcomeEvaluations(
  memory: RecommendationOutcomeMemory,
  gameLibrary: GameLibraryMemory,
): RecommendationOutcomeEvaluation[] {
  return memory.interventions
    .map((intervention) => recommendationOutcomeEvaluation(intervention, gameLibrary))
    .sort((a, b) => b.intervention.completedAt - a.intervention.completedAt);
}

export function removeRecommendationIntervention(
  memory: RecommendationOutcomeMemory,
  interventionId: string,
): RecommendationOutcomeMemory {
  return {
    version: 1,
    interventions: memory.interventions.filter((item) => item.id !== interventionId),
  };
}
