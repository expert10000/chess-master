import { Chess } from 'chess.js';
import { classifyGamePhase, type GamePhase } from './gameAnalytics';
import { hydrateGameLibraryEntry, type GameLibraryMemory } from './gameLibrary';

export interface PersonalRiskExample { gameId: string; white: string; black: string; ply: number; san: string; fen: string; label: string; cpl: number }
export interface PersonalRiskAssessment {
  comparablePositions: number;
  mistakes: number;
  errorRate: number;
  mainRisk: string;
  examples: PersonalRiskExample[];
  phase: GamePhase;
}

interface PositionSignature { phase: GamePhase; turn: 'w' | 'b'; material: number; kingsidePawnsAdvanced: boolean }
function signature(fen: string, ply: number): PositionSignature {
  const game = new Chess(fen); let material = 0;
  for (const row of game.board()) for (const piece of row) if (piece && piece.type !== 'k') material += piece.type === 'p' ? 1 : piece.type === 'n' || piece.type === 'b' ? 3 : piece.type === 'r' ? 5 : 9;
  const board = game.board();
  const kingsidePawnsAdvanced = ['f', 'g', 'h'].some((file) => {
    const index = file.charCodeAt(0) - 97;
    return board.some((row) => row[index]?.type === 'p' && ((row[index]?.color === 'w' && row[index]!.square[1] !== '2') || (row[index]?.color === 'b' && row[index]!.square[1] !== '7')));
  });
  return { phase: classifyGamePhase(fen, ply), turn: game.turn(), material, kingsidePawnsAdvanced };
}
function issueLabel(fen: string, uci: string, text: string): string {
  const from = uci.slice(0, 2); const piece = new Chess(fen).get(from as any);
  if (piece?.type === 'p' && /^[fgh]/.test(from)) return 'Premature kingside pawn push';
  if (/back[ -]?rank/.test(text)) return 'Missing back-rank tactic';
  if (/hanging|undefended|loose/.test(text)) return 'Unprotected piece';
  if (/exchange|minor piece/.test(text)) return 'Wrong minor-piece exchange';
  if (/open file/.test(text)) return 'Missed open-file opportunity';
  return 'Calculation oversight';
}
function comparable(a: PositionSignature, b: PositionSignature): boolean {
  return a.phase === b.phase && a.turn === b.turn && Math.abs(a.material - b.material) <= 4 && a.kingsidePawnsAdvanced === b.kingsidePawnsAdvanced;
}
export function assessPersonalPreMoveRisk(memory: GameLibraryMemory, fen: string, ply: number, humanColor: 'w' | 'b'): PersonalRiskAssessment | null {
  const target = signature(fen, ply); const samples: Array<{ issue: boolean; label: string; example?: PersonalRiskExample }> = [];
  for (const entry of memory.entries.filter((item) => !item.archived && !item.modelGame && item.humanColor === humanColor)) {
    try { for (const record of hydrateGameLibraryEntry(entry).records) {
      if (record.color !== humanColor || !record.review || !comparable(target, signature(record.beforeFen, record.ply))) continue;
      const issue = ['Inaccuracy', 'Mistake', 'Blunder'].includes(record.review.verdict);
      const text = [record.review.title, record.review.summary, ...record.review.reasons].join(' ').toLowerCase();
      const label = issue ? issueLabel(record.beforeFen, record.uci, text) : '';
      samples.push({ issue, label, example: issue ? { gameId: entry.id, white: entry.white, black: entry.black, ply: record.ply, san: record.san, fen: record.beforeFen, label, cpl: record.review.centipawnLoss } : undefined });
    }} catch { /* malformed historical position is ignored */ }
  }
  const mistakes = samples.filter((sample) => sample.issue); if (samples.length < 3 || mistakes.length === 0) return null;
  const labels = new Map<string, number>(); for (const sample of samples) if (sample.issue) labels.set(sample.label, (labels.get(sample.label) ?? 0) + 1);
  const mainRisk = [...labels.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Calculation oversight';
  return { comparablePositions: samples.length, mistakes: mistakes.length, errorRate: mistakes.length / samples.length, mainRisk, phase: target.phase, examples: mistakes.filter((sample) => sample.label === mainRisk).flatMap((sample) => sample.example ? [sample.example] : []).slice(0, 6) };
}
