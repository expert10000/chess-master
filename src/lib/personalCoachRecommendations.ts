import type { TrainingExercise } from './training';
import {
  buildGameAnalyticsDrilldown,
  buildGameAnalyticsSummary,
  gameAnalyticsOpeningRows,
  type GameAnalyticsDrilldownRequest,
  type GameAnalyticsEvidenceMove,
  type GameAnalyticsWindow,
  type GamePhase,
} from './gameAnalytics';
import {
  hydrateGameLibraryEntry,
  type GameLibraryMemory,
} from './gameLibrary';

export type CoachRecommendationKind =
  | 'phase-gap'
  | 'phase-decline'
  | 'color-gap'
  | 'opening'
  | 'blunders'
  | 'overall-decline';

export type CoachRecommendationPriority = 'high' | 'medium' | 'watch';

export interface PersonalCoachRecommendation {
  id: string;
  rank: number;
  score: number;
  kind: CoachRecommendationKind;
  priority: CoachRecommendationPriority;
  title: string;
  summary: string;
  action: string;
  why: string[];
  windowSize: 10 | 20 | 50;
  evidenceRequest: GameAnalyticsDrilldownRequest;
  trainingRequest: GameAnalyticsDrilldownRequest;
  evidenceCount: number;
  trainingCount: number;
}

function phaseLabel(phase: GamePhase): string {
  if (phase === 'opening') return 'Opening';
  if (phase === 'middlegame') return 'Middlegame';
  return 'Endgame';
}

function colorLabel(color: 'w' | 'b'): string {
  return color === 'w' ? 'White' : 'Black';
}

function priorityFromScore(score: number): CoachRecommendationPriority {
  if (score >= 105) return 'high';
  if (score >= 72) return 'medium';
  return 'watch';
}

function gapText(value: number): string {
  return `${Math.round(Math.abs(value))} cp`;
}

function gameWindowLabel(games: number, requested: number): string {
  return games < requested ? `the ${games} reviewed games currently available` : `your last ${requested} reviewed games`;
}

function scopedRequest(
  metric: GameAnalyticsDrilldownRequest['metric'],
  extra: Partial<GameAnalyticsDrilldownRequest> = {},
  window: GameAnalyticsWindow = 'current',
): GameAnalyticsDrilldownRequest {
  return { window, metric, ...extra };
}

function countEvidence(
  memory: GameLibraryMemory,
  windowSize: 10 | 20 | 50,
  request: GameAnalyticsDrilldownRequest,
): number {
  return buildGameAnalyticsDrilldown(memory, windowSize, request).movesList.length;
}

function trainingRequestForScope(extra: Partial<GameAnalyticsDrilldownRequest> = {}): GameAnalyticsDrilldownRequest {
  return scopedRequest('issues', extra, 'current');
}

function recommendationBase(
  memory: GameLibraryMemory,
  windowSize: 10 | 20 | 50,
  input: Omit<PersonalCoachRecommendation, 'rank' | 'priority' | 'evidenceCount' | 'trainingCount'>,
): PersonalCoachRecommendation | null {
  const evidenceCount = countEvidence(memory, windowSize, input.evidenceRequest);
  const trainingCount = Math.min(7, buildRecommendationTrainingMoves(memory, windowSize, input.trainingRequest, 7).length);
  if (evidenceCount === 0 && trainingCount === 0) return null;
  return {
    ...input,
    rank: 0,
    priority: priorityFromScore(input.score),
    evidenceCount,
    trainingCount,
  };
}

function phaseGapCandidates(memory: GameLibraryMemory, windowSize: 10 | 20 | 50): PersonalCoachRecommendation[] {
  const summary = buildGameAnalyticsSummary(memory, windowSize);
  const eligible = summary.current.phases
    .filter((phase) => phase.avgCpl !== null && phase.reviewedMoves >= 4)
    .sort((a, b) => (b.avgCpl ?? -1) - (a.avgCpl ?? -1));
  if (eligible.length < 2) return [];
  const worst = eligible[0];
  const best = eligible[eligible.length - 1];
  if (worst.avgCpl === null || best.avgCpl === null) return [];
  const gap = worst.avgCpl - best.avgCpl;
  if (gap < 15) return [];
  const scope = { phase: worst.phase };
  const rec = recommendationBase(memory, windowSize, {
    id: `phase-gap:${worst.phase}:${windowSize}`,
    score: 72 + gap * 1.35 + (worst.blundersPerGame ?? 0) * 20,
    kind: 'phase-gap',
    title: `Prioritize ${phaseLabel(worst.phase).toLowerCase()} decisions`,
    summary: `${phaseLabel(worst.phase)} CPL is ${Math.round(gap)} cp worse than ${phaseLabel(best.phase).toLowerCase()} across ${gameWindowLabel(summary.current.games, windowSize)}.`,
    action: `Train the highest-cost ${phaseLabel(worst.phase).toLowerCase()} positions first.`,
    why: [
      `${phaseLabel(worst.phase)}: ${Math.round(worst.avgCpl)} cp average loss across ${worst.reviewedMoves} reviewed moves.`,
      `${phaseLabel(best.phase)}: ${Math.round(best.avgCpl)} cp average loss — a ${Math.round(gap)} cp performance gap.`,
      `${phaseLabel(worst.phase)} produced ${(worst.blundersPerGame ?? 0).toFixed(2)} blunders/game and ${(worst.issuesPerGame ?? 0).toFixed(2)} issues/game.`,
    ],
    windowSize,
    evidenceRequest: scopedRequest('cpl', scope),
    trainingRequest: trainingRequestForScope(scope),
  });
  return rec ? [rec] : [];
}

function decliningPhaseCandidates(memory: GameLibraryMemory, windowSize: 10 | 20 | 50): PersonalCoachRecommendation[] {
  const summary = buildGameAnalyticsSummary(memory, windowSize);
  if (!summary.previous) return [];
  return summary.current.phases.flatMap((phase) => {
    if (phase.deltaCpl === null || phase.deltaCpl < 10 || phase.reviewedMoves < 4) return [];
    const scope = { phase: phase.phase };
    const rec = recommendationBase(memory, windowSize, {
      id: `phase-decline:${phase.phase}:${windowSize}`,
      score: 68 + phase.deltaCpl * 1.6 + (phase.blundersPerGame ?? 0) * 18,
      kind: 'phase-decline',
      title: `Reverse declining ${phaseLabel(phase.phase).toLowerCase()} play`,
      summary: `${phaseLabel(phase.phase)} CPL worsened by ${Math.round(phase.deltaCpl)} cp versus the previous ${windowSize}-game window.`,
      action: `Rehearse recent ${phaseLabel(phase.phase).toLowerCase()} errors before they become a stable habit.`,
      why: [
        `Current ${phaseLabel(phase.phase).toLowerCase()} CPL: ${Math.round(phase.avgCpl ?? 0)} cp.`,
        `Trend: ${Math.round(phase.deltaCpl)} cp worse than the previous same-size reviewed-game window.`,
        `${phase.reviewedMoves} reviewed moves give this trend enough evidence to act on.`,
      ],
      windowSize,
      evidenceRequest: scopedRequest('issues', scope),
      trainingRequest: trainingRequestForScope(scope),
    });
    return rec ? [rec] : [];
  });
}

function colorGapCandidates(memory: GameLibraryMemory, windowSize: 10 | 20 | 50): PersonalCoachRecommendation[] {
  const summary = buildGameAnalyticsSummary(memory, windowSize);
  const white = summary.current.gamesByColor.find((row) => row.color === 'w');
  const black = summary.current.gamesByColor.find((row) => row.color === 'b');
  if (!white || !black || white.avgCpl === null || black.avgCpl === null) return [];
  if (white.reviewedMoves < 4 || black.reviewedMoves < 4) return [];
  const worse = white.avgCpl >= black.avgCpl ? white : black;
  const better = worse.color === 'w' ? black : white;
  const gap = (worse.avgCpl ?? 0) - (better.avgCpl ?? 0);
  if (gap < 15) return [];
  const scope = { color: worse.color };
  const rec = recommendationBase(memory, windowSize, {
    id: `color-gap:${worse.color}:${windowSize}`,
    score: 62 + gap * 1.15 + (worse.blundersPerGame ?? 0) * 15,
    kind: 'color-gap',
    title: `Strengthen play as ${colorLabel(worse.color)}`,
    summary: `Your ${colorLabel(worse.color)} CPL is ${Math.round(gap)} cp worse than your ${colorLabel(better.color)} CPL in the selected game window.`,
    action: `Train the costliest ${colorLabel(worse.color)} positions, then recheck the split after more games.`,
    why: [
      `As ${colorLabel(worse.color)}: ${Math.round(worse.avgCpl ?? 0)} cp average loss across ${worse.reviewedMoves} reviewed moves.`,
      `As ${colorLabel(better.color)}: ${Math.round(better.avgCpl ?? 0)} cp — ${Math.round(gap)} cp better.`,
      `${colorLabel(worse.color)} games currently show ${(worse.blundersPerGame ?? 0).toFixed(2)} blunders/game.`,
    ],
    windowSize,
    evidenceRequest: scopedRequest('cpl', scope),
    trainingRequest: trainingRequestForScope(scope),
  });
  return rec ? [rec] : [];
}

function openingCandidates(memory: GameLibraryMemory, windowSize: 10 | 20 | 50): PersonalCoachRecommendation[] {
  const summary = buildGameAnalyticsSummary(memory, windowSize);
  const overall = summary.current.avgCpl ?? 0;
  const rows = gameAnalyticsOpeningRows(memory, windowSize, 'current')
    .filter((row) => row.games >= 2 && row.reviewedMoves >= 4 && row.avgCpl !== null)
    .filter((row) => (row.avgCpl ?? 0) >= Math.max(75, overall + 12))
    .sort((a, b) => {
      const scoreA = (a.avgCpl ?? 0) + (a.blundersPerGame ?? 0) * 25 + Math.min(10, a.games) * 2;
      const scoreB = (b.avgCpl ?? 0) + (b.blundersPerGame ?? 0) * 25 + Math.min(10, b.games) * 2;
      return scoreB - scoreA;
    })
    .slice(0, 2);

  return rows.flatMap((row) => {
    const scope = { openingKey: row.key };
    const excess = Math.max(0, (row.avgCpl ?? 0) - overall);
    const rec = recommendationBase(memory, windowSize, {
      id: `opening:${row.key}:${windowSize}`,
      score: 64 + excess * 1.15 + (row.blundersPerGame ?? 0) * 22 + Math.min(12, row.games * 2),
      kind: 'opening',
      title: `Repair ${row.label}`,
      summary: `${row.label} averages ${Math.round(row.avgCpl ?? 0)} cp loss across ${row.games} games${excess >= 8 ? ` — ${Math.round(excess)} cp worse than your overall window` : ''}.`,
      action: `Rehearse the worst reviewed positions from this opening before adding more theory.`,
      why: [
        `${row.games} games and ${row.reviewedMoves} reviewed moves make this a repeated pattern rather than a one-off result.`,
        `Average CPL: ${Math.round(row.avgCpl ?? 0)} cp; blunders/game: ${(row.blundersPerGame ?? 0).toFixed(2)}.`,
        excess >= 8 ? `This opening is ${Math.round(excess)} cp worse than your overall ${Math.round(overall)} cp window.` : `This opening is already above the coach's high-CPL action threshold.`,
      ],
      windowSize,
      evidenceRequest: scopedRequest('cpl', scope),
      trainingRequest: trainingRequestForScope(scope),
    });
    return rec ? [rec] : [];
  });
}

function blunderCandidate(memory: GameLibraryMemory, windowSize: 10 | 20 | 50): PersonalCoachRecommendation[] {
  const summary = buildGameAnalyticsSummary(memory, windowSize);
  const blunders = summary.current.blundersPerGame;
  if (summary.current.games < 3 || blunders === null || blunders < 0.45) return [];
  const request = scopedRequest('blunders');
  const evidence = buildGameAnalyticsDrilldown(memory, windowSize, request);
  if (evidence.movesList.length < 2) return [];
  const rec = recommendationBase(memory, windowSize, {
    id: `blunders:${windowSize}`,
    score: 82 + blunders * 36 + Math.min(25, evidence.movesList.length * 2),
    kind: 'blunders',
    title: 'Reduce outright blunders',
    summary: `You are averaging ${blunders.toFixed(2)} blunders/game across ${gameWindowLabel(summary.current.games, windowSize)}.`,
    action: `Start with the highest-cost blunders and solve them again from the original positions.`,
    why: [
      `${evidence.movesList.length} reviewed blunders appear in ${evidence.games} games in this window.`,
      `The worst evidence is ranked by centipawn loss, so Train now starts with the most expensive positions.`,
      `Reducing outright blunders usually has a clearer immediate payoff than polishing already-good moves.`,
    ],
    windowSize,
    evidenceRequest: request,
    trainingRequest: request,
  });
  return rec ? [rec] : [];
}

function overallDeclineCandidate(memory: GameLibraryMemory, windowSize: 10 | 20 | 50): PersonalCoachRecommendation[] {
  const summary = buildGameAnalyticsSummary(memory, windowSize);
  const delta = summary.overallTrend.cplDelta;
  if (!summary.previous || delta === null || delta < 10) return [];
  const rec = recommendationBase(memory, windowSize, {
    id: `overall-decline:${windowSize}`,
    score: 60 + delta * 1.3 + Math.max(0, summary.overallTrend.blunderDelta ?? 0) * 25,
    kind: 'overall-decline',
    title: 'Stabilize recent decision quality',
    summary: `Overall CPL is ${Math.round(delta)} cp worse than the previous ${windowSize} reviewed games.`,
    action: 'Revisit the most expensive recent issues before expanding the study load.',
    why: [
      `Current window: ${Math.round(summary.current.avgCpl ?? 0)} cp average loss.`,
      `Previous window: ${Math.round(summary.previous.avgCpl ?? 0)} cp average loss.`,
      summary.overallTrend.blunderDelta === null
        ? 'Blunder-rate comparison is not available yet.'
        : `Blunders/game changed by ${(summary.overallTrend.blunderDelta >= 0 ? '+' : '') + summary.overallTrend.blunderDelta.toFixed(2)}.`,
    ],
    windowSize,
    evidenceRequest: scopedRequest('issues'),
    trainingRequest: scopedRequest('issues'),
  });
  return rec ? [rec] : [];
}

export function buildPersonalCoachRecommendations(
  memory: GameLibraryMemory,
  windowSize: 10 | 20 | 50 = 20,
  limit = 5,
): PersonalCoachRecommendation[] {
  const summary = buildGameAnalyticsSummary(memory, windowSize);
  if (summary.current.games < 2 || summary.current.reviewedMoves < 4) return [];

  const candidates = [
    ...blunderCandidate(memory, windowSize),
    ...phaseGapCandidates(memory, windowSize),
    ...decliningPhaseCandidates(memory, windowSize),
    ...colorGapCandidates(memory, windowSize),
    ...openingCandidates(memory, windowSize),
    ...overallDeclineCandidate(memory, windowSize),
  ];

  const seen = new Set<string>();
  const sorted = candidates
    .filter((item) => {
      const scope = item.evidenceRequest.openingKey
        ? `opening:${item.evidenceRequest.openingKey}`
        : item.evidenceRequest.phase
          ? `phase:${item.evidenceRequest.phase}`
          : item.evidenceRequest.color
            ? `color:${item.evidenceRequest.color}`
            : item.kind;
      if (seen.has(scope)) return false;
      seen.add(scope);
      return true;
    })
    .sort((a, b) => b.score - a.score || b.trainingCount - a.trainingCount || a.title.localeCompare(b.title))
    .slice(0, Math.max(1, limit));

  return sorted.map((item, index) => ({ ...item, rank: index + 1, priority: priorityFromScore(item.score) }));
}

function sameMove(a: GameAnalyticsEvidenceMove, b: GameAnalyticsEvidenceMove): boolean {
  return a.gameId === b.gameId && a.ply === b.ply;
}

export function buildRecommendationTrainingMoves(
  memory: GameLibraryMemory,
  windowSize: 10 | 20 | 50,
  request: GameAnalyticsDrilldownRequest,
  limit = 7,
): GameAnalyticsEvidenceMove[] {
  const primary = buildGameAnalyticsDrilldown(memory, windowSize, request).movesList;
  const scope: GameAnalyticsDrilldownRequest = {
    ...request,
    metric: 'cpl',
  };
  const fallback = buildGameAnalyticsDrilldown(memory, windowSize, scope).movesList
    .filter((move) => move.cpl >= 25);
  const combined: GameAnalyticsEvidenceMove[] = [];
  for (const move of [...primary, ...fallback]) {
    if (!combined.some((existing) => sameMove(existing, move))) combined.push(move);
    if (combined.length >= limit) break;
  }
  return combined;
}

export function recommendationTrainingExercises(
  memory: GameLibraryMemory,
  recommendation: PersonalCoachRecommendation,
  limit = 7,
): TrainingExercise[] {
  const moves = buildRecommendationTrainingMoves(memory, recommendation.windowSize, recommendation.trainingRequest, limit);
  return moves.flatMap((move, index) => {
    const entry = memory.entries.find((item) => item.id === move.gameId);
    if (!entry) return [];
    try {
      const hydrated = hydrateGameLibraryEntry(entry);
      const record = hydrated.records[move.ply - 1];
      const review = record?.review;
      if (!record || !review?.bestMoveUci || !review.bestMoveSan) return [];
      const openingName = entry.opening
        ? (entry.opening.variation ? `${entry.opening.name} · ${entry.opening.variation}` : entry.opening.name)
        : undefined;
      return [{
        key: `coach:${recommendation.id}:${entry.id}:${record.ply}`,
        recordId: index + 1,
        ply: record.ply,
        beforeFen: record.beforeFen,
        originalMoveSan: record.san,
        originalVerdict: review.verdict,
        originalLoss: review.centipawnLoss,
        bestMoveUci: review.bestMoveUci,
        bestMoveSan: review.bestMoveSan,
        review,
        kind: 'review' as const,
        openingName,
        coachRecommendationId: recommendation.id,
        coachRecommendationTitle: recommendation.title,
        coachReason: recommendation.summary,
      }];
    } catch {
      return [];
    }
  });
}
