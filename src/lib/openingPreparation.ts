import type { RepertoireMemory, RepertoireChoice } from './repertoireMemory';
import type { TrainingExercise } from './training';

export type PreparationTarget = 'sicilian' | 'black-vs-d4';

export interface OpeningPreparationPack {
  target: PreparationTarget;
  title: string;
  choices: RepertoireChoice[];
  untrained: RepertoireChoice[];
  deviations: Array<{ moveSan: string; openingName: string; occurrences: number; lastVerdict?: string }>;
  deviationFrequency: number;
  exercises: TrainingExercise[];
}

function matches(choice: RepertoireChoice, target: PreparationTarget): boolean {
  const text = `${choice.openingName} ${choice.variation ?? ''}`.toLowerCase();
  if (target === 'sicilian') return choice.sideToMove === 'w' && text.includes('sicilian');
  return choice.sideToMove === 'b' && /queen.?s pawn|indian|nimzo|grünfeld|grunfeld|benoni|benko|dutch|slav|semi.slav/.test(text);
}

function exercise(choice: RepertoireChoice, index: number): TrainingExercise {
  return { key: `prep:${choice.positionKey}`, recordId: index + 1, ply: index + 1, beforeFen: choice.fen,
    originalMoveSan: 'Preparation recall', originalVerdict: 'Good', originalLoss: 0, bestMoveUci: choice.moveUci, bestMoveSan: choice.moveSan,
    kind: 'opening', openingName: choice.variation ? `${choice.openingName} · ${choice.variation}` : choice.openingName,
    expectedMoves: [choice.moveUci], expectedMoveSans: [choice.moveSan], repertoirePositionKey: choice.positionKey };
}

export function buildOpeningPreparationPack(memory: RepertoireMemory, target: PreparationTarget): OpeningPreparationPack {
  const title = target === 'sicilian' ? 'Prepare White against the Sicilian' : 'Prepare Black vs 1.d4';
  const choices = Object.values(memory.choices).filter((choice) => matches(choice, target));
  const lower = target === 'sicilian' ? 'sicilian' : 'queen|indian|nimzo|gr.nfeld|grunfeld|benoni|benko|dutch|slav';
  const matcher = new RegExp(lower, 'i');
  const deviations = Object.values(memory.deviations)
    .filter((item) => matcher.test(`${item.openingName} ${item.variation ?? ''}`))
    .sort((a, b) => b.occurrences - a.occurrences)
    .map((item) => ({ moveSan: item.moveSan, openingName: item.variation ? `${item.openingName} · ${item.variation}` : item.openingName, occurrences: item.occurrences, lastVerdict: item.lastVerdict }));
  return { target, title, choices, untrained: choices.filter((choice) => choice.practiceAttempts === 0), deviations,
    deviationFrequency: deviations.reduce((sum, item) => sum + item.occurrences, 0), exercises: choices.slice(0, 10).map(exercise) };
}
