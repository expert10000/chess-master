import { Chess } from 'chess.js';
import type { PlyRecord } from '../components/MoveList';
import type { ChessConcept } from './chessConcepts';
import type { MoveReview, Verdict } from './chessCoach';
import { uciLineToSan } from './chessCoach';
import { recognizeOpening } from './openingBook';
import {
  WEAKNESS_CATEGORIES,
  deriveWeaknessCategories,
} from './weaknessProfile';

export const GAME_LIBRARY_STORAGE_KEY = 'stockfish-coach.game-library.v1';

export type GameLibrarySource = 'played' | 'imported';
export type ChessTimeControl = 'bullet' | 'blitz' | 'rapid' | 'classical' | 'unknown';
export type GameLibraryFilter =
  | 'all'
  | 'reviewed'
  | 'issues'
  | 'imported'
  | 'played'
  | 'pinned'
  | 'model'
  | 'archived';
export type GameLibrarySort = 'newest' | 'worst-cpl' | 'most-issues' | 'opening';
export type GameLibraryResultFilter = 'any' | 'win' | 'draw' | 'loss' | 'unfinished';
export type GameLibraryReviewFilter = 'any' | 'reviewed' | 'partial' | 'unreviewed';
export type GameLibrarySideFilter = 'any' | 'w' | 'b';
export type GameLibrarySourceFilter = 'any' | GameLibrarySource;

export interface GameLibrarySearchOptions {
  query: string;
  filter: GameLibraryFilter;
  source: GameLibrarySourceFilter;
  side: GameLibrarySideFilter;
  result: GameLibraryResultFilter;
  opening: string;
  weakness: string;
  reviewStatus: GameLibraryReviewFilter;
  minCpl: number | null;
  maxCpl: number | null;
  dateFrom: string;
  dateTo: string;
  sort: GameLibrarySort;
}

export interface GameLibraryUserMetadataPatch {
  tags?: string[];
  note?: string;
  pinned?: boolean;
  modelGame?: boolean;
  archived?: boolean;
}
export type GameLibraryReviewStatus = 'unreviewed' | 'partial' | 'reviewed';

export interface CompactMoveReview {
  verdict: Verdict;
  centipawnLoss: number;
  bestMoveUci: string | null;
  bestMoveSan: string | null;
  title: string;
  summary: string;
  reasons: string[];
  concepts: ChessConcept[];
  playedEvaluation: string;
  bestEvaluation: string;
  bestScoreCpWhite?: number | null;
  playedScoreCpWhite?: number | null;
  bestMateWhite?: number | null;
  playedMateWhite?: number | null;
  playedLineUci?: string[];
  bestLineUci?: string[];
}

export interface GameLibraryWeakness {
  label: string;
  count: number;
}

export interface GameLibraryOpening {
  eco: string | null;
  name: string;
  variation?: string;
  family: string;
}

export interface GameLibraryEntry {
  id: string;
  fingerprint: string;
  source: GameLibrarySource;
  createdAt: number;
  updatedAt: number;
  startFen: string;
  movesUci: string[];
  pgn: string;
  white: string;
  black: string;
  result: string;
  event?: string;
  date?: string;
  timeControl?: ChessTimeControl;
  humanColor: 'w' | 'b';
  opening: GameLibraryOpening | null;
  reviewStatus: GameLibraryReviewStatus;
  humanMoveCount: number;
  reviewedHumanMoves: number;
  reviewedPlyCount: number;
  issueCount: number;
  averageCpl: number | null;
  weaknesses: GameLibraryWeakness[];
  reviewsByPly: Record<string, CompactMoveReview>;
  tags?: string[];
  note?: string;
  pinned?: boolean;
  modelGame?: boolean;
  archived?: boolean;
  archivedAt?: number;
}

export interface GameLibraryMemory {
  version: 1;
  entries: GameLibraryEntry[];
}

export interface CaptureGameLibraryInput {
  id: string;
  source: GameLibrarySource;
  records: PlyRecord[];
  startFen: string;
  pgn: string;
  headers?: Record<string, string>;
  humanColor: 'w' | 'b';
  whiteFallback: string;
  blackFallback: string;
  result: string;
  now?: number;
}

const STANDARD_START_FEN = new Chess().fen();

export function emptyGameLibraryMemory(): GameLibraryMemory {
  return { version: 1, entries: [] };
}

function normalizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return [];
  const seen = new Set<string>();
  const normalized: string[] = [];
  for (const raw of tags) {
    if (typeof raw !== 'string') continue;
    const tag = raw.trim().replace(/\s+/g, ' ').slice(0, 32);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    normalized.push(tag);
    if (normalized.length >= 16) break;
  }
  return normalized;
}

function normalizeNote(note: unknown): string {
  return typeof note === 'string' ? note.trim().slice(0, 5000) : '';
}

function metadataFor(entry: GameLibraryEntry): Required<Pick<GameLibraryEntry, 'tags' | 'note' | 'pinned' | 'modelGame' | 'archived'>> & { archivedAt?: number } {
  return {
    tags: normalizeTags(entry.tags),
    note: normalizeNote(entry.note),
    pinned: Boolean(entry.pinned),
    modelGame: Boolean(entry.modelGame),
    archived: Boolean(entry.archived),
    archivedAt: typeof entry.archivedAt === 'number' ? entry.archivedAt : undefined,
  };
}

function validReviewStatus(value: unknown): value is GameLibraryReviewStatus {
  return value === 'unreviewed' || value === 'partial' || value === 'reviewed';
}

export function loadGameLibraryMemory(raw: string | null | undefined): GameLibraryMemory {
  if (!raw) return emptyGameLibraryMemory();
  try {
    const parsed = JSON.parse(raw) as Partial<GameLibraryMemory>;
    if (parsed.version !== 1 || !Array.isArray(parsed.entries)) return emptyGameLibraryMemory();
    const entries = parsed.entries
      .filter((entry): entry is GameLibraryEntry => Boolean(
        entry?.id
        && entry?.fingerprint
        && (entry.source === 'played' || entry.source === 'imported')
        && typeof entry.startFen === 'string'
        && Array.isArray(entry.movesUci)
        && typeof entry.pgn === 'string'
        && typeof entry.white === 'string'
        && typeof entry.black === 'string'
        && typeof entry.result === 'string'
        && (entry.humanColor === 'w' || entry.humanColor === 'b')
        && validReviewStatus(entry.reviewStatus)
        && Array.isArray(entry.weaknesses)
        && entry.reviewsByPly
      ))
      .map((entry) => ({
        ...entry,
        movesUci: entry.movesUci.filter((move) => typeof move === 'string'),
        weaknesses: entry.weaknesses
          .filter((item) => item && typeof item.label === 'string' && typeof item.count === 'number')
          .slice(0, 8),
        reviewsByPly: Object.fromEntries(
          Object.entries(entry.reviewsByPly).filter(([, review]) => Boolean(review && review.verdict))
        ),
        tags: normalizeTags(entry.tags),
        note: normalizeNote(entry.note),
        pinned: Boolean(entry.pinned),
        modelGame: Boolean(entry.modelGame),
        archived: Boolean(entry.archived),
        archivedAt: typeof entry.archivedAt === 'number' ? entry.archivedAt : undefined,
      }))
      .sort((a, b) => b.updatedAt - a.updatedAt);
    return { version: 1, entries };
  } catch {
    return emptyGameLibraryMemory();
  }
}

export function serializeGameLibraryMemory(memory: GameLibraryMemory): string {
  return JSON.stringify(memory);
}

function hashText(input: string): string {
  // FNV-1a 32-bit: deterministic local identity, not a security hash.
  let hash = 0x811c9dc5;
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

export function gameFingerprint(startFen: string, movesUci: string[]): string {
  return hashText(`${startFen}|${movesUci.join(' ')}`);
}

export function newGameLibraryId(now = Date.now()): string {
  return `game:${now}:${Math.random().toString(36).slice(2, 8)}`;
}

function compactReview(review: MoveReview): CompactMoveReview {
  return {
    verdict: review.verdict,
    centipawnLoss: review.centipawnLoss,
    bestMoveUci: review.bestMoveUci,
    bestMoveSan: review.bestMoveSan,
    title: review.title,
    summary: review.summary,
    reasons: review.reasons.slice(0, 5).map((reason) => reason.slice(0, 260)),
    concepts: (review.concepts ?? []).slice(0, 6).map((concept) => ({
      ...concept,
      detail: concept.detail.slice(0, 260),
    })),
    playedEvaluation: review.playedEvaluation,
    bestEvaluation: review.bestEvaluation,
    bestScoreCpWhite: review.bestScoreCpWhite,
    playedScoreCpWhite: review.playedScoreCpWhite,
    bestMateWhite: review.bestMateWhite,
    playedMateWhite: review.playedMateWhite,
    playedLineUci: review.playedLineUci?.slice(0, 10),
    bestLineUci: review.bestLineUci?.slice(0, 10),
  };
}

function hydrateReview(beforeFen: string, review: CompactMoveReview, playedUci: string): MoveReview {
  const playedLineUci = review.playedLineUci ?? [playedUci];
  const bestLineUci = review.bestLineUci ?? (review.bestMoveUci ? [review.bestMoveUci] : []);
  return {
    beforeFen,
    playedUci,
    bestMoveUci: review.bestMoveUci,
    concepts: review.concepts ?? [],
    verdict: review.verdict,
    centipawnLoss: review.centipawnLoss,
    title: review.title,
    summary: review.summary,
    reasons: review.reasons ?? [],
    bestMoveSan: review.bestMoveSan,
    playedLineSan: uciLineToSan(beforeFen, playedLineUci, 10),
    bestLineSan: uciLineToSan(beforeFen, bestLineUci, 10),
    playedLineUci,
    bestLineUci,
    bestEvaluation: review.bestEvaluation,
    playedEvaluation: review.playedEvaluation,
    bestScoreCpWhite: review.bestScoreCpWhite,
    playedScoreCpWhite: review.playedScoreCpWhite,
    bestMateWhite: review.bestMateWhite,
    playedMateWhite: review.playedMateWhite,
  };
}

function openingFor(startFen: string, movesUci: string[]): GameLibraryOpening | null {
  if (startFen !== STANDARD_START_FEN || movesUci.length === 0) return null;
  const recognition = recognizeOpening(movesUci);
  if (!recognition || recognition.name === 'Starting position') return null;
  return {
    eco: recognition.eco,
    name: recognition.name,
    variation: recognition.variation,
    family: recognition.taxonomy.family,
  };
}

function weaknessSummary(
  records: PlyRecord[],
  humanColor: 'w' | 'b',
  includeOpeningDeviation: boolean,
): GameLibraryWeakness[] {
  const counts = new Map<string, number>();
  for (const record of records) {
    if (record.color !== humanColor || !record.review) continue;
    for (const category of deriveWeaknessCategories(record.review)) {
      const label = WEAKNESS_CATEGORIES.find((item) => item.id === category)?.label ?? category;
      counts.set(label, (counts.get(label) ?? 0) + 1);
    }
  }
  if (includeOpeningDeviation) {
    counts.set('Opening deviations', (counts.get('Opening deviations') ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label))
    .slice(0, 8);
}

function humanReviewStats(records: PlyRecord[], humanColor: 'w' | 'b'): {
  humanMoveCount: number;
  reviewedHumanMoves: number;
  issueCount: number;
  averageCpl: number | null;
} {
  const human = records.filter((record) => record.color === humanColor);
  const reviewed = human.filter((record) => Boolean(record.review));
  const issues = reviewed.filter((record) =>
    record.review?.verdict === 'Inaccuracy'
    || record.review?.verdict === 'Mistake'
    || record.review?.verdict === 'Blunder'
  );
  const averageCpl = reviewed.length
    ? reviewed.reduce((sum, record) => sum + (record.review?.centipawnLoss ?? 0), 0) / reviewed.length
    : null;
  return {
    humanMoveCount: human.length,
    reviewedHumanMoves: reviewed.length,
    issueCount: issues.length,
    averageCpl,
  };
}

export function classifyTimeControl(raw: string | undefined): ChessTimeControl {
  if (!raw || raw === '-' || raw === '?') return 'unknown';
  const match = raw.match(/^(\d+)(?:\+(\d+))?/);
  if (!match) return 'unknown';
  const seconds = Number(match[1]) + Number(match[2] ?? 0) * 40;
  if (seconds < 180) return 'bullet';
  if (seconds < 600) return 'blitz';
  if (seconds < 3600) return 'rapid';
  return 'classical';
}

export function captureGameLibraryEntry(input: CaptureGameLibraryInput): GameLibraryEntry {
  const now = input.now ?? Date.now();
  const movesUci = input.records.map((record) => record.uci);
  const opening = openingFor(input.startFen, movesUci);
  const stats = humanReviewStats(input.records, input.humanColor);
  const reviewedPlyCount = input.records.filter((record) => Boolean(record.review)).length;
  const reviewStatus: GameLibraryReviewStatus =
    stats.reviewedHumanMoves === 0 ? 'unreviewed'
      : stats.reviewedHumanMoves >= stats.humanMoveCount ? 'reviewed'
        : 'partial';
  const recognition = input.startFen === STANDARD_START_FEN && movesUci.length
    ? recognizeOpening(movesUci)
    : null;
  const humanDeviation = Boolean(
    recognition?.deviation
    && input.records[recognition.deviation.ply - 1]?.color === input.humanColor
  );

  return {
    id: input.id,
    fingerprint: gameFingerprint(input.startFen, movesUci),
    source: input.source,
    createdAt: now,
    updatedAt: now,
    startFen: input.startFen,
    movesUci,
    pgn: input.pgn,
    white: input.headers?.White?.trim() || input.whiteFallback,
    black: input.headers?.Black?.trim() || input.blackFallback,
    result: input.headers?.Result?.trim() || input.result || '*',
    event: input.headers?.Event?.trim() || undefined,
    date: input.headers?.Date?.trim() || input.headers?.EventDate?.trim() || undefined,
    timeControl: classifyTimeControl(input.headers?.TimeControl),
    humanColor: input.humanColor,
    opening,
    reviewStatus,
    humanMoveCount: stats.humanMoveCount,
    reviewedHumanMoves: stats.reviewedHumanMoves,
    reviewedPlyCount,
    issueCount: stats.issueCount,
    averageCpl: stats.averageCpl,
    weaknesses: weaknessSummary(input.records, input.humanColor, humanDeviation),
    reviewsByPly: Object.fromEntries(
      input.records
        .filter((record) => Boolean(record.review))
        .map((record) => [`${record.ply}`, compactReview(record.review!)])
    ),
    tags: [],
    note: '',
    pinned: false,
    modelGame: false,
    archived: false,
  };
}

export function upsertGameLibraryEntry(
  memory: GameLibraryMemory,
  incoming: GameLibraryEntry,
): { memory: GameLibraryMemory; entry: GameLibraryEntry } {
  const existing = memory.entries.find((entry) =>
    entry.id === incoming.id || (
      entry.source === 'imported'
      && incoming.source === 'imported'
      && entry.fingerprint === incoming.fingerprint
      && entry.white === incoming.white
      && entry.black === incoming.black
      && entry.result === incoming.result
      && entry.date === incoming.date
      && entry.event === incoming.event
    )
  );
  const resolved: GameLibraryEntry = existing
    ? {
        ...incoming,
        ...metadataFor(existing),
        id: existing.id,
        createdAt: existing.createdAt,
        source: existing.source === 'imported' || incoming.source === 'imported' ? 'imported' : 'played',
        white: existing.source === 'imported' ? existing.white : incoming.white,
        black: existing.source === 'imported' ? existing.black : incoming.black,
        event: existing.source === 'imported' ? existing.event : incoming.event,
        date: existing.source === 'imported' ? existing.date : incoming.date,
        timeControl: existing.source === 'imported' ? existing.timeControl : incoming.timeControl,
      }
    : {
        ...incoming,
        ...metadataFor(incoming),
      };

  const entries = [
    resolved,
    ...memory.entries.filter((entry) => entry.id !== resolved.id),
  ].sort((a, b) => b.updatedAt - a.updatedAt);

  return { memory: { version: 1, entries }, entry: resolved };
}

export function hydrateGameLibraryEntry(entry: GameLibraryEntry): { game: Chess; records: PlyRecord[] } {
  const game = new Chess(entry.startFen);
  const records: PlyRecord[] = [];

  entry.movesUci.forEach((uci, index) => {
    const beforeFen = game.fen();
    const move = game.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
      promotion: uci[4] ?? 'q',
    });
    if (!move) throw new Error(`Stored game contains an invalid move at ply ${index + 1}: ${uci}`);

    const compact = entry.reviewsByPly[`${index + 1}`];
    records.push({
      id: index + 1,
      ply: index + 1,
      beforeFen,
      afterFen: game.fen(),
      uci,
      san: move.san,
      color: move.color,
      review: compact ? hydrateReview(beforeFen, compact, uci) : undefined,
    });
  });

  const headers: Record<string, string> = {
    White: entry.white,
    Black: entry.black,
    Result: entry.result,
  };
  if (entry.event) headers.Event = entry.event;
  if (entry.date) headers.Date = entry.date;
  if (entry.startFen !== STANDARD_START_FEN) {
    headers.SetUp = '1';
    headers.FEN = entry.startFen;
  }
  try {
    for (const [key, value] of Object.entries(headers)) game.header(key, value);
  } catch {
    // Metadata is useful but not required for board reconstruction.
  }

  return { game, records };
}

export function gameLibraryOpeningLabel(entry: GameLibraryEntry): string {
  if (!entry.opening) return 'Unclassified opening';
  return entry.opening.variation
    ? `${entry.opening.name} · ${entry.opening.variation}`
    : entry.opening.name;
}

export function gameLibraryResultForStudent(entry: GameLibraryEntry): 'win' | 'draw' | 'loss' | 'unfinished' {
  if (entry.result === '1/2-1/2') return 'draw';
  if (entry.result !== '1-0' && entry.result !== '0-1') return 'unfinished';
  const whiteWon = entry.result === '1-0';
  return (entry.humanColor === 'w') === whiteWon ? 'win' : 'loss';
}

function searchText(entry: GameLibraryEntry): string {
  return [
    entry.white,
    entry.black,
    entry.result,
    entry.event,
    entry.date,
    entry.opening?.eco,
    entry.opening?.name,
    entry.opening?.variation,
    entry.opening?.family,
    ...entry.weaknesses.map((weakness) => weakness.label),
    ...normalizeTags(entry.tags),
    normalizeNote(entry.note),
    entry.modelGame ? 'model game' : '',
    entry.pinned ? 'pinned favorite' : '',
  ].filter(Boolean).join(' ').toLowerCase();
}

function entryDateMs(entry: GameLibraryEntry): number {
  if (entry.date) {
    const normalized = entry.date.trim().replace(/\./g, '-');
    const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (match) {
      const parsed = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00`).getTime();
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return entry.createdAt;
}

function dateBoundaryMs(value: string, endOfDay: boolean): number | null {
  if (!value) return null;
  const suffix = endOfDay ? 'T23:59:59.999' : 'T00:00:00.000';
  const parsed = new Date(`${value}${suffix}`).getTime();
  return Number.isFinite(parsed) ? parsed : null;
}

export function defaultGameLibrarySearchOptions(): GameLibrarySearchOptions {
  return {
    query: '',
    filter: 'all',
    source: 'any',
    side: 'any',
    result: 'any',
    opening: '',
    weakness: '',
    reviewStatus: 'any',
    minCpl: null,
    maxCpl: null,
    dateFrom: '',
    dateTo: '',
    sort: 'newest',
  };
}

export function filterGameLibrary(
  memory: GameLibraryMemory,
  options: GameLibrarySearchOptions,
): GameLibraryEntry[] {
  const needle = options.query.trim().toLowerCase();
  const fromMs = dateBoundaryMs(options.dateFrom, false);
  const toMs = dateBoundaryMs(options.dateTo, true);

  const filtered = memory.entries.filter((entry) => {
    const archived = Boolean(entry.archived);
    if (options.filter === 'archived') {
      if (!archived) return false;
    } else if (archived) {
      return false;
    }

    if (options.filter === 'reviewed' && entry.reviewStatus !== 'reviewed') return false;
    if (options.filter === 'issues' && entry.issueCount === 0) return false;
    if (options.filter === 'imported' && entry.source !== 'imported') return false;
    if (options.filter === 'played' && entry.source !== 'played') return false;
    if (options.filter === 'pinned' && !entry.pinned) return false;
    if (options.filter === 'model' && !entry.modelGame) return false;
    if (options.source !== 'any' && entry.source !== options.source) return false;
    if (options.side !== 'any' && entry.humanColor !== options.side) return false;
    if (options.result !== 'any' && gameLibraryResultForStudent(entry) !== options.result) return false;
    if (options.reviewStatus !== 'any' && entry.reviewStatus !== options.reviewStatus) return false;
    if (options.opening && gameLibraryOpeningLabel(entry) !== options.opening) return false;
    if (options.weakness && !entry.weaknesses.some((weakness) => weakness.label === options.weakness)) return false;
    if (options.minCpl !== null && (entry.averageCpl === null || entry.averageCpl < options.minCpl)) return false;
    if (options.maxCpl !== null && (entry.averageCpl === null || entry.averageCpl > options.maxCpl)) return false;
    const dateMs = entryDateMs(entry);
    if (fromMs !== null && dateMs < fromMs) return false;
    if (toMs !== null && dateMs > toMs) return false;
    return !needle || searchText(entry).includes(needle);
  });

  return filtered.sort((a, b) => {
    if (options.sort === 'worst-cpl') {
      return (b.averageCpl ?? -1) - (a.averageCpl ?? -1) || b.updatedAt - a.updatedAt;
    }
    if (options.sort === 'most-issues') {
      return b.issueCount - a.issueCount || (b.averageCpl ?? -1) - (a.averageCpl ?? -1) || b.updatedAt - a.updatedAt;
    }
    if (options.sort === 'opening') {
      return gameLibraryOpeningLabel(a).localeCompare(gameLibraryOpeningLabel(b)) || b.updatedAt - a.updatedAt;
    }
    return b.updatedAt - a.updatedAt;
  });
}

export function searchGameLibrary(
  memory: GameLibraryMemory,
  query: string,
  filter: GameLibraryFilter,
): GameLibraryEntry[] {
  return filterGameLibrary(memory, {
    ...defaultGameLibrarySearchOptions(),
    query,
    filter,
  });
}

export function updateGameLibraryEntryMetadata(
  memory: GameLibraryMemory,
  entryId: string,
  patch: GameLibraryUserMetadataPatch,
  now = Date.now(),
): GameLibraryMemory {
  return {
    version: 1,
    entries: memory.entries.map((entry) => {
      if (entry.id !== entryId) return entry;
      const nextArchived = patch.archived ?? Boolean(entry.archived);
      return {
        ...entry,
        tags: patch.tags === undefined ? normalizeTags(entry.tags) : normalizeTags(patch.tags),
        note: patch.note === undefined ? normalizeNote(entry.note) : normalizeNote(patch.note),
        pinned: patch.pinned ?? Boolean(entry.pinned),
        modelGame: patch.modelGame ?? Boolean(entry.modelGame),
        archived: nextArchived,
        archivedAt: patch.archived === true
          ? now
          : patch.archived === false
            ? undefined
            : entry.archivedAt,
      };
    }),
  };
}

export function deleteGameLibraryEntry(memory: GameLibraryMemory, entryId: string): GameLibraryMemory {
  return {
    version: 1,
    entries: memory.entries.filter((entry) => entry.id !== entryId),
  };
}

export function gameLibraryStats(memory: GameLibraryMemory): {
  total: number;
  reviewed: number;
  withIssues: number;
  imported: number;
  played: number;
  pinned: number;
  modelGames: number;
  archived: number;
} {
  const active = memory.entries.filter((entry) => !entry.archived);
  return {
    total: active.length,
    reviewed: active.filter((entry) => entry.reviewStatus === 'reviewed').length,
    withIssues: active.filter((entry) => entry.issueCount > 0).length,
    imported: active.filter((entry) => entry.source === 'imported').length,
    played: active.filter((entry) => entry.source === 'played').length,
    pinned: active.filter((entry) => entry.pinned).length,
    modelGames: active.filter((entry) => entry.modelGame).length,
    archived: memory.entries.filter((entry) => entry.archived).length,
  };
}
