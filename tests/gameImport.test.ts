import { describe, expect, it } from 'vitest';
import { parseFen, parsePgn, splitPgnCollection } from '../src/lib/gameImport';

describe('game import', () => {
  it('parses a normal PGN into replayable ply records', () => {
    const imported = parsePgn('[Event "Demo"]\n\n1. e4 e5 2. Nf3 Nc6 3. Bb5');
    expect(imported.records).toHaveLength(5);
    expect(imported.records[0].san).toBe('e4');
    expect(imported.records[4].san).toBe('Bb5');
    expect(imported.game.history()).toEqual(['e4', 'e5', 'Nf3', 'Nc6', 'Bb5']);
  });

  it('accepts a valid FEN', () => {
    const game = parseFen('8/8/8/8/8/8/4K3/7k w - - 0 1');
    expect(game.turn()).toBe('w');
  });
});


describe('splitPgnCollection', () => {
  it('detects two games in a normal PGN collection', () => {
    const collection = `
[Event "Game One"]
[White "Alpha"]
[Black "Beta"]
[Result "1-0"]

1. e4 e5 2. Nf3 Nc6 1-0

[Event "Game Two"]
[White "Gamma"]
[Black "Delta"]
[Result "0-1"]

1. d4 d5 2. c4 e6 0-1
`;
    const games = splitPgnCollection(collection);
    expect(games).toHaveLength(2);
    expect(games[0].label).toContain('Alpha');
    expect(games[1].label).toContain('Gamma');
    expect(parsePgn(games[0].pgn).records).toHaveLength(4);
    expect(parsePgn(games[1].pgn).records).toHaveLength(4);
  });
});
