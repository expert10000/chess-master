import { analyzeMoveConcepts, type ChessConcept } from './chessConcepts';
import { uciToSan, type MoveReview } from './chessCoach';

export type MoveComparisonFocus = 'both' | 'played' | 'best';

export interface MoveComparisonSide {
  role: 'played' | 'best';
  label: string;
  moveSan: string;
  moveUci: string;
  evaluation: string;
  lineSan: string[];
  lineUci: string[];
  concepts: ChessConcept[];
}

export interface MoveComparisonModel {
  played: MoveComparisonSide;
  best: MoveComparisonSide;
  centipawnLoss: number;
  lossPawns: number;
  lossScalePercent: number;
  verdict: MoveReview['verdict'];
  headline: string;
  bestOnlyConcepts: string[];
  playedOnlyConcepts: string[];
  sameMove: boolean;
}

function conceptLabels(concepts: ChessConcept[]): string[] {
  return [...new Set(concepts.map((concept) => concept.label).filter(Boolean))];
}

function uniqueLabels(primary: string[], secondary: string[]): string[] {
  const secondarySet = new Set(secondary.map((label) => label.toLowerCase()));
  return primary.filter((label) => !secondarySet.has(label.toLowerCase()));
}

export function buildMoveComparison(review: MoveReview): MoveComparisonModel {
  const playedSan = uciToSan(review.beforeFen, review.playedUci) ?? review.playedUci;
  const bestUci = review.bestMoveUci ?? review.playedUci;
  const bestSan = review.bestMoveSan ?? uciToSan(review.beforeFen, bestUci) ?? bestUci;
  const playedConcepts = review.concepts ?? [];
  const bestConcepts = review.bestMoveUci
    ? analyzeMoveConcepts(review.beforeFen, review.bestMoveUci)
    : [];
  const playedLabels = conceptLabels(playedConcepts);
  const bestLabels = conceptLabels(bestConcepts);
  const sameMove = review.bestMoveUci === review.playedUci || review.centipawnLoss <= 12;

  let headline = 'The two moves are effectively equivalent.';
  if (!sameMove) {
    if (review.centipawnLoss >= 250) headline = `${bestSan} avoids a decisive loss compared with ${playedSan}.`;
    else if (review.centipawnLoss >= 120) headline = `${bestSan} keeps substantially more of the position’s value.`;
    else if (review.centipawnLoss >= 70) headline = `${bestSan} is clearly more precise than ${playedSan}.`;
    else headline = `${bestSan} is a modest improvement over ${playedSan}.`;
  }

  return {
    played: {
      role: 'played',
      label: 'Your move',
      moveSan: playedSan,
      moveUci: review.playedUci,
      evaluation: review.playedEvaluation,
      lineSan: review.playedLineSan,
      lineUci: review.playedLineUci ?? [],
      concepts: playedConcepts,
    },
    best: {
      role: 'best',
      label: 'Stockfish best',
      moveSan: bestSan,
      moveUci: bestUci,
      evaluation: review.bestEvaluation,
      lineSan: review.bestLineSan,
      lineUci: review.bestLineUci ?? [],
      concepts: bestConcepts,
    },
    centipawnLoss: review.centipawnLoss,
    lossPawns: review.centipawnLoss / 100,
    lossScalePercent: Math.min(100, review.centipawnLoss / 3),
    verdict: review.verdict,
    headline,
    bestOnlyConcepts: uniqueLabels(bestLabels, playedLabels).slice(0, 4),
    playedOnlyConcepts: uniqueLabels(playedLabels, bestLabels).slice(0, 4),
    sameMove,
  };
}
