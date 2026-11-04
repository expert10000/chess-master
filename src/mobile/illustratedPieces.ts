import type { PieceSymbol } from 'chess.js';

// Transparent bounds in the user-provided 1448 × 1086 sheet, with a small margin.
const BOUNDS: Record<'w' | 'b', Record<PieceSymbol, readonly [number, number, number, number]>> = {
  w: {
    p: [39, 258, 194, 295], n: [252, 207, 216, 345],
    b: [490, 169, 207, 382], r: [716, 220, 213, 332],
    q: [949, 166, 221, 385], k: [1189, 112, 226, 440],
  },
  b: {
    p: [37, 747, 197, 295], n: [251, 692, 221, 351],
    b: [488, 656, 211, 387], r: [715, 707, 216, 337],
    q: [949, 651, 224, 393], k: [1189, 602, 230, 442],
  },
};

export function illustratedBounds(color: 'w' | 'b', piece: PieceSymbol): readonly [number, number, number, number] {
  return BOUNDS[color][piece];
}
