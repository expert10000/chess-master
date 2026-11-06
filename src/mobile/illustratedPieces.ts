import type { PieceSymbol } from 'chess.js';

// Crops in the user-provided 1983 × 793 Staunton sheet, ordered R N B Q K P.
const BOUNDS: Record<'w' | 'b', Record<PieceSymbol, readonly [number, number, number, number]>> = {
  w: {
    r: [142, 48, 218, 337], n: [430, 20, 232, 365],
    b: [743, 8, 218, 377], q: [1041, 12, 228, 373],
    k: [1344, 0, 225, 385], p: [1651, 70, 200, 315],
  },
  b: {
    r: [142, 430, 219, 349], n: [439, 399, 228, 380],
    b: [744, 392, 220, 387], q: [1042, 398, 229, 381],
    k: [1345, 390, 225, 389], p: [1651, 442, 201, 337],
  },
};

export function illustratedBounds(color: 'w' | 'b', piece: PieceSymbol): readonly [number, number, number, number] {
  return BOUNDS[color][piece];
}
