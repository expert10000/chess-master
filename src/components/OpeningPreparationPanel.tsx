import { useMemo, useState } from 'react';
import { buildOpeningPreparationPack, type PreparationTarget } from '../lib/openingPreparation';
import type { RepertoireMemory } from '../lib/repertoireMemory';

interface OpeningPreparationPanelProps { memory: RepertoireMemory; disabled?: boolean; onStartPack(target: PreparationTarget): void; }
export function OpeningPreparationPanel({ memory, disabled = false, onStartPack }: OpeningPreparationPanelProps) {
  const [target, setTarget] = useState<PreparationTarget>('sicilian');
  const pack = useMemo(() => buildOpeningPreparationPack(memory, target), [memory, target]);
  return <section className="panel opening-preparation-panel" id="coach-opening-preparation">
    <div className="panel-heading compact"><div><span className="eyebrow">Opening preparation</span><h2>Prep a specific opponent</h2></div><span className="repertoire-position-count">{pack.exercises.length} positions</span></div>
    <div className="prep-targets"><button className={target === 'sicilian' ? 'active' : ''} onClick={() => setTarget('sicilian')}>Against Sicilian</button><button className={target === 'black-vs-d4' ? 'active' : ''} onClick={() => setTarget('black-vs-d4')}>Black vs 1.d4</button></div>
    <div className="prep-hero"><div><span>{pack.title}</span><strong>{pack.choices.length} saved repertoire nodes</strong><small>{pack.deviationFrequency} deviations in your own games</small></div><button type="button" className="primary-button" onClick={() => onStartPack(target)} disabled={disabled || !pack.exercises.length}>Train prep pack</button></div>
    {pack.untrained.length > 0 && <div className="prep-untrained"><strong>{pack.untrained.length} line{pack.untrained.length === 1 ? '' : 's'} never trained</strong><small>{pack.untrained.slice(0, 4).map((item) => item.moveSan).join(' · ')}</small></div>}
    {pack.deviations.length > 0 && <div className="prep-deviations"><span>Your opening deviations</span>{pack.deviations.slice(0, 4).map((item) => <div key={`${item.openingName}:${item.moveSan}`}><b>{item.moveSan}</b><small>{item.openingName} · {item.occurrences}× · {item.lastVerdict ?? 'unreviewed'}</small></div>)}</div>}
    {!pack.choices.length && <div className="repertoire-memory-note"><strong>No matching saved line yet.</strong><p>Save moves from the Opening Explorer in this family; the next pack will combine them with your deviations automatically.</p></div>}
  </section>;
}
