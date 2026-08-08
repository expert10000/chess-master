import { Chess, type Square } from 'chess.js';

export const PV_SPEEDS = [0.5, 1, 2] as const;
export type PvSpeed = typeof PV_SPEEDS[number];

export interface ReplayedPvPosition {
  fen: string;
  index: number;
  lastMove: { from: Square; to: Square } | null;
}

const UCI_MOVE = /^[a-h][1-8][a-h][1-8][qrbn]?$/;

export function sanitizePvLine(line: string[], maxMoves = 24): string[] {
  return line.filter((move) => UCI_MOVE.test(move)).slice(0, maxMoves);
}

export function clampPvIndex(index: number, total: number): number {
  return Math.max(0, Math.min(total, Math.trunc(index)));
}

export function pvAnimationDuration(speed: PvSpeed): number {
  return Math.max(120, Math.round(320 / speed));
}

export function pvStepGap(speed: PvSpeed): number {
  return Math.max(70, Math.round(150 / speed));
}

export function replayPvPosition(startFen: string, line: string[], requestedIndex: number): ReplayedPvPosition {
  const game = new Chess(startFen);
  const index = clampPvIndex(requestedIndex, line.length);
  let lastMove: { from: Square; to: Square } | null = null;
  let completed = 0;

  for (let i = 0; i < index; i += 1) {
    const uci = line[i];
    if (!UCI_MOVE.test(uci)) break;
    const from = uci.slice(0, 2) as Square;
    const to = uci.slice(2, 4) as Square;

    try {
      game.move({ from, to, promotion: uci[4] ?? 'q' });
    } catch {
      break;
    }

    lastMove = { from, to };
    completed = i + 1;
  }

  return {
    fen: game.fen(),
    index: completed,
    lastMove,
  };
}
