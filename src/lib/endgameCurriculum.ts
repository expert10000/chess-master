import { classifyGamePhase } from './gameAnalytics';
import { hydrateGameLibraryEntry, type GameLibraryMemory } from './gameLibrary';
import type { TrainingExercise } from './training';

export type EndgameModuleId = 'king-pawn' | 'rook' | 'queen' | 'minor-piece';
export interface EndgameModule { id: EndgameModuleId; label: string; description: string; evidence: number; }
const modules: Array<Omit<EndgameModule, 'evidence'>> = [
  { id: 'king-pawn', label: 'King + pawn', description: 'Opposition, key squares, promotion races, and shouldering.' },
  { id: 'rook', label: 'Rook endings', description: 'Active king, passed pawns, Lucena/Philidor ideas, and checking distance.' },
  { id: 'queen', label: 'Queen endings', description: 'Perpetual-check awareness, king safety, and passed-pawn conversion.' },
  { id: 'minor-piece', label: 'Minor-piece endings', description: 'Good/bad bishops, knight outposts, pawn majorities, and zugzwang.' },
];
function moduleFor(fen: string): EndgameModuleId { const board = fen.split(' ')[0].toLowerCase(); if ((board.match(/r/g) ?? []).length) return 'rook'; if ((board.match(/q/g) ?? []).length) return 'queen'; if ((board.match(/[bn]/g) ?? []).length) return 'minor-piece'; return 'king-pawn'; }

export function endgameCurriculum(memory: GameLibraryMemory): EndgameModule[] {
  const evidence: Record<EndgameModuleId, number> = { 'king-pawn': 0, rook: 0, queen: 0, 'minor-piece': 0 };
  for (const entry of memory.entries) { try { for (const record of hydrateGameLibraryEntry(entry).records) if (record.color === entry.humanColor && record.review && classifyGamePhase(record.beforeFen, record.ply) === 'endgame') evidence[moduleFor(record.beforeFen)] += 1; } catch { /* corrupted game skipped */ } }
  return modules.map((module) => ({ ...module, evidence: evidence[module.id] }));
}

export function automaticEndgameExercises(memory: GameLibraryMemory, limit = 10): TrainingExercise[] {
  const result: TrainingExercise[] = [];
  for (const entry of memory.entries) { try { for (const record of hydrateGameLibraryEntry(entry).records) { const review = record.review; if (result.length >= limit) break; if (record.color !== entry.humanColor || !review?.bestMoveUci || !review.bestMoveSan || classifyGamePhase(record.beforeFen, record.ply) !== 'endgame' || !['Inaccuracy', 'Mistake', 'Blunder'].includes(review.verdict)) continue; result.push({ key: `endgame:${entry.id}:${record.ply}`, recordId: record.id, ply: record.ply, beforeFen: record.beforeFen, originalMoveSan: record.san, originalVerdict: review.verdict, originalLoss: review.centipawnLoss, bestMoveUci: review.bestMoveUci, bestMoveSan: review.bestMoveSan, review, kind: 'review', weaknessLabel: `Endgame · ${moduleFor(record.beforeFen)}` }); } } catch { /* skipped */ } }
  return result;
}
