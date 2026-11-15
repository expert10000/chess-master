import { Chess } from 'chess.js';
import { classifyGamePhase, type GamePhase } from './gameAnalytics';
import { hydrateGameLibraryEntry, type GameLibraryMemory } from './gameLibrary';

export interface ModelGameExample { gameId: string; white: string; black: string; ply: number; san: string; label: string }
export interface ModelGameComparison { phase: GamePhase; personalPositions: number; personalAvgCpl: number | null; modelPositions: number; commonModelMove: string | null; examples: ModelGameExample[] }
function shape(fen: string, ply: number) { const g = new Chess(fen); let material = 0; for (const row of g.board()) for (const p of row) if (p && p.type !== 'k') material += p.type === 'p' ? 1 : p.type === 'n' || p.type === 'b' ? 3 : p.type === 'r' ? 5 : 9; return { phase: classifyGamePhase(fen, ply), turn: g.turn(), material }; }
function similar(a: ReturnType<typeof shape>, b: ReturnType<typeof shape>): boolean { return a.phase === b.phase && a.turn === b.turn && Math.abs(a.material - b.material) <= 4; }
export function compareWithModelGames(memory: GameLibraryMemory, fen: string, ply: number, humanColor: 'w' | 'b'): ModelGameComparison {
  const target = shape(fen, ply); let personalPositions = 0; let personalCpl = 0; let personalReviewed = 0; const moveCounts = new Map<string, number>(); const examples: ModelGameExample[] = [];
  for (const entry of memory.entries.filter((item) => !item.archived)) try { for (const record of hydrateGameLibraryEntry(entry).records) {
    if (!similar(target, shape(record.beforeFen, record.ply))) continue;
    if (entry.modelGame) {
      moveCounts.set(record.san, (moveCounts.get(record.san) ?? 0) + 1);
      examples.push({ gameId: entry.id, white: entry.white, black: entry.black, ply: record.ply, san: record.san, label: entry.opening?.name ?? 'Model game' });
    } else if (entry.humanColor === humanColor && record.color === humanColor) {
      personalPositions += 1;
      if (record.review) { personalCpl += record.review.centipawnLoss; personalReviewed += 1; }
    }
  }} catch { /* ignore malformed saved games */ }
  const commonModelMove = [...moveCounts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
  return { phase: target.phase, personalPositions, personalAvgCpl: personalReviewed ? personalCpl / personalReviewed : null, modelPositions: examples.length, commonModelMove, examples: examples.slice(0, 6) };
}
