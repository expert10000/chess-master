import { describe, expect, it } from 'vitest';
import {
  buildGameAnalyticsDrilldown,
  buildGameAnalyticsSummary,
  classifyGamePhase,
  gameAnalyticsOpeningRows,
} from '../src/lib/gameAnalytics';
import type { GameLibraryEntry, GameLibraryMemory } from '../src/lib/gameLibrary';
import type { Verdict } from '../src/lib/chessCoach';

const baseReview = {
  title: 'Review',
  summary: 'Summary',
  reasons: ['Reason'],
  concepts: [],
  bestEvaluation: '+0.20',
  playedEvaluation: '-0.50',
  bestScoreCpWhite: 20,
  playedScoreCpWhite: -50,
  bestMateWhite: null,
  playedMateWhite: null,
  bestMoveSan: 'Nf3',
  bestLineUci: ['g1f3'],
  playedLineUci: ['e2e4'],
};

function entry(id: string, updatedAt: number, humanColor: 'w' | 'b', openingName: string, eco: string, reviewStatus: 'partial' | 'reviewed', avgCpl: number, issueCount: number, verdicts: Verdict[]): GameLibraryEntry {
  return {
    id,
    fingerprint: `fp-${id}`,
    source: 'played' as const,
    createdAt: updatedAt - 1000,
    updatedAt,
    startFen: 'rn1qkbnr/pppb1ppp/8/3pp3/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1'.replace('rn1qkbnr/pppb1ppp/8/3pp3/8/8/PPPPPPPP/RNBQKBNR', 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR'),
    movesUci: ['e2e4', 'e7e5', 'g1f3', 'b8c6'],
    pgn: '1. e4 e5 2. Nf3 Nc6 *',
    white: humanColor === 'w' ? 'Student' : 'Opponent',
    black: humanColor === 'b' ? 'Student' : 'Opponent',
    result: '*',
    humanColor,
    opening: {
      eco,
      name: openingName,
      family: openingName,
    },
    reviewStatus,
    humanMoveCount: 2,
    reviewedHumanMoves: verdicts.length,
    reviewedPlyCount: verdicts.length,
    issueCount,
    averageCpl: avgCpl,
    weaknesses: [],
    reviewsByPly: Object.fromEntries(verdicts.map((verdict, index) => {
      const ply = humanColor === 'w' ? (index === 0 ? 1 : 3) : (index === 0 ? 2 : 4);
      return [`${ply}`, {
        verdict,
        centipawnLoss: verdict === 'Blunder' ? 180 : verdict === 'Mistake' ? 90 : 35,
        bestMoveUci: 'g1f3',
        bestMoveSan: 'Nf3',
        title: verdict,
        summary: 'Summary',
        reasons: ['Reason'],
        concepts: [],
        playedEvaluation: '-0.50',
        bestEvaluation: '+0.20',
        bestScoreCpWhite: 20,
        playedScoreCpWhite: -50,
        bestMateWhite: null,
        playedMateWhite: null,
        playedLineUci: ['e2e4'],
        bestLineUci: ['g1f3'],
      }];
    })),
  };
}



function longMiddlegameEntry(): GameLibraryEntry {
  const cycle = ['g1f3', 'g8f6', 'f3g1', 'f6g8'];
  const movesUci = Array.from({ length: 6 }, () => cycle).flat();
  return {
    id: 'middle',
    fingerprint: 'fp-middle',
    source: 'played' as const,
    createdAt: 100,
    updatedAt: 1000,
    startFen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
    movesUci,
    pgn: '*',
    white: 'Student',
    black: 'Opponent',
    result: '*',
    humanColor: 'w' as const,
    opening: { eco: 'A00', name: 'Knight Shuffle Test', family: 'Test' },
    reviewStatus: 'partial' as const,
    humanMoveCount: 12,
    reviewedHumanMoves: 1,
    reviewedPlyCount: 1,
    issueCount: 1,
    averageCpl: 123,
    weaknesses: [],
    reviewsByPly: {
      '21': {
        verdict: 'Mistake',
        centipawnLoss: 123,
        bestMoveUci: 'g1f3',
        bestMoveSan: 'Nf3',
        title: 'Mistake',
        summary: 'Middlegame test',
        reasons: ['Reason'],
        concepts: [],
        playedEvaluation: '-1.00',
        bestEvaluation: '+0.20',
        bestScoreCpWhite: 20,
        playedScoreCpWhite: -100,
        bestMateWhite: null,
        playedMateWhite: null,
        playedLineUci: ['g1f3'],
        bestLineUci: ['g1f3'],
      },
    },
  };
}
describe('v1.0.3 game analytics', () => {
  it('classifies early plies as opening', () => {
    expect(classifyGamePhase('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 8)).toBe('opening');
  });

  it('builds a reviewed-game window summary with white/black and phase data', () => {
    const memory: GameLibraryMemory = {
      version: 1,
      entries: [
        entry('g1', 500, 'w', 'King Pawn Game', 'C20', 'reviewed', 70, 1, ['Mistake', 'Good']),
        entry('g2', 400, 'b', 'French Defense', 'C00', 'reviewed', 40, 0, ['Good', 'Blunder']),
        entry('g3', 300, 'w', 'Italian Game', 'C50', 'reviewed', 55, 1, ['Good', 'Good']),
      ],
    };

    const summary = buildGameAnalyticsSummary(memory, 10);
    expect(summary.availableReviewedGames).toBe(3);
    expect(summary.current.games).toBe(3);
    expect(summary.current.reviewedMoves).toBe(6);
    expect(summary.current.gamesByColor.find((row) => row.color === 'w')?.games).toBe(2);
    expect(summary.current.gamesByColor.find((row) => row.color === 'b')?.games).toBe(1);
    expect(summary.current.phases).toHaveLength(3);
    expect(summary.current.openings.length).toBeGreaterThan(0);
  });

  it('supports previous-window comparison', () => {
    const entries = Array.from({ length: 20 }, (_, index) =>
      entry(
        `g${index + 1}`,
        1000 - index,
        index % 2 === 0 ? 'w' : 'b',
        index % 3 === 0 ? 'Italian Game' : 'French Defense',
        index % 3 === 0 ? 'C50' : 'C00',
        'reviewed',
        index < 10 ? 40 : 90,
        index < 10 ? 0 : 1,
        [index < 10 ? 'Good' : 'Blunder']
      )
    );
    const memory: GameLibraryMemory = { version: 1, entries };
    const summary = buildGameAnalyticsSummary(memory, 10);
    expect(summary.current.games).toBe(10);
    expect(summary.previous?.games).toBe(10);
    expect(summary.overallTrend.cplDelta).not.toBeNull();
  });
  it('does not dereference a missing previous window when only a few reviewed games exist', () => {
    const memory: GameLibraryMemory = {
      version: 1,
      entries: [
        entry('only-1', 300, 'w', 'Italian Game', 'C50', 'reviewed', 45, 0, ['Good']),
        entry('only-2', 200, 'b', 'French Defense', 'C00', 'reviewed', 65, 1, ['Mistake']),
      ],
    };

    const summary = buildGameAnalyticsSummary(memory, 20);
    expect(summary.current.games).toBe(2);
    expect(summary.previous).toBeNull();
    expect(summary.overallTrend.cplDelta).toBeNull();
    expect(summary.overallTrend.blunderDelta).toBeNull();
  });

  it('excludes archived and model games from personal performance analytics', () => {
    const normal = entry('normal', 300, 'w', 'Italian Game', 'C50', 'reviewed', 45, 0, ['Good']);
    const archived = { ...entry('archived', 200, 'w', 'French Defense', 'C00', 'reviewed', 180, 1, ['Blunder']), archived: true };
    const model = { ...entry('model', 100, 'w', 'Sicilian Defense', 'B20', 'reviewed', 5, 0, ['Good']), modelGame: true };
    const memory: GameLibraryMemory = { version: 1, entries: [normal, archived, model] };
    const summary = buildGameAnalyticsSummary(memory, 10);
    expect(summary.availableReviewedGames).toBe(1);
    expect(summary.current.games).toBe(1);
  });


  it('drills a blunder metric down to the exact game and move', () => {
    const french = entry('french-blunder', 900, 'w', 'French Defense', 'C00', 'reviewed', 180, 1, ['Blunder', 'Good']);
    const italian = entry('italian-good', 800, 'w', 'Italian Game', 'C50', 'reviewed', 35, 0, ['Good', 'Good']);
    const memory: GameLibraryMemory = { version: 1, entries: [french, italian] };

    const result = buildGameAnalyticsDrilldown(memory, 10, {
      window: 'current',
      metric: 'blunders',
      openingKey: 'C00',
      label: 'French Defense blunders',
    });

    expect(result.games).toBe(1);
    expect(result.reviewedMoves).toBe(1);
    expect(result.movesList[0].gameId).toBe('french-blunder');
    expect(result.movesList[0].ply).toBe(1);
    expect(result.movesList[0].verdict).toBe('Blunder');
    expect(result.gamesList[0].entry.id).toBe('french-blunder');
  });

  it('drills phase CPL down to an exact middlegame move', () => {
    const memory: GameLibraryMemory = { version: 1, entries: [longMiddlegameEntry()] };
    const result = buildGameAnalyticsDrilldown(memory, 10, {
      window: 'current',
      metric: 'cpl',
      phase: 'middlegame',
      label: 'Middlegame CPL',
    });
    expect(result.reviewedMoves).toBe(1);
    expect(result.movesList[0].ply).toBe(21);
    expect(result.movesList[0].phase).toBe('middlegame');
    expect(result.avgCpl).toBe(123);
  });

  it('exposes all opening rows for French-vs-Sicilian style comparison selectors', () => {
    const memory: GameLibraryMemory = {
      version: 1,
      entries: [
        entry('french', 900, 'w', 'French Defense', 'C00', 'reviewed', 80, 1, ['Mistake']),
        entry('sicilian', 800, 'w', 'Sicilian Defense', 'B20', 'reviewed', 40, 0, ['Good']),
        entry('italian', 700, 'w', 'Italian Game', 'C50', 'reviewed', 50, 0, ['Good']),
      ],
    };
    const rows = gameAnalyticsOpeningRows(memory, 10);
    expect(rows.map((row) => row.key)).toEqual(expect.arrayContaining(['C00', 'B20', 'C50']));
  });

  it('drills the previous window independently from the current window', () => {
    const entries = Array.from({ length: 20 }, (_, index) =>
      entry(`window-${index}`, 1000 - index, 'w', index < 10 ? 'Italian Game' : 'French Defense', index < 10 ? 'C50' : 'C00', 'reviewed', 50, 0, ['Good'])
    );
    const memory: GameLibraryMemory = { version: 1, entries };
    const previous = buildGameAnalyticsDrilldown(memory, 10, { window: 'previous', metric: 'games', label: 'Previous 10' });
    expect(previous.games).toBe(10);
    expect(previous.gamesList.every((row) => row.entry.opening?.eco === 'C00')).toBe(true);
  });

});
