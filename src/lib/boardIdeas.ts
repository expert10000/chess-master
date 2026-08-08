import type { Square } from 'chess.js';
import { formatEvaluation, type MoveReview, type Verdict } from './chessCoach';
import { analyzePositionConcepts, type ChessConcept } from './chessConcepts';
import type { AnalyseResult } from '../types/engine';

export type BoardArrowKind = 'best' | 'played' | 'candidate' | 'tactical';
export type BoardHighlightKind = 'tactical' | 'positional' | 'structure' | 'king' | 'material';

export interface BoardArrow {
  id: string;
  from: Square;
  to: Square;
  kind: BoardArrowKind;
  label?: string;
  detail?: string;
}

export interface BoardHighlight {
  id: string;
  square: Square;
  kind: BoardHighlightKind;
  label: string;
  detail?: string;
}

export interface BoardIdeas {
  arrows: BoardArrow[];
  highlights: BoardHighlight[];
}

export type BoardIdeaTarget =
  | { type: 'arrow'; item: BoardArrow }
  | { type: 'highlight'; item: BoardHighlight };

export interface BoardIdeaExplanation {
  id: string;
  title: string;
  text: string;
  bullets: string[];
  suggestedQuestion: string;
  category: BoardArrowKind | BoardHighlightKind;
}

const ISSUE_VERDICTS = new Set<Verdict>(['Inaccuracy', 'Mistake', 'Blunder']);
const SQUARE_RE = /\b[a-h][1-8]\b/g;

function isUciMove(value: string | null | undefined): value is string {
  return Boolean(value && /^[a-h][1-8][a-h][1-8][qrbn]?$/.test(value));
}

function arrowFromUci(uci: string, kind: BoardArrowKind, id: string, label?: string, detail?: string): BoardArrow {
  return {
    id,
    from: uci.slice(0, 2) as Square,
    to: uci.slice(2, 4) as Square,
    kind,
    label,
    detail,
  };
}

function highlightKind(concept: ChessConcept): BoardHighlightKind {
  if (concept.category === 'tactical') return 'tactical';
  if (concept.category === 'structure') return 'structure';
  if (concept.category === 'king') return 'king';
  if (concept.category === 'material') return 'material';
  return 'positional';
}

function squaresMentionedByConcept(concept: ChessConcept): Square[] {
  const values = `${concept.id} ${concept.detail}`.match(SQUARE_RE) ?? [];
  return [...new Set(values)] as Square[];
}

function conceptIdeas(concepts: ChessConcept[]): BoardIdeas {
  const arrows: BoardArrow[] = [];
  const highlights: BoardHighlight[] = [];

  for (const concept of concepts.slice(0, 8)) {
    const squares = squaresMentionedByConcept(concept);
    for (const square of squares.slice(0, 3)) {
      highlights.push({
        id: `${concept.id}-${square}`,
        square,
        kind: highlightKind(concept),
        label: concept.label,
        detail: concept.detail,
      });
    }

    // Line motifs are especially useful when drawn rather than only highlighted.
    if (concept.category === 'tactical' && squares.length >= 2 && /fork|double attack/i.test(`${concept.id} ${concept.label}`)) {
      for (const target of squares.slice(1, 3)) {
        arrows.push({
          id: `concept-fork-${concept.id}-${target}`,
          from: squares[0],
          to: target,
          kind: 'tactical',
          label: concept.label,
          detail: concept.detail,
        });
      }
    } else if (
      concept.category === 'tactical'
      && squares.length >= 2
      && /pin|skewer|discovered|line attack|pressure/i.test(`${concept.id} ${concept.label}`)
    ) {
      arrows.push({
        id: `concept-arrow-${concept.id}`,
        from: squares[0],
        to: squares[1],
        kind: 'tactical',
        label: concept.label,
        detail: concept.detail,
      });
      if (squares.length >= 3 && /pin|skewer/i.test(concept.id)) {
        arrows.push({
          id: `concept-arrow-2-${concept.id}`,
          from: squares[1],
          to: squares[2],
          kind: 'tactical',
          label: concept.label,
          detail: concept.detail,
        });
      }
    }
  }

  // Deduplicate square/category pairs and exact arrows to keep the overlay calm.
  const seenHighlights = new Set<string>();
  const uniqueHighlights = highlights.filter((item) => {
    const key = `${item.square}:${item.kind}`;
    if (seenHighlights.has(key)) return false;
    seenHighlights.add(key);
    return true;
  });
  const seenArrows = new Set<string>();
  const uniqueArrows = arrows.filter((item) => {
    const key = `${item.from}:${item.to}:${item.kind}`;
    if (seenArrows.has(key)) return false;
    seenArrows.add(key);
    return true;
  });

  return { arrows: uniqueArrows, highlights: uniqueHighlights };
}

export function buildReviewBoardIdeas(review: MoveReview | null): BoardIdeas {
  if (!review) return { arrows: [], highlights: [] };

  const concept = conceptIdeas(review.concepts ?? []);
  const arrows = [...concept.arrows];

  if (isUciMove(review.bestMoveUci)) {
    arrows.unshift(arrowFromUci(
      review.bestMoveUci,
      'best',
      'review-best',
      review.bestMoveSan ?? 'Best move',
      `Stockfish preferred ${review.bestMoveSan ?? review.bestMoveUci} with an evaluation of ${review.bestEvaluation}.`,
    ));
  }
  if (
    isUciMove(review.playedUci)
    && review.playedUci !== review.bestMoveUci
    && ISSUE_VERDICTS.has(review.verdict)
  ) {
    arrows.push(arrowFromUci(
      review.playedUci,
      'played',
      'review-played',
      'Played move',
      `${review.title}. This move lost about ${(review.centipawnLoss / 100).toFixed(2)} pawns versus Stockfish's best play.`,
    ));
  }

  return { arrows: arrows.slice(0, 7), highlights: concept.highlights.slice(0, 12) };
}

export function buildAnalysisBoardIdeas(analysis: AnalyseResult | null, fen?: string): BoardIdeas {
  if (!analysis?.lines.length && !fen) return { arrows: [], highlights: [] };
  const arrows: BoardArrow[] = [];
  for (const line of (analysis?.lines ?? []).slice(0, 3)) {
    const first = line.pv[0];
    if (!isUciMove(first)) continue;
    arrows.push(arrowFromUci(
      first,
      line.multipv === 1 ? 'best' : 'candidate',
      `analysis-${line.multipv}`,
      line.multipv === 1 ? 'Best move' : `Candidate ${line.multipv}`,
      `${line.multipv === 1 ? 'Stockfish first choice' : `MultiPV candidate ${line.multipv}`} · ${formatEvaluation(line)} at depth ${line.depth}.`,
    ));
  }
  const concept = fen ? conceptIdeas(analyzePositionConcepts(fen)) : { arrows: [], highlights: [] };
  return {
    arrows: [...arrows, ...concept.arrows].slice(0, 7),
    highlights: concept.highlights.slice(0, 12),
  };
}



function arrowKindExplanation(kind: BoardArrowKind): string {
  if (kind === 'best') return 'This arrow marks Stockfish’s first-choice move in the position.';
  if (kind === 'played') return 'This arrow marks the move that was played and was graded as an issue compared with best play.';
  if (kind === 'candidate') return 'This is one of Stockfish’s MultiPV alternatives, useful for comparing different plans.';
  return 'This arrow visualizes a tactical relationship detected from the board, such as a fork, pin, skewer, or line attack.';
}

function highlightKindExplanation(kind: BoardHighlightKind): string {
  if (kind === 'tactical') return 'The square participates in a concrete tactical motif, so forcing moves and loose pieces deserve attention.';
  if (kind === 'structure') return 'The square is relevant to the pawn structure, such as a weakness, passed pawn, or file relationship.';
  if (kind === 'king') return 'The square is relevant to king safety or a king-zone weakness.';
  if (kind === 'material') return 'The square is relevant to material balance, a hanging piece, or a material-winning sequence.';
  return 'The square has positional importance, such as an outpost, central influence, or useful piece placement.';
}

export function explainBoardIdea(target: BoardIdeaTarget): BoardIdeaExplanation {
  if (target.type === 'arrow') {
    const arrow = target.item;
    const label = arrow.label ?? (arrow.kind === 'best' ? 'Best move' : 'Board arrow');
    const text = arrow.detail ?? arrowKindExplanation(arrow.kind);
    return {
      id: `arrow:${arrow.id}`,
      title: `${label}: ${arrow.from} → ${arrow.to}`,
      text,
      bullets: [
        arrowKindExplanation(arrow.kind),
        `The arrow starts on ${arrow.from} and ends on ${arrow.to}.`,
      ],
      suggestedQuestion: `Explain the ${label.toLowerCase()} from ${arrow.from} to ${arrow.to}. Why is this arrow important in this position?`,
      category: arrow.kind,
    };
  }

  const highlight = target.item;
  return {
    id: `highlight:${highlight.id}`,
    title: `${highlight.label} · ${highlight.square}`,
    text: highlight.detail ?? highlightKindExplanation(highlight.kind),
    bullets: [
      highlightKindExplanation(highlight.kind),
      `The marker is attached specifically to square ${highlight.square}.`,
    ],
    suggestedQuestion: `Why is ${highlight.square} important here? Explain the detected idea “${highlight.label}” on ${highlight.square}.`,
    category: highlight.kind,
  };
}
