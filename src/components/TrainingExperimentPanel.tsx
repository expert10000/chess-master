import { useMemo, useState } from 'react';
import type { GameLibraryMemory } from '../lib/gameLibrary';
import { buildInterventionHistoryAnalytics } from '../lib/interventionHistoryAnalytics';
import { buildTrainingExperiments } from '../lib/trainingExperiments';
import type { RecommendationOutcomeMemory } from '../lib/recommendationOutcomes';

interface Props { outcomeMemory: RecommendationOutcomeMemory; gameLibrary: GameLibraryMemory }
function metric(value: number | null): string { return value === null ? '—' : `+${value.toFixed(0)} cp`; }
function verdictLabel(value: string): string {
  if (value === 'favors-a' || value === 'favors-b') return 'Evidence favors one arm';
  if (value === 'too-close') return 'No clear difference';
  return 'Collecting evidence';
}
export function TrainingExperimentPanel({ outcomeMemory, gameLibrary }: Props) {
  const [selectedId, setSelectedId] = useState('middlegame-method');
  const experiments = useMemo(() => {
    const history = buildInterventionHistoryAnalytics(outcomeMemory, gameLibrary).history;
    return buildTrainingExperiments(history);
  }, [outcomeMemory, gameLibrary]);
  const experiment = experiments.find((item) => item.id === selectedId) ?? experiments[0];
  if (!experiment) return null;
  return <section className="panel training-experiment-panel" id="coach-training-experiments">
    <div className="panel-heading compact"><div><span className="eyebrow">v1.10.0 · A/B coach</span><h2>Training experiments</h2></div><span className={`experiment-confidence confidence-${experiment.confidence}`}>{experiment.confidence}</span></div>
    <div className="experiment-tabs">{experiments.map((item) => <button key={item.id} type="button" className={item.id === experiment.id ? 'active' : ''} onClick={() => setSelectedId(item.id)}>{item.question}</button>)}</div>
    <p className="experiment-question">{experiment.question}</p>
    <div className="experiment-arms">
      {([['A', experiment.armA], ['B', experiment.armB]] as const).map(([letter, arm]) => <article key={letter} className={experiment.nextArm === letter ? 'next' : ''}><span>Arm {letter}</span><strong>{arm.label}</strong><small>{arm.interventions} measured intervention{arm.interventions === 1 ? '' : 's'}</small><div><span>Avg improvement</span><b>{metric(arm.avgCplImprovement)}</b></div>{experiment.nextArm === letter && <em>Next assignment</em>}</article>)}
    </div>
    <div className={`experiment-verdict experiment-${experiment.verdict}`}><strong>{verdictLabel(experiment.verdict)}</strong><span>{experiment.explanation}</span></div>
    <p className="experiment-note">Each result uses the existing next-10/20-game outcome measurement. This is observational, personal evidence—not randomized proof or statistical certainty.</p>
  </section>;
}
