import { Chess, type Square } from 'chess.js';
import { analyzeMoveConcepts } from './chessConcepts';
import type { MoveReview, Verdict } from './chessCoach';

export type TrainingSource = 'mistakes' | 'reviewed';

export interface TrainingExercise {
  key: string;
  recordId: number;
  ply: number;
  beforeFen: string;
  originalMoveSan: string;
  originalVerdict: Verdict;
  originalLoss: number;
  bestMoveUci: string;
  bestMoveSan: string;
  review: MoveReview;
}

export interface TrainingAttempt {
  uci: string;
  san: string;
  review: MoveReview;
  accepted: boolean;
  points: number;
  hintLevel: number;
}

const pieceNames: Record<string, string> = {
  p: 'pawn',
  n: 'knight',
  b: 'bishop',
  r: 'rook',
  q: 'queen',
  k: 'king',
};

export function isTrainingIssue(review: MoveReview | undefined): boolean {
  return review?.verdict === 'Inaccuracy' || review?.verdict === 'Mistake' || review?.verdict === 'Blunder';
}

export function scoreTrainingAttempt(review: MoveReview, hintLevel: number): number {
  const base: Record<Verdict, number> = {
    Best: 100,
    Excellent: 88,
    Good: 65,
    Inaccuracy: 35,
    Mistake: 15,
    Blunder: 0,
  };
  const hintMultiplier = Math.max(0.45, 1 - Math.min(4, hintLevel) * 0.14);
  return Math.max(0, Math.round(base[review.verdict] * hintMultiplier));
}

export function isAcceptedTrainingMove(review: MoveReview): boolean {
  return review.verdict === 'Best' || review.verdict === 'Excellent';
}

export function buildTrainingHints(exercise: TrainingExercise): string[] {
  const game = new Chess(exercise.beforeFen);
  const from = exercise.bestMoveUci.slice(0, 2) as Square;
  const to = exercise.bestMoveUci.slice(2, 4) as Square;
  const piece = game.get(from);
  const concepts = analyzeMoveConcepts(exercise.beforeFen, exercise.bestMoveUci);
  const primaryConcept = concepts[0]?.label;
  const pieceName = pieceNames[piece?.type ?? ''] ?? 'piece';

  const hint1 = primaryConcept
    ? `Look for a move connected with: ${primaryConcept}.`
    : `Look for an active ${pieceName} move rather than a passive reply.`;
  const hint2 = `Focus on the ${pieceName} on ${from}.`;
  const hint3 = `The key destination is ${to}; calculate what changes after the ${pieceName} arrives there.`;
  const answer = `Best move: ${exercise.bestMoveSan} (${exercise.bestMoveUci}).`;
  return [hint1, hint2, hint3, answer];
}

export function exerciseTitle(exercise: TrainingExercise): string {
  const moveNumber = Math.ceil(exercise.ply / 2);
  const side = exercise.ply % 2 === 1 ? 'White' : 'Black';
  return `Move ${moveNumber} · ${side} to move`;
}
