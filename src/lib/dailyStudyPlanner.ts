import type { PlyRecord } from '../components/MoveList';
import type { TrainingExercise } from './training';
import {
  spacedItemToTrainingExercise,
  type SpacedItem,
  type SpacedRepetitionMemory,
} from './spacedRepetition';
import {
  weaknessProfileRows,
  weaknessTrainingExamples,
  type WeaknessMemory,
  type WeaknessTrainingSnapshot,
} from './weaknessProfile';

export type DailyStudyDuration = 15 | 20 | 30;

export type DailyStudySource =
  | 'due-repertoire'
  | 'weakest-area'
  | 'recent-mistake'
  | 'new-material';

export interface DailyStudyPlanItem {
  id: string;
  source: DailyStudySource;
  sourceLabel: string;
  reason: string;
  exercise: TrainingExercise;
}

export interface DailyStudyPlanCounts {
  dueRepertoire: number;
  weakestAreas: number;
  recentMistakes: number;
  newMaterial: number;
}

export interface DailyStudyPlan {
  dateKey: string;
  generatedAt: number;
  durationMinutes: DailyStudyDuration;
  targetPositions: number;
  estimatedMinutes: number;
  items: DailyStudyPlanItem[];
  counts: DailyStudyPlanCounts;
  weakestLabels: string[];
  weeklyAdjusted: boolean;
  weeklyPriorityLabels: string[];
  summary: string;
}

export interface BuildDailyStudyPlanInput {
  durationMinutes: DailyStudyDuration;
  now?: number;
  spacedMemory: SpacedRepetitionMemory;
  weaknessMemory: WeaknessMemory;
  records: PlyRecord[];
  humanColor: 'w' | 'b';
  weeklyPriorityMultipliers?: Record<string, number>;
  weeklyPriorityReasons?: Record<string, string>;
}

const TARGETS: Record<DailyStudyDuration, {
  total: number;
  due: number;
  weakest: number;
  recent: number;
  fresh: number;
}> = {
  15: { total: 10, due: 4, weakest: 3, recent: 2, fresh: 1 },
  20: { total: 13, due: 5, weakest: 4, recent: 3, fresh: 1 },
  30: { total: 20, due: 7, weakest: 6, recent: 5, fresh: 2 },
};

function localDateKey(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function targetPositionsForDuration(duration: DailyStudyDuration): number {
  return TARGETS[duration].total;
}

function issueRecord(record: PlyRecord, humanColor: 'w' | 'b'): boolean {
  return record.color === humanColor
    && Boolean(record.review?.bestMoveUci)
    && Boolean(record.review?.bestMoveSan)
    && (
      record.review?.verdict === 'Inaccuracy'
      || record.review?.verdict === 'Mistake'
      || record.review?.verdict === 'Blunder'
    );
}

function fingerprint(exercise: TrainingExercise): string {
  return `${exercise.beforeFen}|${exercise.bestMoveUci}|${exercise.expectedMoves?.join(',') ?? ''}`;
}

function decorate(
  exercise: TrainingExercise,
  source: DailyStudySource,
  sourceLabel: string,
  reason: string,
  dateKey: string,
  index: number,
): DailyStudyPlanItem {
  return {
    id: `${dateKey}:${source}:${index}:${fingerprint(exercise)}`,
    source,
    sourceLabel,
    reason,
    exercise: {
      ...exercise,
      key: `daily:${dateKey}:${source}:${index}:${exercise.key}`,
      dailySource: source,
      dailySourceLabel: sourceLabel,
      dailyReason: reason,
    },
  };
}

function recentRecordExercise(record: PlyRecord, index: number): TrainingExercise | null {
  const review = record.review;
  if (!review?.bestMoveUci || !review.bestMoveSan) return null;

  return {
    key: `recent:${record.id}:${record.ply}:${index}`,
    recordId: record.id,
    ply: record.ply,
    beforeFen: record.beforeFen,
    originalMoveSan: record.san,
    originalVerdict: review.verdict,
    originalLoss: review.centipawnLoss,
    bestMoveUci: review.bestMoveUci,
    bestMoveSan: review.bestMoveSan,
    review,
    kind: 'review',
  };
}

function snapshotExercise(
  snapshot: WeaknessTrainingSnapshot,
  spacedMemory: SpacedRepetitionMemory,
  index: number,
): TrainingExercise {
  const spaced = spacedMemory.items[`weak:${snapshot.id}`];
  if (spaced) return spacedItemToTrainingExercise(spaced, index);

  return {
    key: `daily-weakness:${snapshot.id}:${index}`,
    recordId: index + 1,
    ply: snapshot.ply,
    beforeFen: snapshot.beforeFen,
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
  };
}

function exercisePriorityLabel(exercise: {
  openingName?: string;
  weaknessLabel?: string;
}): string | null {
  return exercise.weaknessLabel ?? exercise.openingName ?? null;
}

function weeklyMultiplier(
  label: string | null | undefined,
  multipliers?: Record<string, number>,
): number {
  if (!label || !multipliers) return 1;
  return multipliers[label] ?? 1;
}

function weeklyReason(
  label: string | null | undefined,
  multipliers?: Record<string, number>,
  reasons?: Record<string, string>,
): string {
  if (!label || !multipliers) return '';
  const multiplier = multipliers[label] ?? 1;
  if (Math.abs(multiplier - 1) < 0.05) return '';
  const reason = reasons?.[label];
  return ` · Weekly coach ${multiplier > 1 ? 'boost' : 'reduction'} ×${multiplier.toFixed(2)}${reason ? ` (${reason})` : ''}`;
}

function overdueUrgencyBand(dueAt: number, now: number): number {
  const overdueDays = Math.max(0, (now - dueAt) / 86_400_000);
  if (overdueDays >= 14) return 4;
  if (overdueDays >= 7) return 3;
  if (overdueDays >= 2) return 2;
  if (overdueDays > 0) return 1;
  return 0;
}

function dueRepertoireCandidates(
  memory: SpacedRepetitionMemory,
  now: number,
  multipliers?: Record<string, number>,
): SpacedItem[] {
  return Object.values(memory.items)
    .filter((item) => item.sourceKind === 'repertoire' && item.reviews > 0 && item.dueAt <= now)
    .sort((a, b) => {
      const urgencyA = overdueUrgencyBand(a.dueAt, now);
      const urgencyB = overdueUrgencyBand(b.dueAt, now);
      const priorityA = weeklyMultiplier(exercisePriorityLabel(a.exercise), multipliers);
      const priorityB = weeklyMultiplier(exercisePriorityLabel(b.exercise), multipliers);
      return urgencyB - urgencyA
        || priorityB - priorityA
        || a.dueAt - b.dueAt
        || a.intervalDays - b.intervalDays
        || a.label.localeCompare(b.label);
    });
}

function newMaterialCandidates(
  memory: SpacedRepetitionMemory,
  multipliers?: Record<string, number>,
): SpacedItem[] {
  return Object.values(memory.items)
    .filter((item) => item.reviews === 0)
    .sort((a, b) => {
      const priorityA = weeklyMultiplier(exercisePriorityLabel(a.exercise), multipliers);
      const priorityB = weeklyMultiplier(exercisePriorityLabel(b.exercise), multipliers);
      return priorityB - priorityA
        || b.createdAt - a.createdAt
        || a.sourceKind.localeCompare(b.sourceKind)
        || a.label.localeCompare(b.label);
    });
}

function allDueReviewCandidates(
  memory: SpacedRepetitionMemory,
  now: number,
  multipliers?: Record<string, number>,
): SpacedItem[] {
  return Object.values(memory.items)
    .filter((item) => item.reviews > 0 && item.dueAt <= now)
    .sort((a, b) => {
      const urgencyA = overdueUrgencyBand(a.dueAt, now);
      const urgencyB = overdueUrgencyBand(b.dueAt, now);
      const priorityA = weeklyMultiplier(exercisePriorityLabel(a.exercise), multipliers);
      const priorityB = weeklyMultiplier(exercisePriorityLabel(b.exercise), multipliers);
      return urgencyB - urgencyA
        || priorityB - priorityA
        || a.dueAt - b.dueAt
        || a.label.localeCompare(b.label);
    });
}

function recentWeaknessSnapshots(memory: WeaknessMemory): WeaknessTrainingSnapshot[] {
  const seen = new Set<string>();
  const snapshots: WeaknessTrainingSnapshot[] = [];

  for (const category of Object.values(memory.categories)) {
    for (const example of category.examples) {
      if (seen.has(example.id)) continue;
      seen.add(example.id);
      snapshots.push(example);
    }
  }

  return snapshots.sort((a, b) => b.createdAt - a.createdAt);
}

function weakestAreaCandidates(
  weaknessMemory: WeaknessMemory,
  spacedMemory: SpacedRepetitionMemory,
  multipliers?: Record<string, number>,
): Array<{ exercise: TrainingExercise; label: string; priority: number }> {
  const rows = weaknessProfileRows(weaknessMemory)
    .filter((row) => row.examples > 0)
    .sort((a, b) =>
      b.priority * weeklyMultiplier(b.label, multipliers)
      - a.priority * weeklyMultiplier(a.label, multipliers)
    )
    .slice(0, 3);
  const result: Array<{ exercise: TrainingExercise; label: string; priority: number }> = [];

  let depth = 0;
  while (depth < 12) {
    let added = false;
    for (const row of rows) {
      const example = weaknessTrainingExamples(weaknessMemory, row.id, 12)[depth];
      if (!example) continue;
      result.push({
        exercise: snapshotExercise(example, spacedMemory, result.length),
        label: row.label,
        priority: row.priority,
      });
      added = true;
    }
    if (!added) break;
    depth += 1;
  }

  return result;
}

function addUnique(
  target: DailyStudyPlanItem[],
  used: Set<string>,
  exercise: TrainingExercise,
  source: DailyStudySource,
  sourceLabel: string,
  reason: string,
  dateKey: string,
): boolean {
  const key = fingerprint(exercise);
  if (used.has(key)) return false;
  used.add(key);
  target.push(decorate(exercise, source, sourceLabel, reason, dateKey, target.length));
  return true;
}

function takeUntil(
  target: DailyStudyPlanItem[],
  used: Set<string>,
  limit: number,
  candidates: Array<{ exercise: TrainingExercise; label: string; reason: string }>,
  source: DailyStudySource,
  dateKey: string,
): void {
  let taken = 0;
  for (const candidate of candidates) {
    if (taken >= limit) break;
    if (addUnique(target, used, candidate.exercise, source, candidate.label, candidate.reason, dateKey)) {
      taken += 1;
    }
  }
}

function interleave(items: DailyStudyPlanItem[]): DailyStudyPlanItem[] {
  const order: DailyStudySource[] = ['due-repertoire', 'weakest-area', 'recent-mistake', 'new-material'];
  const queues = new Map<DailyStudySource, DailyStudyPlanItem[]>(
    order.map((source) => [source, items.filter((item) => item.source === source)]),
  );
  const result: DailyStudyPlanItem[] = [];

  while (result.length < items.length) {
    let progressed = false;
    for (const source of order) {
      const queue = queues.get(source)!;
      const next = queue.shift();
      if (!next) continue;
      result.push(next);
      progressed = true;
    }
    if (!progressed) break;
  }

  return result.map((item, index) => ({
    ...item,
    id: `${item.id}:order-${index}`,
    exercise: {
      ...item.exercise,
      key: `${item.exercise.key}:order-${index}`,
    },
  }));
}

export function buildAdaptiveDailyStudyPlan(input: BuildDailyStudyPlanInput): DailyStudyPlan {
  const now = input.now ?? Date.now();
  const dateKey = localDateKey(now);
  const target = TARGETS[input.durationMinutes];
  const selected: DailyStudyPlanItem[] = [];
  const used = new Set<string>();

  const dueRepertoire = dueRepertoireCandidates(input.spacedMemory, now, input.weeklyPriorityMultipliers).map((item, index) => ({
    exercise: spacedItemToTrainingExercise(item, index),
    label: 'Due repertoire',
    reason: (item.dueAt < now
      ? `Overdue repertoire recall · ${item.label}`
      : `Repertoire recall is due · ${item.label}`)
      + weeklyReason(exercisePriorityLabel(item.exercise), input.weeklyPriorityMultipliers, input.weeklyPriorityReasons),
  }));
  takeUntil(selected, used, target.due, dueRepertoire, 'due-repertoire', dateKey);

  const weakest = weakestAreaCandidates(input.weaknessMemory, input.spacedMemory, input.weeklyPriorityMultipliers).map((candidate) => ({
    exercise: candidate.exercise,
    label: candidate.label,
    reason: `High-priority recurring weakness · ${candidate.label}${weeklyReason(candidate.label, input.weeklyPriorityMultipliers, input.weeklyPriorityReasons)}`,
  }));
  takeUntil(selected, used, target.weakest, weakest, 'weakest-area', dateKey);

  const recentRecords = input.records
    .filter((record) => issueRecord(record, input.humanColor))
    .slice()
    .sort((a, b) => b.ply - a.ply)
    .map((record, index) => ({
      exercise: recentRecordExercise(record, index)!,
      label: 'Recent mistake',
      reason: `${record.review!.verdict} from the current reviewed game · ${record.san} · ${record.review!.centipawnLoss} cp loss`,
    }));
  const recentFallback = recentWeaknessSnapshots(input.weaknessMemory).map((snapshot, index) => ({
    exercise: snapshotExercise(snapshot, input.spacedMemory, index),
    label: 'Recent mistake',
    reason: `Recent stored ${snapshot.weaknessLabel.toLowerCase()} position · originally ${snapshot.originalMoveSan}`,
  }));
  takeUntil(
    selected,
    used,
    target.recent,
    [...recentRecords, ...recentFallback],
    'recent-mistake',
    dateKey,
  );

  const fresh = newMaterialCandidates(input.spacedMemory, input.weeklyPriorityMultipliers).map((item, index) => ({
    exercise: spacedItemToTrainingExercise(item, index),
    label: 'New material',
    reason: (item.sourceKind === 'repertoire'
      ? `New repertoire card · ${item.label}`
      : `New weakness card · ${item.label}`)
      + weeklyReason(exercisePriorityLabel(item.exercise), input.weeklyPriorityMultipliers, input.weeklyPriorityReasons),
  }));
  takeUntil(selected, used, target.fresh, fresh, 'new-material', dateKey);

  // If a bucket is undersupplied, fill the remaining study time without increasing
  // the new-material cap. Due review and recurring weaknesses take precedence.
  if (selected.length < target.total) {
    const dueFallback = allDueReviewCandidates(input.spacedMemory, now, input.weeklyPriorityMultipliers).map((item, index) => ({
      exercise: spacedItemToTrainingExercise(item, index),
      label: item.sourceKind === 'repertoire' ? 'Due repertoire' : 'Due weakness review',
      reason: `${item.sourceKind === 'repertoire' ? 'Repertoire' : 'Weakness'} review is due · ${item.label}`,
    }));
    for (const candidate of dueFallback) {
      if (selected.length >= target.total) break;
      addUnique(
        selected,
        used,
        candidate.exercise,
        candidate.exercise.spacedSource === 'repertoire' ? 'due-repertoire' : 'weakest-area',
        candidate.label,
        candidate.reason,
        dateKey,
      );
    }
  }

  if (selected.length < target.total) {
    for (const candidate of weakest) {
      if (selected.length >= target.total) break;
      addUnique(selected, used, candidate.exercise, 'weakest-area', candidate.label, candidate.reason, dateKey);
    }
  }

  if (selected.length < target.total) {
    for (const candidate of [...recentRecords, ...recentFallback]) {
      if (selected.length >= target.total) break;
      addUnique(selected, used, candidate.exercise, 'recent-mistake', candidate.label, candidate.reason, dateKey);
    }
  }

  const items = interleave(selected).slice(0, target.total);
  const counts: DailyStudyPlanCounts = {
    dueRepertoire: items.filter((item) => item.source === 'due-repertoire').length,
    weakestAreas: items.filter((item) => item.source === 'weakest-area').length,
    recentMistakes: items.filter((item) => item.source === 'recent-mistake').length,
    newMaterial: items.filter((item) => item.source === 'new-material').length,
  };
  const weakestLabels = [...new Set(
    items
      .filter((item) => item.source === 'weakest-area')
      .map((item) => item.sourceLabel)
      .filter((label) => label !== 'Due weakness review'),
  )].slice(0, 3);
  const estimatedMinutes = Math.min(
    input.durationMinutes,
    Math.round(items.length * 1.5),
  );

  const selectedWeeklyLabels = [...new Set(
    items
      .map((item) => exercisePriorityLabel(item.exercise))
      .filter((label): label is string => Boolean(
        label
        && input.weeklyPriorityMultipliers
        && Math.abs((input.weeklyPriorityMultipliers[label] ?? 1) - 1) >= 0.05
      )),
  )];
  const weeklyAdjusted = selectedWeeklyLabels.length > 0;

  let summary: string;
  if (!items.length) {
    summary = 'No study material is available yet. Review a game or save repertoire moves first.';
  } else if (items.length < target.total) {
    summary = `Today’s adaptive plan has ${items.length} available positions (~${estimatedMinutes} min). More reviewed games or repertoire cards will fill the full ${input.durationMinutes}-minute target.`;
  } else {
    summary = `Today’s ${input.durationMinutes}-minute plan interleaves ${items.length} positions so due memory, recurring weaknesses, recent mistakes, and new material are not studied in one long block.`;
  }

  return {
    dateKey,
    generatedAt: now,
    durationMinutes: input.durationMinutes,
    targetPositions: target.total,
    estimatedMinutes,
    items,
    counts,
    weakestLabels,
    weeklyAdjusted,
    weeklyPriorityLabels: selectedWeeklyLabels.slice(0, 5),
    summary,
  };
}
