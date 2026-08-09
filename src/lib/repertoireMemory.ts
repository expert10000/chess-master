import type { MoveReview, Verdict } from './chessCoach';
import type { OpeningAlternative, OpeningRecognition } from './openingBook';

export const REPERTOIRE_STORAGE_KEY = 'stockfish-coach.opening-repertoire.v1';

export interface RepertoireChoice {
  positionKey: string;
  fen: string;
  eco: string | null;
  openingName: string;
  variation?: string;
  sideToMove: 'w' | 'b';
  moveUci: string;
  moveSan: string;
  source: 'book' | 'personal';
  savedAt: number;
  updatedAt: number;
  practiceAttempts: number;
  practiceSuccesses: number;
}

export interface StoredOpeningAlternative {
  uci: string;
  san: string;
  localShare: number;
}

export interface OpeningDeviationMemory {
  key: string;
  positionKey: string;
  beforeFen: string;
  eco: string | null;
  openingName: string;
  variation?: string;
  ply: number;
  side: 'White' | 'Black';
  moveUci: string;
  moveSan: string;
  occurrences: number;
  firstSeenAt: number;
  lastSeenAt: number;
  lastVerdict?: Verdict;
  lastLossCp?: number;
  alternatives: StoredOpeningAlternative[];
}

export interface RepertoireMemory {
  version: 1;
  choices: Record<string, RepertoireChoice>;
  deviations: Record<string, OpeningDeviationMemory>;
}

export interface RepertoireStats {
  positions: number;
  whiteMoves: number;
  blackMoves: number;
  deviations: number;
  repeatedDeviations: number;
  practiceAttempts: number;
  practiceSuccesses: number;
}

export interface OpeningMistakeAssessment {
  title: string;
  tone: 'good' | 'warning' | 'bad' | 'neutral';
  summary: string;
  repertoireHit: boolean;
  repertoireMiss: boolean;
  engineIssue: boolean;
  repeated: boolean;
}

export function emptyRepertoireMemory(): RepertoireMemory {
  return {
    version: 1,
    choices: {},
    deviations: {},
  };
}

export function openingPositionKey(fen: string): string {
  return fen.trim().split(/\s+/).slice(0, 4).join(' ');
}

export function openingDeviationKey(beforeFen: string, moveUci: string): string {
  return `${openingPositionKey(beforeFen)}|${moveUci}`;
}

export function loadRepertoireMemory(raw: string | null | undefined): RepertoireMemory {
  if (!raw) return emptyRepertoireMemory();

  try {
    const parsed = JSON.parse(raw) as Partial<RepertoireMemory>;
    if (parsed.version !== 1 || !parsed.choices || !parsed.deviations) return emptyRepertoireMemory();
    return {
      version: 1,
      choices: parsed.choices,
      deviations: parsed.deviations,
    };
  } catch {
    return emptyRepertoireMemory();
  }
}

export function serializeRepertoireMemory(memory: RepertoireMemory): string {
  return JSON.stringify(memory);
}

export function saveRepertoireChoice(
  memory: RepertoireMemory,
  input: {
    fen: string;
    eco: string | null;
    openingName: string;
    variation?: string;
    moveUci: string;
    moveSan: string;
    source: 'book' | 'personal';
  },
  now = Date.now(),
): RepertoireMemory {
  const positionKey = openingPositionKey(input.fen);
  const existing = memory.choices[positionKey];
  const sideToMove = input.fen.trim().split(/\s+/)[1] === 'b' ? 'b' : 'w';

  return {
    ...memory,
    choices: {
      ...memory.choices,
      [positionKey]: {
        positionKey,
        fen: input.fen,
        eco: input.eco,
        openingName: input.openingName,
        variation: input.variation,
        sideToMove,
        moveUci: input.moveUci,
        moveSan: input.moveSan,
        source: input.source,
        savedAt: existing?.savedAt ?? now,
        updatedAt: now,
        practiceAttempts: existing?.practiceAttempts ?? 0,
        practiceSuccesses: existing?.practiceSuccesses ?? 0,
      },
    },
  };
}

export function removeRepertoireChoice(memory: RepertoireMemory, fen: string): RepertoireMemory {
  const positionKey = openingPositionKey(fen);
  if (!memory.choices[positionKey]) return memory;

  const choices = { ...memory.choices };
  delete choices[positionKey];
  return { ...memory, choices };
}

export function repertoireChoiceForFen(memory: RepertoireMemory, fen: string): RepertoireChoice | null {
  return memory.choices[openingPositionKey(fen)] ?? null;
}

function compactAlternatives(alternatives: OpeningAlternative[]): StoredOpeningAlternative[] {
  return alternatives.slice(0, 6).map((alternative) => ({
    uci: alternative.uci,
    san: alternative.san,
    localShare: alternative.localShare,
  }));
}

export function recordOpeningDeviation(
  memory: RepertoireMemory,
  recognition: OpeningRecognition,
  review?: MoveReview,
  now = Date.now(),
): RepertoireMemory {
  const deviation = recognition.deviation;
  if (!deviation) return memory;

  const key = openingDeviationKey(deviation.beforeFen, deviation.uci);
  const existing = memory.deviations[key];

  return {
    ...memory,
    deviations: {
      ...memory.deviations,
      [key]: {
        key,
        positionKey: openingPositionKey(deviation.beforeFen),
        beforeFen: deviation.beforeFen,
        eco: recognition.eco,
        openingName: recognition.name,
        variation: recognition.variation,
        ply: deviation.ply,
        side: deviation.side,
        moveUci: deviation.uci,
        moveSan: deviation.san,
        occurrences: (existing?.occurrences ?? 0) + 1,
        firstSeenAt: existing?.firstSeenAt ?? now,
        lastSeenAt: now,
        lastVerdict: review?.verdict ?? existing?.lastVerdict,
        lastLossCp: review?.centipawnLoss ?? existing?.lastLossCp,
        alternatives: compactAlternatives(recognition.alternatives),
      },
    },
  };
}

export function updateOpeningDeviationReview(
  memory: RepertoireMemory,
  recognition: OpeningRecognition,
  review: MoveReview,
): RepertoireMemory {
  const deviation = recognition.deviation;
  if (!deviation) return memory;

  const key = openingDeviationKey(deviation.beforeFen, deviation.uci);
  const existing = memory.deviations[key];
  if (!existing) return memory;
  if (existing.lastVerdict === review.verdict && existing.lastLossCp === review.centipawnLoss) return memory;

  return {
    ...memory,
    deviations: {
      ...memory.deviations,
      [key]: {
        ...existing,
        lastVerdict: review.verdict,
        lastLossCp: review.centipawnLoss,
      },
    },
  };
}

export function deviationMemoryForRecognition(
  memory: RepertoireMemory,
  recognition: OpeningRecognition | null,
): OpeningDeviationMemory | null {
  const deviation = recognition?.deviation;
  if (!deviation) return null;
  return memory.deviations[openingDeviationKey(deviation.beforeFen, deviation.uci)] ?? null;
}

export function recordRepertoirePractice(
  memory: RepertoireMemory,
  positionKey: string,
  success: boolean,
): RepertoireMemory {
  const choice = memory.choices[positionKey];
  if (!choice) return memory;

  return {
    ...memory,
    choices: {
      ...memory.choices,
      [positionKey]: {
        ...choice,
        practiceAttempts: choice.practiceAttempts + 1,
        practiceSuccesses: choice.practiceSuccesses + (success ? 1 : 0),
      },
    },
  };
}

export function repertoireStats(memory: RepertoireMemory): RepertoireStats {
  const choices = Object.values(memory.choices);
  const deviations = Object.values(memory.deviations);

  return {
    positions: choices.length,
    whiteMoves: choices.filter((choice) => choice.sideToMove === 'w').length,
    blackMoves: choices.filter((choice) => choice.sideToMove === 'b').length,
    deviations: deviations.reduce((sum, deviation) => sum + deviation.occurrences, 0),
    repeatedDeviations: deviations.filter((deviation) => deviation.occurrences > 1).length,
    practiceAttempts: choices.reduce((sum, choice) => sum + choice.practiceAttempts, 0),
    practiceSuccesses: choices.reduce((sum, choice) => sum + choice.practiceSuccesses, 0),
  };
}

function isEngineIssue(review: MoveReview | undefined): boolean {
  return review?.verdict === 'Inaccuracy' || review?.verdict === 'Mistake' || review?.verdict === 'Blunder';
}

export function assessOpeningDeviation(
  recognition: OpeningRecognition,
  preference: RepertoireChoice | null,
  memoryEntry: OpeningDeviationMemory | null,
  review?: MoveReview,
): OpeningMistakeAssessment | null {
  const deviation = recognition.deviation;
  if (!deviation) return null;

  const repertoireHit = Boolean(preference && preference.moveUci === deviation.uci);
  const repertoireMiss = Boolean(preference && preference.moveUci !== deviation.uci);
  const engineIssue = isEngineIssue(review);
  const repeated = (memoryEntry?.occurrences ?? 0) > 1;

  if (repertoireMiss && engineIssue) {
    return {
      title: 'Repertoire miss + engine mistake',
      tone: 'bad',
      summary: `You played ${deviation.san}, while your saved repertoire move is ${preference!.moveSan}. Stockfish also grades the played move ${review!.verdict.toLowerCase()} (${(review!.centipawnLoss / 100).toFixed(2)} pawns lost).`,
      repertoireHit,
      repertoireMiss,
      engineIssue,
      repeated,
    };
  }

  if (repertoireMiss) {
    return {
      title: 'Repertoire miss',
      tone: 'warning',
      summary: review
        ? `You played ${deviation.san} instead of your saved ${preference!.moveSan}. Stockfish grades the deviation ${review.verdict}, so this is primarily a repertoire-memory miss rather than necessarily a bad chess move.`
        : `You played ${deviation.san} instead of your saved repertoire move ${preference!.moveSan}. Review the move with Stockfish to learn whether the deviation was also objectively inaccurate.`,
      repertoireHit,
      repertoireMiss,
      engineIssue,
      repeated,
    };
  }

  if (repertoireHit) {
    return {
      title: 'Repertoire move played',
      tone: engineIssue ? 'warning' : 'good',
      summary: engineIssue
        ? `You remembered your saved move ${deviation.san}, but Stockfish currently dislikes it. Consider revising this repertoire choice.`
        : `You played your saved repertoire move ${deviation.san}. It is outside the bundled local book, but it is part of your personal repertoire.`,
      repertoireHit,
      repertoireMiss,
      engineIssue,
      repeated,
    };
  }

  if (engineIssue) {
    return {
      title: 'Opening mistake',
      tone: 'bad',
      summary: `${deviation.san} leaves the bundled book and Stockfish grades it ${review!.verdict.toLowerCase()} with ${(review!.centipawnLoss / 100).toFixed(2)} pawns of evaluation loss.`,
      repertoireHit,
      repertoireMiss,
      engineIssue,
      repeated,
    };
  }

  if (review) {
    return {
      title: 'Book deviation, not an engine mistake',
      tone: 'neutral',
      summary: `${deviation.san} leaves the bundled local book, but Stockfish grades it ${review.verdict}. Leaving the book is not automatically a chess mistake.`,
      repertoireHit,
      repertoireMiss,
      engineIssue,
      repeated,
    };
  }

  return {
    title: 'Opening deviation',
    tone: 'neutral',
    summary: `${deviation.san} is the first move outside the bundled local book. Review it with Stockfish before treating the deviation as a mistake.`,
    repertoireHit,
    repertoireMiss,
    engineIssue,
    repeated,
  };
}

export function sortedDeviationMemories(memory: RepertoireMemory): OpeningDeviationMemory[] {
  return Object.values(memory.deviations)
    .slice()
    .sort((a, b) => b.occurrences - a.occurrences || b.lastSeenAt - a.lastSeenAt);
}
