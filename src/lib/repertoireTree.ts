import { Chess } from 'chess.js';
import { openingPositionKey, type OpeningDeviationMemory, type RepertoireChoice, type RepertoireMemory } from './repertoireMemory';
import type { TrainingExercise } from './training';

export interface RepertoireTreeNode {
  choice: RepertoireChoice;
  children: RepertoireTreeNode[];
  alternatives: OpeningDeviationMemory['alternatives'];
  deviationCount: number;
  weak: boolean;
  forgotten: boolean;
  transposition: boolean;
  performance: string;
}

export function nextPositionKey(choice: RepertoireChoice): string | null {
  try {
    const game = new Chess(choice.fen);
    game.move({ from: choice.moveUci.slice(0, 2), to: choice.moveUci.slice(2, 4), promotion: choice.moveUci[4] });
    return openingPositionKey(game.fen());
  } catch { return null; }
}

export function buildRepertoireTree(memory: RepertoireMemory, side: 'w' | 'b'): RepertoireTreeNode[] {
  const allChoices = Object.values(memory.choices);
  const choices = allChoices.filter((choice) => choice.sideToMove === side);
  const byPosition = new Map(allChoices.map((choice) => [choice.positionKey, choice]));
  const childrenByParent = new Map<string, RepertoireChoice[]>();
  const childReferences = new Map<string, number>();
  for (const choice of allChoices) {
    const childKey = nextPositionKey(choice);
    if (!childKey || !byPosition.has(childKey)) continue;
    childrenByParent.set(choice.positionKey, [...(childrenByParent.get(choice.positionKey) ?? []), byPosition.get(childKey)!]);
    childReferences.set(childKey, (childReferences.get(childKey) ?? 0) + 1);
  }
  const deviations = Object.values(memory.deviations);
  const nodeFor = (choice: RepertoireChoice, path = new Set<string>()): RepertoireTreeNode => {
    const related = deviations.filter((item) => item.positionKey === choice.positionKey);
    const deviationCount = related.reduce((sum, item) => sum + item.occurrences, 0);
    const last = related.slice().sort((a, b) => b.lastSeenAt - a.lastSeenAt)[0];
    const weak = Boolean(last && (last.lastVerdict === 'Mistake' || last.lastVerdict === 'Blunder'));
    const forgotten = choice.practiceAttempts === 0 || (choice.practiceAttempts >= 2 && choice.practiceSuccesses / choice.practiceAttempts < 0.6);
    const children = (childrenByParent.get(choice.positionKey) ?? [])
      .filter((child) => !path.has(child.positionKey))
      .map((child) => nodeFor(child, new Set([...path, choice.positionKey])));
    return {
      choice, children, alternatives: related.flatMap((item) => item.alternatives).slice(0, 4), deviationCount,
      weak, forgotten, transposition: (childReferences.get(choice.positionKey) ?? 0) > 1,
      performance: last ? `${deviationCount} played deviations · last ${last.lastVerdict ?? 'unreviewed'}` : `${choice.practiceSuccesses}/${choice.practiceAttempts} recall`,
    };
  };
  // Each side has its own repertoire entry points. A Black choice can also be
  // the response inside a White branch, so it remains visible as a Black root.
  return choices.map((choice) => nodeFor(choice));
}

export function repertoireBranchExercises(memory: RepertoireMemory, rootKey: string, limit = 10): TrainingExercise[] {
  const root = Object.values(memory.choices).find((choice) => choice.positionKey === rootKey);
  if (!root) return [];
  const result: TrainingExercise[] = [];
  const visit = (choice: RepertoireChoice): void => {
    if (result.length >= limit) return;
    result.push({ key: `repertoire-branch:${choice.positionKey}`, recordId: result.length + 1, ply: result.length + 1, beforeFen: choice.fen,
      originalMoveSan: 'Repertoire recall', originalVerdict: 'Good', originalLoss: 0, bestMoveUci: choice.moveUci, bestMoveSan: choice.moveSan,
      kind: 'opening', openingName: choice.variation ? `${choice.openingName} · ${choice.variation}` : choice.openingName,
      expectedMoves: [choice.moveUci], expectedMoveSans: [choice.moveSan], repertoirePositionKey: choice.positionKey });
    const next = nextPositionKey(choice);
    if (next) {
      const child = memory.choices[next];
      if (child) visit(child);
    }
  };
  visit(root);
  return result;
}
