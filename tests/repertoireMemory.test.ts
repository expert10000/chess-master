import { describe, expect, it } from 'vitest';
import type { MoveReview } from '../src/lib/chessCoach';
import { recognizeOpening } from '../src/lib/openingBook';
import {
  assessOpeningDeviation,
  emptyRepertoireMemory,
  loadRepertoireMemory,
  openingPositionKey,
  recordOpeningDeviation,
  recordRepertoirePractice,
  repertoireChoiceForFen,
  repertoireStats,
  saveRepertoireChoice,
  serializeRepertoireMemory,
} from '../src/lib/repertoireMemory';

describe('v0.9.1 repertoire memory', () => {
  it('uses a stable opening-position key independent of move counters', () => {
    const a = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
    const b = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQkq - 9 22';
    expect(openingPositionKey(a)).not.toBe(openingPositionKey(b)); // castling rights matter
    const c = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 9 22';
    expect(openingPositionKey(a)).toBe(openingPositionKey(c));
  });

  it('persists a preferred move and practice record', () => {
    const fen = 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2';
    let memory = saveRepertoireChoice(emptyRepertoireMemory(), {
      fen,
      eco: 'C20',
      openingName: "King's Pawn Game",
      moveUci: 'g1f3',
      moveSan: 'Nf3',
      source: 'book',
    }, 100);

    memory = recordRepertoirePractice(memory, openingPositionKey(fen), true);
    const restored = loadRepertoireMemory(serializeRepertoireMemory(memory));
    const choice = repertoireChoiceForFen(restored, fen);

    expect(choice?.moveSan).toBe('Nf3');
    expect(choice?.practiceAttempts).toBe(1);
    expect(choice?.practiceSuccesses).toBe(1);
  });

  it('counts repeated opening deviations', () => {
    const recognition = recognizeOpening(['e2e4','e7e5','g1f3','b8c6','f1b5','a7a6','a2a3']);
    let memory = recordOpeningDeviation(emptyRepertoireMemory(), recognition, undefined, 100);
    memory = recordOpeningDeviation(memory, recognition, undefined, 200);
    const stats = repertoireStats(memory);

    expect(stats.deviations).toBe(2);
    expect(stats.repeatedDeviations).toBe(1);
  });

  it('separates a repertoire miss from an objective engine mistake', () => {
    const recognition = recognizeOpening(['e2e4','e7e5','g1f3','b8c6','f1b5','a7a6','a2a3']);
    const preference = {
      positionKey: openingPositionKey(recognition.deviation!.beforeFen),
      fen: recognition.deviation!.beforeFen,
      eco: 'C60',
      openingName: 'Ruy Lopez',
      sideToMove: 'w' as const,
      moveUci: recognition.alternatives[0].uci,
      moveSan: recognition.alternatives[0].san,
      source: 'book' as const,
      savedAt: 1,
      updatedAt: 1,
      practiceAttempts: 0,
      practiceSuccesses: 0,
    };

    const review = {
      verdict: 'Good',
      centipawnLoss: 28,
    } as MoveReview;

    const assessment = assessOpeningDeviation(recognition, preference, null, review);
    expect(assessment?.repertoireMiss).toBe(true);
    expect(assessment?.engineIssue).toBe(false);
    expect(assessment?.title).toBe('Repertoire miss');
  });
});
