import { describe, expect, it } from 'vitest';
import {
  dueSpacedItems,
  emptySpacedRepetitionMemory,
  formatSpacedDue,
  recordSpacedAttempt,
  spacedStats,
  syncSpacedRepetitionMemory,
} from '../src/lib/spacedRepetition';
import { emptyRepertoireMemory, saveRepertoireChoice } from '../src/lib/repertoireMemory';
import { emptyWeaknessMemory } from '../src/lib/weaknessProfile';

const DAY = 86_400_000;
const MINUTE = 60_000;
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

function syncedRepertoire(now = 1_000_000) {
  let repertoire = emptyRepertoireMemory();
  repertoire = saveRepertoireChoice(repertoire, {
    fen: START_FEN,
    eco: 'C20',
    openingName: "King's Pawn Opening",
    moveUci: 'e2e4',
    moveSan: 'e4',
    source: 'book',
  }, now);

  return syncSpacedRepetitionMemory(
    emptySpacedRepetitionMemory(),
    repertoire,
    emptyWeaknessMemory(),
    now,
  );
}

describe('v0.9.4 spaced repetition', () => {
  it('makes a newly saved repertoire card due immediately', () => {
    const now = 1_000_000;
    const memory = syncedRepertoire(now);
    const due = dueSpacedItems(memory, now);

    expect(due).toHaveLength(1);
    expect(due[0].sourceKind).toBe('repertoire');
    expect(due[0].exercise.bestMoveUci).toBe('e2e4');
  });

  it('progresses clean recall from one day to three days', () => {
    const now = 1_000_000;
    const initial = syncedRepertoire(now);
    const id = Object.keys(initial.items)[0];

    const first = recordSpacedAttempt(initial, id, {
      accepted: true,
      hintLevel: 0,
      points: 100,
    }, now);

    expect(first.items[id].streak).toBe(1);
    expect(first.items[id].dueAt).toBe(now + DAY);

    const secondNow = now + DAY;
    const second = recordSpacedAttempt(first, id, {
      accepted: true,
      hintLevel: 0,
      points: 100,
    }, secondNow);

    expect(second.items[id].streak).toBe(2);
    expect(second.items[id].dueAt).toBe(secondNow + 3 * DAY);
  });

  it('returns an incorrect card after ten minutes and resets the streak', () => {
    const now = 1_000_000;
    const initial = syncedRepertoire(now);
    const id = Object.keys(initial.items)[0];
    const learned = recordSpacedAttempt(initial, id, {
      accepted: true,
      hintLevel: 0,
      points: 100,
    }, now);
    const failedAt = now + DAY;

    const failed = recordSpacedAttempt(learned, id, {
      accepted: false,
      hintLevel: 0,
      points: 0,
    }, failedAt);

    expect(failed.items[id].streak).toBe(0);
    expect(failed.items[id].lapses).toBe(1);
    expect(failed.items[id].dueAt).toBe(failedAt + 10 * MINUTE);
  });

  it('uses a shorter first interval after a heavily hinted correct answer', () => {
    const now = 1_000_000;
    const initial = syncedRepertoire(now);
    const id = Object.keys(initial.items)[0];

    const hinted = recordSpacedAttempt(initial, id, {
      accepted: true,
      hintLevel: 3,
      points: 58,
    }, now);

    expect(hinted.items[id].intervalDays).toBe(0.5);
    expect(hinted.items[id].dueAt).toBe(now + DAY / 2);
  });

  it('resets learning when the saved repertoire move changes', () => {
    const now = 1_000_000;
    let repertoire = emptyRepertoireMemory();
    repertoire = saveRepertoireChoice(repertoire, {
      fen: START_FEN,
      eco: 'C20',
      openingName: "King's Pawn Opening",
      moveUci: 'e2e4',
      moveSan: 'e4',
      source: 'book',
    }, now);

    let memory = syncSpacedRepetitionMemory(
      emptySpacedRepetitionMemory(),
      repertoire,
      emptyWeaknessMemory(),
      now,
    );
    const id = Object.keys(memory.items)[0];
    memory = recordSpacedAttempt(memory, id, { accepted: true, hintLevel: 0, points: 100 }, now);

    repertoire = saveRepertoireChoice(repertoire, {
      fen: START_FEN,
      eco: 'D00',
      openingName: "Queen's Pawn Opening",
      moveUci: 'd2d4',
      moveSan: 'd4',
      source: 'book',
    }, now + 100);

    const changed = syncSpacedRepetitionMemory(memory, repertoire, emptyWeaknessMemory(), now + 100);
    expect(changed.items[id].bestMoveUci).toBeUndefined();
    expect(changed.items[id].exercise.bestMoveUci).toBe('d2d4');
    expect(changed.items[id].reviews).toBe(0);
    expect(changed.items[id].dueAt).toBe(now + 100);
  });

  it('computes deck statistics and human-friendly due labels', () => {
    const now = 1_000_000;
    const memory = syncedRepertoire(now);
    const stats = spacedStats(memory, now);

    expect(stats.total).toBe(1);
    expect(stats.due).toBe(1);
    expect(formatSpacedDue(now, now)).toBe('Due now');
    expect(formatSpacedDue(now + DAY, now)).toBe('tomorrow');
  });
});
