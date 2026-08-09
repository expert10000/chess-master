import { analyzeMoveConcepts } from './chessConcepts';
import type { MoveReview, Verdict } from './chessCoach';
import type { OpeningRecognition } from './openingBook';
import { buildPositionalBeforeAfter, type PositionMetricId } from './positionProfile';

export const WEAKNESS_STORAGE_KEY = 'stockfish-coach.weakness-profile.v1';

export type WeaknessCategoryId =
  | 'hanging-pieces'
  | 'missed-tactics'
  | 'king-safety'
  | 'pawn-structure'
  | 'development'
  | 'opening-deviations';

export interface WeaknessCategoryMeta {
  id: WeaknessCategoryId;
  label: string;
  shortLabel: string;
  description: string;
}

export const WEAKNESS_CATEGORIES: WeaknessCategoryMeta[] = [
  {
    id: 'hanging-pieces',
    label: 'Hanging pieces',
    shortLabel: 'Hanging',
    description: 'Loose, undefended, or overloaded pieces and material left tactically vulnerable.',
  },
  {
    id: 'missed-tactics',
    label: 'Missed tactics',
    shortLabel: 'Tactics',
    description: 'Forks, pins, skewers, forcing checks, defender removal, and other concrete opportunities.',
  },
  {
    id: 'king-safety',
    label: 'King safety',
    shortLabel: 'King',
    description: 'Moves that expose the king, weaken its zone, or miss a safer king arrangement.',
  },
  {
    id: 'pawn-structure',
    label: 'Pawn structure',
    shortLabel: 'Pawns',
    description: 'Doubled or isolated pawns and structural decisions that make the position harder to defend.',
  },
  {
    id: 'development',
    label: 'Poor development',
    shortLabel: 'Development',
    description: 'Falling behind in development or choosing a move when a much stronger developing move was available.',
  },
  {
    id: 'opening-deviations',
    label: 'Opening deviations',
    shortLabel: 'Opening',
    description: 'First departures from the bundled opening book or from remembered opening preparation.',
  },
];

export interface WeaknessTrainingSnapshot {
  id: string;
  category: WeaknessCategoryId;
  createdAt: number;
  beforeFen: string;
  ply: number;
  originalMoveSan: string;
  originalVerdict: Verdict;
  originalLoss: number;
  bestMoveUci: string;
  bestMoveSan: string;
  kind: 'weakness' | 'opening';
  weaknessLabel: string;
  openingName?: string;
  expectedMoves?: string[];
  expectedMoveSans?: string[];
}

export interface WeaknessAggregate {
  id: WeaknessCategoryId;
  occurrences: number;
  severity: number;
  totalLossCp: number;
  lastSeenAt: number;
  examples: WeaknessTrainingSnapshot[];
}

export interface WeaknessMemory {
  version: 1;
  reviewedMoves: number;
  categories: Record<WeaknessCategoryId, WeaknessAggregate>;
}

export interface WeaknessProfileRow {
  id: WeaknessCategoryId;
  label: string;
  shortLabel: string;
  description: string;
  occurrences: number;
  severity: number;
  averageLossCp: number;
  priority: number;
  examples: number;
}

function emptyAggregate(id: WeaknessCategoryId): WeaknessAggregate {
  return {
    id,
    occurrences: 0,
    severity: 0,
    totalLossCp: 0,
    lastSeenAt: 0,
    examples: [],
  };
}

export function emptyWeaknessMemory(): WeaknessMemory {
  return {
    version: 1,
    reviewedMoves: 0,
    categories: Object.fromEntries(
      WEAKNESS_CATEGORIES.map((category) => [category.id, emptyAggregate(category.id)]),
    ) as Record<WeaknessCategoryId, WeaknessAggregate>,
  };
}

export function loadWeaknessMemory(raw: string | null | undefined): WeaknessMemory {
  if (!raw) return emptyWeaknessMemory();

  try {
    const parsed = JSON.parse(raw) as Partial<WeaknessMemory>;
    if (parsed.version !== 1 || typeof parsed.reviewedMoves !== 'number' || !parsed.categories) {
      return emptyWeaknessMemory();
    }

    const fresh = emptyWeaknessMemory();
    for (const category of WEAKNESS_CATEGORIES) {
      const candidate = parsed.categories[category.id] as WeaknessAggregate | undefined;
      if (!candidate) continue;
      fresh.categories[category.id] = {
        id: category.id,
        occurrences: Math.max(0, Number(candidate.occurrences) || 0),
        severity: Math.max(0, Number(candidate.severity) || 0),
        totalLossCp: Math.max(0, Number(candidate.totalLossCp) || 0),
        lastSeenAt: Math.max(0, Number(candidate.lastSeenAt) || 0),
        examples: Array.isArray(candidate.examples) ? candidate.examples.slice(0, 24) : [],
      };
    }
    fresh.reviewedMoves = Math.max(0, parsed.reviewedMoves);
    return fresh;
  } catch {
    return emptyWeaknessMemory();
  }
}

export function serializeWeaknessMemory(memory: WeaknessMemory): string {
  return JSON.stringify(memory);
}

function issueReview(review: MoveReview): boolean {
  return review.verdict === 'Inaccuracy' || review.verdict === 'Mistake' || review.verdict === 'Blunder';
}

function metricDeltaDifference(
  review: MoveReview,
  metric: PositionMetricId,
): number {
  const played = buildPositionalBeforeAfter(review, 'played');
  const best = buildPositionalBeforeAfter(review, 'best');
  if (!played || !best) return 0;
  const playedDelta = played.changes.find((change) => change.id === metric)?.delta ?? 0;
  const bestDelta = best.changes.find((change) => change.id === metric)?.delta ?? 0;
  return bestDelta - playedDelta;
}

function reviewText(review: MoveReview): string {
  return [
    review.title,
    review.summary,
    ...review.reasons,
    ...(review.concepts ?? []).flatMap((concept) => [concept.id, concept.label, concept.detail]),
  ].join(' ').toLowerCase();
}

export function deriveWeaknessCategories(review: MoveReview): WeaknessCategoryId[] {
  if (!issueReview(review)) return [];

  const categories = new Set<WeaknessCategoryId>();
  const text = reviewText(review);
  const playedConcepts = review.concepts ?? [];
  const bestConcepts = review.bestMoveUci
    ? analyzeMoveConcepts(review.beforeFen, review.bestMoveUci)
    : [];

  if (
    playedConcepts.some((concept) => concept.label === 'Hanging piece' || concept.label === 'Overloaded defender')
    || /hanging|undefended|loose piece|drops? (a |the )?(piece|rook|bishop|knight|queen)|overloaded defender/.test(text)
  ) {
    categories.add('hanging-pieces');
  }

  const tacticalLabels = /\b(fork|double attack|pin|pinned|skewer|discovered|removal of defender|forcing check|checkmate|tactical)\b/;
  if (
    bestConcepts.some((concept) => concept.category === 'tactical' || tacticalLabels.test(concept.label.toLowerCase()))
    || tacticalLabels.test(text)
    || metricDeltaDifference(review, 'tacticalPressure') >= 0.9
  ) {
    categories.add('missed-tactics');
  }

  if (
    playedConcepts.some((concept) => concept.label === 'Exposed king zone')
    || /king safety|exposed king|king zone|weakened king|mate threat/.test(text)
    || metricDeltaDifference(review, 'kingSafety') >= 0.85
  ) {
    categories.add('king-safety');
  }

  if (
    playedConcepts.some((concept) => concept.label === 'Doubled pawns' || concept.label === 'Isolated pawn')
    || /doubled pawn|isolated pawn|pawn structure|structural weakness/.test(text)
    || metricDeltaDifference(review, 'pawnStructure') >= 0.8
  ) {
    categories.add('pawn-structure');
  }

  if (
    /development|undeveloped|developing move|piece development/.test(text)
    || metricDeltaDifference(review, 'development') >= 0.9
  ) {
    categories.add('development');
  }

  return [...categories];
}

function verdictSeverity(verdict: Verdict): number {
  if (verdict === 'Blunder') return 3.4;
  if (verdict === 'Mistake') return 2.4;
  if (verdict === 'Inaccuracy') return 1.45;
  if (verdict === 'Good') return 0.45;
  return 0.2;
}

function observationSeverity(verdict: Verdict, lossCp: number): number {
  return verdictSeverity(verdict) + Math.min(3.2, Math.max(0, lossCp) / 110);
}

function appendExample(
  aggregate: WeaknessAggregate,
  example: WeaknessTrainingSnapshot | null,
): WeaknessTrainingSnapshot[] {
  if (!example) return aggregate.examples;
  const withoutSame = aggregate.examples.filter((item) => item.id !== example.id);
  return [example, ...withoutSame].slice(0, 24);
}

function addObservation(
  memory: WeaknessMemory,
  category: WeaknessCategoryId,
  input: {
    verdict: Verdict;
    lossCp: number;
    example: WeaknessTrainingSnapshot | null;
    now: number;
  },
): WeaknessMemory {
  const current = memory.categories[category] ?? emptyAggregate(category);
  return {
    ...memory,
    categories: {
      ...memory.categories,
      [category]: {
        ...current,
        occurrences: current.occurrences + 1,
        severity: current.severity + observationSeverity(input.verdict, input.lossCp),
        totalLossCp: current.totalLossCp + Math.max(0, input.lossCp),
        lastSeenAt: input.now,
        examples: appendExample(current, input.example),
      },
    },
  };
}

export function recordReviewedMoveWeakness(
  memory: WeaknessMemory,
  input: {
    observationId: string;
    ply: number;
    san: string;
    review: MoveReview;
  },
  now = Date.now(),
): WeaknessMemory {
  const categories = deriveWeaknessCategories(input.review);
  let next: WeaknessMemory = {
    ...memory,
    reviewedMoves: memory.reviewedMoves + 1,
  };

  if (!input.review.bestMoveUci || !input.review.bestMoveSan) return next;

  for (const category of categories) {
    const meta = WEAKNESS_CATEGORIES.find((item) => item.id === category)!;
    const example: WeaknessTrainingSnapshot = {
      id: `${input.observationId}:${category}`,
      category,
      createdAt: now,
      beforeFen: input.review.beforeFen,
      ply: input.ply,
      originalMoveSan: input.san,
      originalVerdict: input.review.verdict,
      originalLoss: input.review.centipawnLoss,
      bestMoveUci: input.review.bestMoveUci,
      bestMoveSan: input.review.bestMoveSan,
      kind: 'weakness',
      weaknessLabel: meta.label,
    };

    next = addObservation(next, category, {
      verdict: input.review.verdict,
      lossCp: input.review.centipawnLoss,
      example,
      now,
    });
  }

  return next;
}

export function recordOpeningDeviationWeakness(
  memory: WeaknessMemory,
  recognition: OpeningRecognition,
  review?: MoveReview,
  observationId = 'opening',
  now = Date.now(),
): WeaknessMemory {
  const deviation = recognition.deviation;
  const top = recognition.alternatives[0];
  if (!deviation) return memory;

  const openingName = recognition.variation
    ? `${recognition.name} · ${recognition.variation}`
    : recognition.name;
  const verdict = review?.verdict ?? 'Good';
  const lossCp = review?.centipawnLoss ?? 0;

  const example: WeaknessTrainingSnapshot | null = top
    ? {
        id: `${observationId}:opening-deviations`,
        category: 'opening-deviations',
        createdAt: now,
        beforeFen: deviation.beforeFen,
        ply: deviation.ply,
        originalMoveSan: deviation.san,
        originalVerdict: verdict,
        originalLoss: lossCp,
        bestMoveUci: top.uci,
        bestMoveSan: top.san,
        kind: 'opening',
        weaknessLabel: 'Opening deviations',
        openingName,
        expectedMoves: recognition.alternatives.map((alternative) => alternative.uci),
        expectedMoveSans: recognition.alternatives.map((alternative) => alternative.san),
      }
    : null;

  return addObservation(memory, 'opening-deviations', {
    verdict,
    lossCp,
    example,
    now,
  });
}

export function weaknessProfileRows(memory: WeaknessMemory): WeaknessProfileRow[] {
  return WEAKNESS_CATEGORIES
    .map((meta) => {
      const aggregate = memory.categories[meta.id] ?? emptyAggregate(meta.id);
      const averageLossCp = aggregate.occurrences
        ? aggregate.totalLossCp / aggregate.occurrences
        : 0;
      const frequency = aggregate.occurrences;
      const impact = Math.min(4.5, averageLossCp / 90);
      const priority = aggregate.occurrences
        ? aggregate.severity + frequency * 0.55 + impact
        : 0;

      return {
        ...meta,
        occurrences: aggregate.occurrences,
        severity: aggregate.severity,
        averageLossCp,
        priority,
        examples: aggregate.examples.length,
      };
    })
    .sort((a, b) => b.priority - a.priority || b.occurrences - a.occurrences);
}

export function weakestCategory(memory: WeaknessMemory): WeaknessProfileRow | null {
  return weaknessProfileRows(memory).find((row) => row.occurrences > 0 && row.examples > 0) ?? null;
}

export function weaknessTrainingExamples(
  memory: WeaknessMemory,
  category: WeaknessCategoryId,
  limit = 12,
): WeaknessTrainingSnapshot[] {
  return (memory.categories[category]?.examples ?? [])
    .slice()
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, Math.max(1, limit));
}
