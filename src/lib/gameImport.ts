import { Chess, type Move } from 'chess.js';
import type { PlyRecord } from '../components/MoveList';

export interface ImportedPgn {
  game: Chess;
  startFen: string;
  headers: Record<string, string>;
  records: PlyRecord[];
}

export interface PgnCollectionEntry {
  pgn: string;
  index: number;
  label: string;
}

function headerValue(pgn: string, name: string): string | null {
  const expression = new RegExp(`^\\s*\\[${name}\\s+"([^"]*)"\\]`, 'mi');
  return pgn.match(expression)?.[1]?.trim() || null;
}

/**
 * Split a normal multi-game PGN collection into individual games.
 *
 * Most downloadable player/tournament PGNs are collections rather than one
 * game. chess.js loadPgn() intentionally expects one game, so feeding the
 * whole collection produces an error at the opening "[" of game 2.
 *
 * We split only after a movetext result token followed by the next header
 * block. This preserves all headers belonging to the same game.
 */
export function splitPgnCollection(input: string): PgnCollectionEntry[] {
  const normalized = input
    .replace(/^\uFEFF/, '')
    .replace(/\r\n?/g, '\n')
    .trim();

  if (!normalized) return [];

  const separator = '\u0000PGN_GAME_SEPARATOR\u0000';
  const marked = normalized.replace(
    /(1-0|0-1|1\/2-1\/2|\*)\s+(?=\s*\[)/g,
    `$1\n${separator}\n`,
  );

  return marked
    .split(separator)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((pgn, index) => {
      const white = headerValue(pgn, 'White') ?? 'White';
      const black = headerValue(pgn, 'Black') ?? 'Black';
      const event = headerValue(pgn, 'Event');
      const date = headerValue(pgn, 'Date') ?? headerValue(pgn, 'EventDate');
      const result = headerValue(pgn, 'Result') ?? pgn.match(/(?:^|\s)(1-0|0-1|1\/2-1\/2|\*)\s*$/)?.[1] ?? '';
      const details = [event, date, result].filter(Boolean).join(' · ');
      return {
        pgn,
        index,
        label: `${index + 1}. ${white} – ${black}${details ? ` · ${details}` : ''}`,
      };
    });
}

function moveToUci(move: Move): string {
  return `${move.from}${move.to}${move.promotion ?? ''}`;
}

function pgnStartFen(pgn: string): string | null {
  const match = pgn.match(/^\s*\[FEN\s+"([^"]+)"\]/mi);
  return match?.[1]?.trim() || null;
}

export function parsePgn(pgn: string): ImportedPgn {
  const collection = splitPgnCollection(pgn);
  if (collection.length > 1) {
    throw new Error(`This PGN contains ${collection.length} games. Select one game from the collection before importing.`);
  }
  const singleGamePgn = collection[0]?.pgn ?? pgn.trim();

  const parsed = new Chess();
  try {
    parsed.loadPgn(singleGamePgn);
  } catch (error) {
    throw new Error(`Invalid PGN: ${error instanceof Error ? error.message : String(error)}`);
  }

  const headers = parsed.getHeaders() as Record<string, string>;
  const startFen = pgnStartFen(singleGamePgn) ?? new Chess().fen();
  let replay: Chess;
  try {
    replay = new Chess(startFen);
  } catch (error) {
    throw new Error(`The PGN contains an invalid starting FEN: ${error instanceof Error ? error.message : String(error)}`);
  }

  const history = parsed.history({ verbose: true }) as Move[];
  const records: PlyRecord[] = history.map((historicMove, index) => {
    const beforeFen = replay.fen();
    const move = replay.move({
      from: historicMove.from,
      to: historicMove.to,
      promotion: historicMove.promotion,
    });
    if (!move) throw new Error(`Could not replay PGN move ${index + 1}.`);
    return {
      id: index + 1,
      ply: index + 1,
      beforeFen,
      afterFen: replay.fen(),
      uci: moveToUci(move),
      san: move.san,
      color: move.color,
    };
  });

  return { game: parsed, startFen, headers, records };
}

export function parseFen(fen: string): Chess {
  try {
    return new Chess(fen.trim());
  } catch (error) {
    throw new Error(`Invalid FEN: ${error instanceof Error ? error.message : String(error)}`);
  }
}
