import { Chess, type Move } from 'chess.js';
import { recognizeOpening } from '../lib/openingBook';

export interface OpeningHint {
  move: Move;
}

export function openingHint(game: Chess): OpeningHint | null {
  const history = game.history({ verbose: true });
  const line = history.map((move) => `${move.from}${move.to}${move.promotion ?? ''}`);
  const opening = recognizeOpening(line);
  if (!opening.withinBook || !opening.alternatives.length) return null;

  for (const alternative of opening.alternatives) {
    try {
      const preview = new Chess(game.fen());
      const move = preview.move({
        from: alternative.uci.slice(0, 2),
        to: alternative.uci.slice(2, 4),
        promotion: alternative.uci[4] ?? 'q',
      });
      return { move };
    } catch {
      // Ignore an invalid book entry and try the next continuation.
    }
  }
  return null;
}
