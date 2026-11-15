export type TablebaseWdl = 'win' | 'draw' | 'loss' | 'cursed-win' | 'blessed-loss' | 'unknown';
export interface TablebaseMove { san: string; uci: string; category: TablebaseWdl; dtz: number | null; }
export interface TablebaseResult { category: TablebaseWdl; dtz: number | null; moves: TablebaseMove[]; onlyMove: TablebaseMove | null; }

function pieces(fen: string): number { return (fen.split(' ')[0].match(/[prnbqkPRNBQK]/g) ?? []).length; }
function inverse(category: TablebaseWdl): TablebaseWdl { if (category === 'win') return 'loss'; if (category === 'loss') return 'win'; if (category === 'cursed-win') return 'blessed-loss'; if (category === 'blessed-loss') return 'cursed-win'; return category; }

export function tablebaseEligible(fen: string): boolean { const count = pieces(fen); return count >= 3 && count <= 7; }

export async function lookupSyzygy(fen: string): Promise<TablebaseResult> {
  if (!tablebaseEligible(fen)) throw new Error('Syzygy lookup requires a legal position with 3–7 pieces.');
  const response = await fetch(`https://tablebase.lichess.ovh/standard?fen=${encodeURIComponent(fen)}`);
  if (!response.ok) throw new Error(`Tablebase lookup failed (${response.status}).`);
  const data = await response.json() as { category?: string; dtz?: number; moves?: Array<{ san?: string; uci?: string; category?: string; dtz?: number }> };
  const category = (data.category ?? 'unknown') as TablebaseWdl;
  const moves = (data.moves ?? []).map((move) => ({ san: move.san ?? move.uci ?? '?', uci: move.uci ?? '', category: (move.category ?? 'unknown') as TablebaseWdl, dtz: typeof move.dtz === 'number' ? move.dtz : null }));
  const optimal = moves.filter((move) => move.category === inverse(category));
  const bestDtz = optimal.length ? Math.min(...optimal.map((move) => Math.abs(move.dtz ?? Number.MAX_SAFE_INTEGER))) : Number.MAX_SAFE_INTEGER;
  const best = optimal.filter((move) => Math.abs(move.dtz ?? Number.MAX_SAFE_INTEGER) === bestDtz);
  return { category, dtz: typeof data.dtz === 'number' ? data.dtz : null, moves, onlyMove: best.length === 1 ? best[0] : null };
}
