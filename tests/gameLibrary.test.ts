import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import type { PlyRecord } from '../src/components/MoveList';
import type { MoveReview } from '../src/lib/chessCoach';
import {
  captureGameLibraryEntry,
  defaultGameLibrarySearchOptions,
  deleteGameLibraryEntry,
  filterGameLibrary,
  emptyGameLibraryMemory,
  gameFingerprint,
  hydrateGameLibraryEntry,
  loadGameLibraryMemory,
  searchGameLibrary,
  serializeGameLibraryMemory,
  updateGameLibraryEntryMetadata,
  upsertGameLibraryEntry,
} from '../src/lib/gameLibrary';

function review(verdict: MoveReview['verdict'], loss: number, bestMove = 'g1f3'): MoveReview {
  const beforeFen = new Chess().fen();
  return {
    beforeFen,
    playedUci: 'e2e4',
    bestMoveUci: bestMove,
    concepts: verdict === 'Mistake'
      ? [{ id: 'tactical-test', category: 'tactical', label: 'Fork', detail: 'A tactical fork was available.', confidence: 'high' }]
      : [],
    verdict,
    centipawnLoss: loss,
    title: verdict,
    summary: 'test summary',
    reasons: ['test reason'],
    bestMoveSan: 'Nf3',
    playedLineSan: [],
    bestLineSan: [],
    playedLineUci: ['e2e4'],
    bestLineUci: [bestMove],
    bestEvaluation: '+0.20',
    playedEvaluation: '-1.00',
    bestScoreCpWhite: 20,
    playedScoreCpWhite: -100,
    bestMateWhite: null,
    playedMateWhite: null,
  };
}

function records(): PlyRecord[] {
  const game = new Chess();
  const moves = ['e2e4', 'e7e5', 'g1f3', 'b8c6'];
  return moves.map((uci, index) => {
    const beforeFen = game.fen();
    const move = game.move({
      from: uci.slice(0, 2),
      to: uci.slice(2, 4),
    });
    return {
      id: index + 1,
      ply: index + 1,
      beforeFen,
      afterFen: game.fen(),
      uci,
      san: move.san,
      color: move.color,
      review: index === 0 ? review('Mistake', 140) : index === 2 ? review('Good', 45) : undefined,
    };
  });
}

describe('v1.0.2 persistent game library', () => {
  it('captures result/opening/review metrics and per-game weaknesses', () => {
    const entry = captureGameLibraryEntry({
      id: 'game-1',
      source: 'played',
      records: records(),
      startFen: new Chess().fen(),
      pgn: '1. e4 e5 2. Nf3 Nc6 *',
      headers: { White: 'Student', Black: 'Stockfish', Result: '*' },
      humanColor: 'w',
      whiteFallback: 'Student',
      blackFallback: 'Stockfish',
      result: '*',
      now: 100,
    });

    expect(entry.white).toBe('Student');
    expect(entry.opening?.name).toContain("King's Pawn");
    expect(entry.reviewedHumanMoves).toBe(2);
    expect(entry.issueCount).toBe(1);
    expect(Math.round(entry.averageCpl!)).toBe(93);
    expect(entry.weaknesses.some((item) => item.label === 'Missed tactics')).toBe(true);
  });

  it('updates a progressing game in place by id instead of creating duplicates', () => {
    const initial = captureGameLibraryEntry({
      id: 'same',
      source: 'played',
      records: records().slice(0, 2),
      startFen: new Chess().fen(),
      pgn: '1. e4 e5 *',
      humanColor: 'w',
      whiteFallback: 'Student',
      blackFallback: 'Stockfish',
      result: '*',
      now: 100,
    });
    const first = upsertGameLibraryEntry(emptyGameLibraryMemory(), initial).memory;
    const later = captureGameLibraryEntry({
      ...{
        id: 'same',
        source: 'played' as const,
        records: records(),
        startFen: new Chess().fen(),
        pgn: '1. e4 e5 2. Nf3 Nc6 *',
        humanColor: 'w' as const,
        whiteFallback: 'Student',
        blackFallback: 'Stockfish',
        result: '*',
        now: 200,
      },
    });
    const updated = upsertGameLibraryEntry(first, later).memory;
    expect(updated.entries).toHaveLength(1);
    expect(updated.entries[0].movesUci).toHaveLength(4);
    expect(updated.entries[0].createdAt).toBe(100);
    expect(updated.entries[0].updatedAt).toBe(200);
  });

  it('deduplicates the same completed imported game by fingerprint even with a new session id', () => {
    const common = {
      source: 'imported' as const,
      records: records(),
      startFen: new Chess().fen(),
      pgn: '1. e4 e5 2. Nf3 Nc6 *',
      humanColor: 'w' as const,
      whiteFallback: 'White',
      blackFallback: 'Black',
      result: '*',
    };
    const one = captureGameLibraryEntry({ ...common, id: 'a', now: 100 });
    const two = captureGameLibraryEntry({ ...common, id: 'b', now: 200 });
    const first = upsertGameLibraryEntry(emptyGameLibraryMemory(), one).memory;
    const second = upsertGameLibraryEntry(first, two);
    expect(second.memory.entries).toHaveLength(1);
    expect(second.entry.id).toBe('a');
    expect(second.entry.source).toBe('imported');
    expect(gameFingerprint(one.startFen, one.movesUci)).toBe(one.fingerprint);
  });

  it('hydrates saved moves and compact reviews back into playable records', () => {
    const entry = captureGameLibraryEntry({
      id: 'hydrate',
      source: 'played',
      records: records(),
      startFen: new Chess().fen(),
      pgn: '1. e4 e5 2. Nf3 Nc6 *',
      humanColor: 'w',
      whiteFallback: 'Student',
      blackFallback: 'Stockfish',
      result: '*',
      now: 100,
    });
    const hydrated = hydrateGameLibraryEntry(entry);
    expect(hydrated.records).toHaveLength(4);
    expect(hydrated.records[0].review?.verdict).toBe('Mistake');
    expect(hydrated.records[0].review?.bestMoveUci).toBe('g1f3');
    expect(hydrated.game.history()).toHaveLength(4);
  });

  it('searches by player, opening and weakness and supports issue/review filters', () => {
    const entry = captureGameLibraryEntry({
      id: 'search',
      source: 'imported',
      records: records(),
      startFen: new Chess().fen(),
      pgn: '1. e4 e5 2. Nf3 Nc6 *',
      headers: { White: 'Alice', Black: 'Bob', Event: 'Club Night' },
      humanColor: 'w',
      whiteFallback: 'White',
      blackFallback: 'Black',
      result: '*',
      now: 100,
    });
    const memory = upsertGameLibraryEntry(emptyGameLibraryMemory(), entry).memory;
    expect(searchGameLibrary(memory, 'Alice', 'all')).toHaveLength(1);
    expect(searchGameLibrary(memory, 'King', 'all')).toHaveLength(1);
    expect(searchGameLibrary(memory, 'Missed tactics', 'issues')).toHaveLength(1);
    expect(searchGameLibrary(memory, '', 'imported')).toHaveLength(1);
    expect(searchGameLibrary(memory, '', 'reviewed')).toHaveLength(1);
  });

  it('round-trips library storage', () => {
    const entry = captureGameLibraryEntry({
      id: 'persist',
      source: 'played',
      records: records(),
      startFen: new Chess().fen(),
      pgn: '1. e4 e5 2. Nf3 Nc6 *',
      humanColor: 'w',
      whiteFallback: 'Student',
      blackFallback: 'Stockfish',
      result: '*',
      now: 100,
    });
    const memory = upsertGameLibraryEntry(emptyGameLibraryMemory(), entry).memory;
    const restored = loadGameLibraryMemory(serializeGameLibraryMemory(memory));
    expect(restored.entries).toHaveLength(1);
    expect(restored.entries[0].id).toBe('persist');
  });
});


describe('v1.0.4 game library organization', () => {
  function organizedEntry(id: string, now: number, headers: Record<string, string> = {}) {
    return captureGameLibraryEntry({
      id,
      source: 'imported',
      records: records(),
      startFen: new Chess().fen(),
      pgn: '1. e4 e5 2. Nf3 Nc6 *',
      headers,
      humanColor: 'w',
      whiteFallback: 'Student',
      blackFallback: 'Opponent',
      result: headers.Result ?? '*',
      now,
    });
  }

  it('stores tags, notes, pinned/model/archive flags and preserves them across autosave upserts', () => {
    const first = upsertGameLibraryEntry(emptyGameLibraryMemory(), organizedEntry('meta', 100)).memory;
    const edited = updateGameLibraryEntryMetadata(first, 'meta', {
      tags: ['French', 'tactics', 'Study Again', 'french'],
      note: 'Study ...e5 break',
      pinned: true,
      modelGame: true,
      archived: true,
    }, 150);

    const autosave = organizedEntry('meta', 200, { White: 'Student', Black: 'Opponent' });
    const updated = upsertGameLibraryEntry(edited, autosave).memory.entries[0];
    expect(updated.tags).toEqual(['French', 'tactics', 'Study Again']);
    expect(updated.note).toBe('Study ...e5 break');
    expect(updated.pinned).toBe(true);
    expect(updated.modelGame).toBe(true);
    expect(updated.archived).toBe(true);
    expect(updated.archivedAt).toBe(150);
  });

  it('searches user tags and notes', () => {
    let memory = upsertGameLibraryEntry(emptyGameLibraryMemory(), organizedEntry('tagged', 100)).memory;
    memory = updateGameLibraryEntryMetadata(memory, 'tagged', {
      tags: ['endgame', 'study again'],
      note: 'Study the e5 break carefully',
    }, 120);
    expect(searchGameLibrary(memory, 'endgame', 'all')).toHaveLength(1);
    expect(searchGameLibrary(memory, 'e5 break', 'all')).toHaveLength(1);
  });

  it('filters by side, result, review state, CPL range and date while sorting worst CPL', () => {
    const first = organizedEntry('a', new Date('2026-08-01T12:00:00').getTime(), { White: 'Student', Black: 'A', Result: '1-0', Date: '2026.08.01' });
    first.averageCpl = 35;
    first.reviewStatus = 'reviewed';
    const second = organizedEntry('b', new Date('2026-08-08T12:00:00').getTime(), { White: 'Student', Black: 'B', Result: '0-1', Date: '2026.08.08' });
    second.averageCpl = 120;
    second.reviewStatus = 'reviewed';
    let memory = upsertGameLibraryEntry(emptyGameLibraryMemory(), first).memory;
    memory = upsertGameLibraryEntry(memory, second).memory;

    const found = filterGameLibrary(memory, {
      ...defaultGameLibrarySearchOptions(),
      side: 'w',
      result: 'loss',
      reviewStatus: 'reviewed',
      minCpl: 100,
      dateFrom: '2026-08-05',
      sort: 'worst-cpl',
    });
    expect(found.map((entry) => entry.id)).toEqual(['b']);
  });

  it('hides archived games from normal views and restores them through the Archived filter', () => {
    let memory = upsertGameLibraryEntry(emptyGameLibraryMemory(), organizedEntry('arch', 100)).memory;
    memory = updateGameLibraryEntryMetadata(memory, 'arch', { archived: true }, 200);
    expect(searchGameLibrary(memory, '', 'all')).toHaveLength(0);
    expect(searchGameLibrary(memory, '', 'archived')).toHaveLength(1);
    memory = updateGameLibraryEntryMetadata(memory, 'arch', { archived: false }, 300);
    expect(searchGameLibrary(memory, '', 'all')).toHaveLength(1);
  });

  it('permanently deletes a saved library entry', () => {
    const memory = upsertGameLibraryEntry(emptyGameLibraryMemory(), organizedEntry('delete-me', 100)).memory;
    expect(deleteGameLibraryEntry(memory, 'delete-me').entries).toHaveLength(0);
  });
});
