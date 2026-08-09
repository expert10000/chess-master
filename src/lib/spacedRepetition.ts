import type { Verdict } from './chessCoach';
import type { RepertoireMemory } from './repertoireMemory';
import type { TrainingExercise } from './training';
import type { WeaknessMemory, WeaknessTrainingSnapshot } from './weaknessProfile';

export const SPACED_REPETITION_STORAGE_KEY = 'stockfish-coach.spaced-repetition.v1';

export type SpacedSourceKind = 'repertoire' | 'weakness';

export interface SpacedExerciseSnapshot {
  beforeFen: string;
  ply: number;
  originalMoveSan: string;
  originalVerdict: Verdict;
  originalLoss: number;
  bestMoveUci: string;
  bestMoveSan: string;
  kind: 'opening' | 'weakness';
  openingName?: string;
  expectedMoves?: string[];
  expectedMoveSans?: string[];
  repertoirePositionKey?: string;
  weaknessLabel?: string;
}

export interface SpacedItem {
  id: string;
  sourceKind: SpacedSourceKind;
  sourceId: string;
  signature: string;
  label: string;
  detail: string;
  exercise: SpacedExerciseSnapshot;
  createdAt: number;
  updatedAt: number;
  dueAt: number;
  intervalDays: number;
  ease: number;
  streak: number;
  lapses: number;
  reviews: number;
  correct: number;
  lastReviewedAt: number | null;
  lastResult: 'correct' | 'incorrect' | null;
}

export interface SpacedRepetitionMemory {
  version: 1;
  items: Record<string, SpacedItem>;
}

export interface SpacedStats {
  total: number;
  due: number;
  learning: number;
  mature: number;
  repertoire: number;
  weakness: number;
  correct: number;
  reviews: number;
  accuracy: number;
  nextDueAt: number | null;
}

export interface SpacedAttemptInput {
  accepted: boolean;
  hintLevel: number;
  points: number;
}

interface SyncDescriptor {
  id: string;
  sourceKind: SpacedSourceKind;
  sourceId: string;
  signature: string;
  label: string;
  detail: string;
  exercise: SpacedExerciseSnapshot;
}

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

export function emptySpacedRepetitionMemory(): SpacedRepetitionMemory {
  return { version: 1, items: {} };
}

export function loadSpacedRepetitionMemory(raw: string | null | undefined): SpacedRepetitionMemory {
  if (!raw) return emptySpacedRepetitionMemory();

  try {
    const parsed = JSON.parse(raw) as Partial<SpacedRepetitionMemory>;
    if (parsed.version !== 1 || !parsed.items || typeof parsed.items !== 'object') {
      return emptySpacedRepetitionMemory();
    }

    const items: Record<string, SpacedItem> = {};
    for (const [id, candidate] of Object.entries(parsed.items)) {
      if (!candidate || typeof candidate !== 'object') continue;
      const item = candidate as SpacedItem;
      if (!item.exercise?.beforeFen || !item.exercise?.bestMoveUci) continue;
      items[id] = {
        ...item,
        id,
        intervalDays: Math.max(0, Number(item.intervalDays) || 0),
        ease: Math.min(3.1, Math.max(1.3, Number(item.ease) || 2.35)),
        streak: Math.max(0, Number(item.streak) || 0),
        lapses: Math.max(0, Number(item.lapses) || 0),
        reviews: Math.max(0, Number(item.reviews) || 0),
        correct: Math.max(0, Number(item.correct) || 0),
        dueAt: Number(item.dueAt) || Date.now(),
        createdAt: Number(item.createdAt) || Date.now(),
        updatedAt: Number(item.updatedAt) || Date.now(),
        lastReviewedAt: item.lastReviewedAt ? Number(item.lastReviewedAt) : null,
        lastResult: item.lastResult === 'correct' || item.lastResult === 'incorrect'
          ? item.lastResult
          : null,
      };
    }
    return { version: 1, items };
  } catch {
    return emptySpacedRepetitionMemory();
  }
}

export function serializeSpacedRepetitionMemory(memory: SpacedRepetitionMemory): string {
  return JSON.stringify(memory);
}

function repertoireDescriptors(memory: RepertoireMemory): SyncDescriptor[] {
  return Object.values(memory.choices).map((choice) => {
    const openingName = choice.variation
      ? `${choice.openingName} · ${choice.variation}`
      : choice.openingName;

    return {
      id: `rep:${choice.positionKey}`,
      sourceKind: 'repertoire' as const,
      sourceId: choice.positionKey,
      signature: `${choice.moveUci}|${choice.moveSan}`,
      label: `${openingName} · ${choice.moveSan}`,
      detail: `${choice.sideToMove === 'w' ? 'White' : 'Black'} repertoire recall`,
      exercise: {
        beforeFen: choice.fen,
        ply: 1,
        originalMoveSan: 'Repertoire recall',
        originalVerdict: 'Good' as const,
        originalLoss: 0,
        bestMoveUci: choice.moveUci,
        bestMoveSan: choice.moveSan,
        kind: 'opening' as const,
        openingName,
        expectedMoves: [choice.moveUci],
        expectedMoveSans: [choice.moveSan],
        repertoirePositionKey: choice.positionKey,
      },
    };
  });
}

function weaknessDescriptor(snapshot: WeaknessTrainingSnapshot): SyncDescriptor {
  return {
    id: `weak:${snapshot.id}`,
    sourceKind: 'weakness',
    sourceId: snapshot.id,
    signature: [
      snapshot.beforeFen,
      snapshot.bestMoveUci,
      snapshot.kind,
      snapshot.expectedMoves?.join(',') ?? '',
    ].join('|'),
    label: `${snapshot.weaknessLabel} · ${snapshot.bestMoveSan}`,
    detail: `Originally ${snapshot.originalMoveSan} · ${snapshot.originalVerdict}`,
    exercise: {
      beforeFen: snapshot.beforeFen,
      ply: snapshot.ply,
      originalMoveSan: snapshot.originalMoveSan,
      originalVerdict: snapshot.originalVerdict,
      originalLoss: snapshot.originalLoss,
      bestMoveUci: snapshot.bestMoveUci,
      bestMoveSan: snapshot.bestMoveSan,
      kind: snapshot.kind,
      openingName: snapshot.openingName,
      expectedMoves: snapshot.expectedMoves,
      expectedMoveSans: snapshot.expectedMoveSans,
      weaknessLabel: snapshot.weaknessLabel,
    },
  };
}

function weaknessDescriptors(memory: WeaknessMemory): SyncDescriptor[] {
  const seen = new Set<string>();
  const descriptors: SyncDescriptor[] = [];

  for (const aggregate of Object.values(memory.categories)) {
    for (const snapshot of aggregate.examples) {
      if (seen.has(snapshot.id)) continue;
      seen.add(snapshot.id);
      descriptors.push(weaknessDescriptor(snapshot));
    }
  }
  return descriptors;
}

function freshItem(descriptor: SyncDescriptor, now: number): SpacedItem {
  return {
    ...descriptor,
    createdAt: now,
    updatedAt: now,
    dueAt: now,
    intervalDays: 0,
    ease: 2.35,
    streak: 0,
    lapses: 0,
    reviews: 0,
    correct: 0,
    lastReviewedAt: null,
    lastResult: null,
  };
}

function sameExercise(a: SpacedExerciseSnapshot, b: SpacedExerciseSnapshot): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

export function syncSpacedRepetitionMemory(
  memory: SpacedRepetitionMemory,
  repertoire: RepertoireMemory,
  weaknesses: WeaknessMemory,
  now = Date.now(),
): SpacedRepetitionMemory {
  const descriptors = [
    ...repertoireDescriptors(repertoire),
    ...weaknessDescriptors(weaknesses),
  ];
  const activeRepertoireIds = new Set(
    descriptors.filter((item) => item.sourceKind === 'repertoire').map((item) => item.id),
  );

  let changed = false;
  const items: Record<string, SpacedItem> = { ...memory.items };

  // Forgotten repertoire choices should no longer stay in the review queue.
  for (const [id, item] of Object.entries(items)) {
    if (item.sourceKind === 'repertoire' && !activeRepertoireIds.has(id)) {
      delete items[id];
      changed = true;
    }
  }

  for (const descriptor of descriptors) {
    const existing = items[descriptor.id];
    if (!existing) {
      items[descriptor.id] = freshItem(descriptor, now);
      changed = true;
      continue;
    }

    // Changing a saved repertoire move changes the thing being memorized, so restart it.
    if (existing.signature !== descriptor.signature) {
      items[descriptor.id] = freshItem(descriptor, now);
      changed = true;
      continue;
    }

    if (
      existing.label !== descriptor.label
      || existing.detail !== descriptor.detail
      || !sameExercise(existing.exercise, descriptor.exercise)
    ) {
      items[descriptor.id] = {
        ...existing,
        label: descriptor.label,
        detail: descriptor.detail,
        exercise: descriptor.exercise,
        updatedAt: now,
      };
      changed = true;
    }
  }

  return changed ? { version: 1, items } : memory;
}

function nextCorrectInterval(item: SpacedItem, input: SpacedAttemptInput): {
  intervalDays: number;
  ease: number;
} {
  const heavyHints = input.hintLevel >= 3;
  const someHints = input.hintLevel > 0;

  if (item.streak === 0) {
    return {
      intervalDays: heavyHints ? 0.5 : 1,
      ease: Math.max(1.3, item.ease + (someHints ? -0.05 : 0.05)),
    };
  }

  if (item.streak === 1) {
    return {
      intervalDays: heavyHints ? 1 : someHints ? 2 : 3,
      ease: Math.max(1.3, item.ease + (someHints ? -0.04 : 0.04)),
    };
  }

  const qualityMultiplier = heavyHints ? 0.65 : someHints ? 0.82 : input.points >= 88 ? 1 : 0.9;
  const intervalDays = Math.max(
    1,
    Math.round(item.intervalDays * item.ease * qualityMultiplier * 10) / 10,
  );
  const easeDelta = heavyHints ? -0.12 : someHints ? -0.05 : input.points >= 88 ? 0.05 : 0;
  return {
    intervalDays,
    ease: Math.min(3.1, Math.max(1.3, item.ease + easeDelta)),
  };
}

export function recordSpacedAttempt(
  memory: SpacedRepetitionMemory,
  itemId: string,
  input: SpacedAttemptInput,
  now = Date.now(),
): SpacedRepetitionMemory {
  const item = memory.items[itemId];
  if (!item) return memory;

  let next: SpacedItem;
  if (!input.accepted) {
    next = {
      ...item,
      updatedAt: now,
      dueAt: now + 10 * MINUTE_MS,
      intervalDays: 0,
      ease: Math.max(1.3, item.ease - 0.2),
      streak: 0,
      lapses: item.lapses + 1,
      reviews: item.reviews + 1,
      lastReviewedAt: now,
      lastResult: 'incorrect',
    };
  } else {
    const schedule = nextCorrectInterval(item, input);
    next = {
      ...item,
      updatedAt: now,
      dueAt: now + schedule.intervalDays * DAY_MS,
      intervalDays: schedule.intervalDays,
      ease: schedule.ease,
      streak: item.streak + 1,
      reviews: item.reviews + 1,
      correct: item.correct + 1,
      lastReviewedAt: now,
      lastResult: 'correct',
    };
  }

  return {
    ...memory,
    items: {
      ...memory.items,
      [itemId]: next,
    },
  };
}

export function dueSpacedItems(
  memory: SpacedRepetitionMemory,
  now = Date.now(),
  limit = 20,
): SpacedItem[] {
  return Object.values(memory.items)
    .filter((item) => item.dueAt <= now)
    .sort((a, b) => a.dueAt - b.dueAt || a.intervalDays - b.intervalDays || a.label.localeCompare(b.label))
    .slice(0, Math.max(1, limit));
}

export function nextSpacedItems(
  memory: SpacedRepetitionMemory,
  now = Date.now(),
  limit = 5,
): SpacedItem[] {
  return Object.values(memory.items)
    .filter((item) => item.dueAt > now)
    .sort((a, b) => a.dueAt - b.dueAt)
    .slice(0, Math.max(1, limit));
}

export function spacedStats(
  memory: SpacedRepetitionMemory,
  now = Date.now(),
): SpacedStats {
  const items = Object.values(memory.items);
  const due = items.filter((item) => item.dueAt <= now).length;
  const future = items.filter((item) => item.dueAt > now).sort((a, b) => a.dueAt - b.dueAt);
  const reviews = items.reduce((sum, item) => sum + item.reviews, 0);
  const correct = items.reduce((sum, item) => sum + item.correct, 0);

  return {
    total: items.length,
    due,
    learning: items.filter((item) => item.reviews > 0 && item.intervalDays < 7).length,
    mature: items.filter((item) => item.intervalDays >= 7).length,
    repertoire: items.filter((item) => item.sourceKind === 'repertoire').length,
    weakness: items.filter((item) => item.sourceKind === 'weakness').length,
    correct,
    reviews,
    accuracy: reviews ? correct / reviews : 0,
    nextDueAt: due ? now : future[0]?.dueAt ?? null,
  };
}

export function spacedItemToTrainingExercise(item: SpacedItem, index = 0): TrainingExercise {
  return {
    key: `spaced:${item.id}:${index}`,
    recordId: index + 1,
    ply: item.exercise.ply,
    beforeFen: item.exercise.beforeFen,
    originalMoveSan: item.exercise.originalMoveSan,
    originalVerdict: item.exercise.originalVerdict,
    originalLoss: item.exercise.originalLoss,
    bestMoveUci: item.exercise.bestMoveUci,
    bestMoveSan: item.exercise.bestMoveSan,
    kind: item.exercise.kind,
    openingName: item.exercise.openingName,
    expectedMoves: item.exercise.expectedMoves,
    expectedMoveSans: item.exercise.expectedMoveSans,
    repertoirePositionKey: item.exercise.repertoirePositionKey,
    weaknessLabel: item.exercise.weaknessLabel,
    spacedItemId: item.id,
    spacedSource: item.sourceKind,
  };
}

export function formatSpacedDue(dueAt: number, now = Date.now()): string {
  const diff = dueAt - now;
  if (diff <= 0) return 'Due now';

  const minutes = Math.ceil(diff / MINUTE_MS);
  if (minutes < 60) return `in ${minutes}m`;

  const hours = Math.ceil(diff / (60 * MINUTE_MS));
  if (hours < 24) return `in ${hours}h`;

  const days = Math.ceil(diff / DAY_MS);
  if (days === 1) return 'tomorrow';
  if (days < 30) return `in ${days}d`;

  return new Date(dueAt).toLocaleDateString();
}
