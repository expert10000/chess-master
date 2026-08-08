import type { PlyRecord } from '../components/MoveList';
import type { MoveReview, Verdict } from './chessCoach';

export interface EvaluationTimelinePoint {
  ply: number;
  evaluation: number;
  display: string;
  san: string | null;
  verdict: Verdict | null;
  color: 'w' | 'b' | null;
  isIssue: boolean;
}

const issueVerdicts = new Set<Verdict>(['Inaccuracy', 'Mistake', 'Blunder']);

function evaluationFromReview(review: MoveReview, kind: 'best' | 'played'): { value: number; display: string } | null {
  const mate = kind === 'best' ? review.bestMateWhite : review.playedMateWhite;
  const cp = kind === 'best' ? review.bestScoreCpWhite : review.playedScoreCpWhite;
  const display = kind === 'best' ? review.bestEvaluation : review.playedEvaluation;

  if (mate !== undefined && mate !== null) {
    return { value: mate > 0 ? 10 : -10, display };
  }
  if (cp !== undefined && cp !== null) {
    return { value: cp / 100, display };
  }

  // Compatibility with reviews created before v0.8.2.
  if (/^-?M\d+$/i.test(display)) {
    return { value: display.startsWith('-') ? -10 : 10, display };
  }
  const parsed = Number(display);
  if (Number.isFinite(parsed)) return { value: parsed, display };
  return null;
}

export function buildEvaluationTimeline(records: PlyRecord[], humanColor: 'w' | 'b'): EvaluationTimelinePoint[] {
  const points: EvaluationTimelinePoint[] = [];
  const firstReview = records.find((record) => record.review)?.review;
  if (firstReview) {
    const initial = evaluationFromReview(firstReview, 'best');
    if (initial) {
      points.push({
        ply: 0,
        evaluation: initial.value,
        display: initial.display,
        san: null,
        verdict: null,
        color: null,
        isIssue: false,
      });
    }
  }

  for (const record of records) {
    if (!record.review) continue;
    const evaluation = evaluationFromReview(record.review, 'played');
    if (!evaluation) continue;
    points.push({
      ply: record.ply,
      evaluation: evaluation.value,
      display: evaluation.display,
      san: record.san,
      verdict: record.review.verdict,
      color: record.color,
      isIssue: record.color === humanColor && issueVerdicts.has(record.review.verdict),
    });
  }

  return points.sort((a, b) => a.ply - b.ply);
}

export function timelineRange(points: EvaluationTimelinePoint[]): number {
  const largest = points.reduce((value, point) => Math.max(value, Math.abs(point.evaluation)), 0);
  return Math.max(2, Math.min(10, Math.ceil(largest || 2)));
}
