import {
  hydrateGameLibraryEntry,
  type GameLibraryEntry,
  type GameLibraryMemory,
} from './gameLibrary';

export type GamePhase = 'opening' | 'middlegame' | 'endgame';
export type GameAnalyticsWindow = 'current' | 'previous' | 'all';
export type GameAnalyticsMetricKind = 'games' | 'moves' | 'cpl' | 'blunders' | 'issues';

export interface WindowMetric {
  games: number;
  reviewedMoves: number;
  avgCpl: number | null;
  blundersPerGame: number | null;
  issuesPerGame: number | null;
}

export interface ColorWindowMetric extends WindowMetric {
  color: 'w' | 'b';
}

export interface PhaseWindowMetric extends WindowMetric {
  phase: GamePhase;
  trend: 'improving' | 'declining' | 'stable' | 'n/a';
  deltaCpl: number | null;
  strength: 'Strong' | 'Good' | 'Developing' | 'Needs work' | 'No data';
}

export interface OpeningPerformanceRow {
  key: string;
  label: string;
  eco: string | null;
  games: number;
  reviewedMoves: number;
  avgCpl: number | null;
  blundersPerGame: number | null;
}

export interface GameAnalyticsWindowSummary extends WindowMetric {
  gamesByColor: ColorWindowMetric[];
  phases: PhaseWindowMetric[];
  openings: OpeningPerformanceRow[];
}

export interface GameAnalyticsSummary {
  windowSize: 10 | 20 | 50;
  availableReviewedGames: number;
  current: GameAnalyticsWindowSummary;
  previous: GameAnalyticsWindowSummary | null;
  overallTrend: {
    cplDelta: number | null;
    blunderDelta: number | null;
  };
}

export interface GameAnalyticsDrilldownRequest {
  window: GameAnalyticsWindow;
  metric: GameAnalyticsMetricKind;
  color?: 'w' | 'b';
  phase?: GamePhase;
  openingKey?: string;
  label?: string;
}

export interface GameAnalyticsEvidenceMove {
  gameId: string;
  ply: number;
  san: string;
  phase: GamePhase;
  color: 'w' | 'b';
  cpl: number;
  verdict: string;
  openingKey: string;
  openingLabel: string;
  openingEco: string | null;
}

export interface GameAnalyticsEvidenceGame {
  entry: GameLibraryEntry;
  matchingMoves: number;
  avgCpl: number | null;
  blunders: number;
  issues: number;
}

export interface GameAnalyticsDrilldownResult extends WindowMetric {
  request: GameAnalyticsDrilldownRequest;
  gamesList: GameAnalyticsEvidenceGame[];
  movesList: GameAnalyticsEvidenceMove[];
}

interface ReviewAggregate {
  games: Set<string>;
  reviewedMoves: number;
  cplSum: number;
  blunders: number;
  issues: number;
}

interface ReviewedMoveSample extends GameAnalyticsEvidenceMove {}

interface ReviewedGameSnapshot {
  entry: GameLibraryEntry;
  reviewedMoves: ReviewedMoveSample[];
  gameCplSum: number;
  gameReviewedMoves: number;
  blunders: number;
  issues: number;
}

function pieceMaterial(beforeFen: string): { nonPawnMaterial: number; queens: number; piecesExcludingKings: number } {
  const boardFen = beforeFen.split(' ')[0] ?? '';
  let nonPawnMaterial = 0;
  let queens = 0;
  let piecesExcludingKings = 0;
  for (const symbol of boardFen) {
    if (/\d|\//.test(symbol)) continue;
    const piece = symbol.toLowerCase();
    if (piece === 'k') continue;
    piecesExcludingKings += 1;
    if (piece === 'q') {
      queens += 1;
      nonPawnMaterial += 9;
    } else if (piece === 'r') {
      nonPawnMaterial += 5;
    } else if (piece === 'b' || piece === 'n') {
      nonPawnMaterial += 3;
    }
  }
  return { nonPawnMaterial, queens, piecesExcludingKings };
}

export function classifyGamePhase(beforeFen: string, ply: number): GamePhase {
  if (ply <= 20) return 'opening';
  const material = pieceMaterial(beforeFen);
  if (
    material.nonPawnMaterial <= 16
    || material.piecesExcludingKings <= 8
    || (material.queens <= 1 && material.nonPawnMaterial <= 22)
  ) return 'endgame';
  return 'middlegame';
}

function issueVerdict(verdict: string): boolean {
  return verdict === 'Inaccuracy' || verdict === 'Mistake' || verdict === 'Blunder';
}

function average(sum: number, count: number): number | null {
  return count > 0 ? sum / count : null;
}

function perGame(value: number, games: number): number | null {
  return games > 0 ? value / games : null;
}

function strengthFromCpl(avgCpl: number | null): PhaseWindowMetric['strength'] {
  if (avgCpl === null) return 'No data';
  if (avgCpl <= 45) return 'Strong';
  if (avgCpl <= 65) return 'Good';
  if (avgCpl <= 90) return 'Developing';
  return 'Needs work';
}

function trendFromCpl(current: number | null, previous: number | null): Pick<PhaseWindowMetric, 'trend' | 'deltaCpl'> {
  if (current === null || previous === null) return { trend: 'n/a', deltaCpl: null };
  const delta = current - previous;
  if (delta <= -8) return { trend: 'improving', deltaCpl: delta };
  if (delta >= 8) return { trend: 'declining', deltaCpl: delta };
  return { trend: 'stable', deltaCpl: delta };
}

const reviewedSnapshotCache = new WeakMap<GameLibraryEntry, ReviewedGameSnapshot[]>();

function reviewedSnapshots(memory: GameLibraryMemory): ReviewedGameSnapshot[] {
  return memory.entries
    .slice()
    .sort((a, b) => b.updatedAt - a.updatedAt)
    .filter((entry) => entry.reviewedHumanMoves > 0 && !entry.archived && !entry.modelGame)
    .flatMap((entry) => {
      const cached = reviewedSnapshotCache.get(entry);
      if (cached) return cached;
      try {
        const hydrated = hydrateGameLibraryEntry(entry);
        const openingKey = entry.opening?.eco || entry.opening?.name || 'unknown';
        const openingLabel = entry.opening
          ? (entry.opening.variation ? `${entry.opening.name} · ${entry.opening.variation}` : entry.opening.name)
          : 'Unclassified opening';

        const reviewedMoves = hydrated.records
          .filter((record) => record.color === entry.humanColor && record.review)
          .map((record) => ({
            gameId: entry.id,
            ply: record.ply,
            san: record.san,
            phase: classifyGamePhase(record.beforeFen, record.ply),
            color: record.color,
            cpl: record.review?.centipawnLoss ?? 0,
            verdict: record.review?.verdict ?? 'Good',
            openingKey,
            openingLabel,
            openingEco: entry.opening?.eco ?? null,
          }));

        const snapshot: ReviewedGameSnapshot = {
          entry,
          reviewedMoves,
          gameCplSum: reviewedMoves.reduce((sum, move) => sum + move.cpl, 0),
          gameReviewedMoves: reviewedMoves.length,
          blunders: reviewedMoves.filter((move) => move.verdict === 'Blunder').length,
          issues: reviewedMoves.filter((move) => issueVerdict(move.verdict)).length,
        };
        reviewedSnapshotCache.set(entry, [snapshot]);
        return [snapshot];
      } catch {
        reviewedSnapshotCache.set(entry, []);
        return [];
      }
    });
}

function snapshotsForWindow(
  reviewed: ReviewedGameSnapshot[],
  windowSize: 10 | 20 | 50,
  window: GameAnalyticsWindow,
): ReviewedGameSnapshot[] {
  if (window === 'all') return reviewed;
  if (window === 'previous') return reviewed.slice(windowSize, windowSize * 2);
  return reviewed.slice(0, windowSize);
}

function summarizeGames(games: ReviewedGameSnapshot[]): Omit<GameAnalyticsWindowSummary, 'gamesByColor' | 'phases' | 'openings'> & {
  colorBase: Map<'w' | 'b', ReviewAggregate>;
  phaseBase: Map<GamePhase, ReviewAggregate>;
  openingBase: Map<string, ReviewAggregate & { label: string; eco: string | null }>;
} {
  const colorBase = new Map<'w' | 'b', ReviewAggregate>([
    ['w', { games: new Set(), reviewedMoves: 0, cplSum: 0, blunders: 0, issues: 0 }],
    ['b', { games: new Set(), reviewedMoves: 0, cplSum: 0, blunders: 0, issues: 0 }],
  ]);
  const phaseBase = new Map<GamePhase, ReviewAggregate>([
    ['opening', { games: new Set(), reviewedMoves: 0, cplSum: 0, blunders: 0, issues: 0 }],
    ['middlegame', { games: new Set(), reviewedMoves: 0, cplSum: 0, blunders: 0, issues: 0 }],
    ['endgame', { games: new Set(), reviewedMoves: 0, cplSum: 0, blunders: 0, issues: 0 }],
  ]);
  const openingBase = new Map<string, ReviewAggregate & { label: string; eco: string | null }>();

  let reviewedMoves = 0;
  let cplSum = 0;
  let blunders = 0;
  let issues = 0;

  for (const game of games) {
    reviewedMoves += game.gameReviewedMoves;
    cplSum += game.gameCplSum;
    blunders += game.blunders;
    issues += game.issues;

    for (const move of game.reviewedMoves) {
      const color = colorBase.get(move.color)!;
      color.games.add(move.gameId);
      color.reviewedMoves += 1;
      color.cplSum += move.cpl;
      if (move.verdict === 'Blunder') color.blunders += 1;
      if (issueVerdict(move.verdict)) color.issues += 1;

      const phase = phaseBase.get(move.phase)!;
      phase.games.add(move.gameId);
      phase.reviewedMoves += 1;
      phase.cplSum += move.cpl;
      if (move.verdict === 'Blunder') phase.blunders += 1;
      if (issueVerdict(move.verdict)) phase.issues += 1;

      const opening = openingBase.get(move.openingKey) ?? {
        games: new Set<string>(),
        reviewedMoves: 0,
        cplSum: 0,
        blunders: 0,
        issues: 0,
        label: move.openingLabel,
        eco: move.openingEco,
      };
      opening.games.add(move.gameId);
      opening.reviewedMoves += 1;
      opening.cplSum += move.cpl;
      if (move.verdict === 'Blunder') opening.blunders += 1;
      if (issueVerdict(move.verdict)) opening.issues += 1;
      openingBase.set(move.openingKey, opening);
    }
  }

  return {
    games: games.length,
    reviewedMoves,
    avgCpl: average(cplSum, reviewedMoves),
    blundersPerGame: perGame(blunders, games.length),
    issuesPerGame: perGame(issues, games.length),
    colorBase,
    phaseBase,
    openingBase,
  };
}

function metricFromAggregate(
  aggregate: ReviewAggregate,
  color?: 'w' | 'b',
  phase?: GamePhase,
): WindowMetric | ColorWindowMetric | Omit<PhaseWindowMetric, 'trend' | 'deltaCpl' | 'strength'> {
  const games = aggregate.games.size;
  const base = {
    games,
    reviewedMoves: aggregate.reviewedMoves,
    avgCpl: average(aggregate.cplSum, aggregate.reviewedMoves),
    blundersPerGame: perGame(aggregate.blunders, games),
    issuesPerGame: perGame(aggregate.issues, games),
  };
  if (color) return { color, ...base };
  if (phase) return { phase, ...base };
  return base;
}

function openingRows(base: ReturnType<typeof summarizeGames>): OpeningPerformanceRow[] {
  return [...base.openingBase.entries()]
    .map(([key, aggregate]) => ({
      key,
      label: aggregate.label,
      eco: aggregate.eco,
      games: aggregate.games.size,
      reviewedMoves: aggregate.reviewedMoves,
      avgCpl: average(aggregate.cplSum, aggregate.reviewedMoves),
      blundersPerGame: perGame(aggregate.blunders, aggregate.games.size),
    }))
    .sort((a, b) => b.games - a.games || (a.avgCpl ?? 9999) - (b.avgCpl ?? 9999));
}

export function gameAnalyticsOpeningRows(
  memory: GameLibraryMemory,
  windowSize: 10 | 20 | 50,
  window: GameAnalyticsWindow = 'current',
): OpeningPerformanceRow[] {
  const reviewed = reviewedSnapshots(memory);
  return openingRows(summarizeGames(snapshotsForWindow(reviewed, windowSize, window)));
}

function moveMatchesRequest(move: ReviewedMoveSample, request: GameAnalyticsDrilldownRequest): boolean {
  if (request.color && move.color !== request.color) return false;
  if (request.phase && move.phase !== request.phase) return false;
  if (request.openingKey && move.openingKey !== request.openingKey) return false;
  return true;
}

function metricMoveMatches(move: ReviewedMoveSample, metric: GameAnalyticsMetricKind): boolean {
  if (metric === 'blunders') return move.verdict === 'Blunder';
  if (metric === 'issues') return issueVerdict(move.verdict);
  return true;
}

export function buildGameAnalyticsDrilldown(
  memory: GameLibraryMemory,
  windowSize: 10 | 20 | 50,
  request: GameAnalyticsDrilldownRequest,
): GameAnalyticsDrilldownResult {
  const reviewed = reviewedSnapshots(memory);
  const windowGames = snapshotsForWindow(reviewed, windowSize, request.window);
  const selected = windowGames.flatMap((game) =>
    game.reviewedMoves
      .filter((move) => moveMatchesRequest(move, request))
      .filter((move) => metricMoveMatches(move, request.metric))
  );

  const selectedGameIds = new Set(selected.map((move) => move.gameId));
  const gameRows = windowGames
    .filter((game) => selectedGameIds.has(game.entry.id))
    .map((game) => {
      const moves = selected.filter((move) => move.gameId === game.entry.id);
      return {
        entry: game.entry,
        matchingMoves: moves.length,
        avgCpl: average(moves.reduce((sum, move) => sum + move.cpl, 0), moves.length),
        blunders: moves.filter((move) => move.verdict === 'Blunder').length,
        issues: moves.filter((move) => issueVerdict(move.verdict)).length,
      };
    })
    .sort((a, b) => (b.avgCpl ?? -1) - (a.avgCpl ?? -1) || b.matchingMoves - a.matchingMoves);

  const movesList = selected
    .slice()
    .sort((a, b) => b.cpl - a.cpl || a.gameId.localeCompare(b.gameId) || a.ply - b.ply);
  const games = gameRows.length;
  const reviewedMoves = selected.length;
  const blunders = selected.filter((move) => move.verdict === 'Blunder').length;
  const issues = selected.filter((move) => issueVerdict(move.verdict)).length;

  return {
    request,
    games,
    reviewedMoves,
    avgCpl: average(selected.reduce((sum, move) => sum + move.cpl, 0), reviewedMoves),
    blundersPerGame: perGame(blunders, games),
    issuesPerGame: perGame(issues, games),
    gamesList: gameRows,
    movesList,
  };
}

export function buildGameAnalyticsSummary(
  memory: GameLibraryMemory,
  windowSize: 10 | 20 | 50,
): GameAnalyticsSummary {
  const reviewed = reviewedSnapshots(memory);
  const currentGames = reviewed.slice(0, windowSize);
  const previousGames = reviewed.slice(windowSize, windowSize * 2);
  const currentBase = summarizeGames(currentGames);
  const previousBase = previousGames.length ? summarizeGames(previousGames) : null;

  const currentPhases = (['opening', 'middlegame', 'endgame'] as GamePhase[]).map((phase) => {
    const base = metricFromAggregate(currentBase.phaseBase.get(phase)!, undefined, phase) as Omit<PhaseWindowMetric, 'trend' | 'deltaCpl' | 'strength'>;
    const previous = previousBase
      ? metricFromAggregate(previousBase.phaseBase.get(phase)!, undefined, phase) as Omit<PhaseWindowMetric, 'trend' | 'deltaCpl' | 'strength'>
      : null;
    const trend = trendFromCpl(base.avgCpl, previous?.avgCpl ?? null);
    return {
      ...base,
      ...trend,
      strength: strengthFromCpl(base.avgCpl),
    };
  });

  const currentColors = (['w', 'b'] as Array<'w' | 'b'>).map((color) =>
    metricFromAggregate(currentBase.colorBase.get(color)!, color) as ColorWindowMetric
  );

  const currentSummary: GameAnalyticsWindowSummary = {
    games: currentBase.games,
    reviewedMoves: currentBase.reviewedMoves,
    avgCpl: currentBase.avgCpl,
    blundersPerGame: currentBase.blundersPerGame,
    issuesPerGame: currentBase.issuesPerGame,
    gamesByColor: currentColors,
    phases: currentPhases,
    openings: openingRows(currentBase).slice(0, 5),
  };

  const previousSummary: GameAnalyticsWindowSummary | null = previousBase
    ? {
        games: previousBase.games,
        reviewedMoves: previousBase.reviewedMoves,
        avgCpl: previousBase.avgCpl,
        blundersPerGame: previousBase.blundersPerGame,
        issuesPerGame: previousBase.issuesPerGame,
        gamesByColor: (['w', 'b'] as Array<'w' | 'b'>).map((color) =>
          metricFromAggregate(previousBase.colorBase.get(color)!, color) as ColorWindowMetric
        ),
        phases: (['opening', 'middlegame', 'endgame'] as GamePhase[]).map((phase) => ({
          ...(metricFromAggregate(previousBase.phaseBase.get(phase)!, undefined, phase) as Omit<PhaseWindowMetric, 'trend' | 'deltaCpl' | 'strength'>),
          trend: 'n/a',
          deltaCpl: null,
          strength: strengthFromCpl(
            (metricFromAggregate(previousBase.phaseBase.get(phase)!, undefined, phase) as Omit<PhaseWindowMetric, 'trend' | 'deltaCpl' | 'strength'>).avgCpl
          ),
        })),
        openings: openingRows(previousBase).slice(0, 5),
      }
    : null;

  return {
    windowSize,
    availableReviewedGames: reviewed.length,
    current: currentSummary,
    previous: previousSummary,
    overallTrend: {
      cplDelta: currentSummary.avgCpl !== null
        && previousSummary !== null
        && previousSummary.avgCpl !== null
        ? currentSummary.avgCpl - previousSummary.avgCpl
        : null,
      blunderDelta: currentSummary.blundersPerGame !== null
        && previousSummary !== null
        && previousSummary.blundersPerGame !== null
        ? currentSummary.blundersPerGame - previousSummary.blundersPerGame
        : null,
    },
  };
}
